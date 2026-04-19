/**
 * Inbox Service — RF Perfume
 * IMAP fetch + SMTP send for employee mailboxes (Zoho / Gmail / any provider).
 * App-passwords are encrypted at rest with AES-256-GCM.
 */
import crypto from "crypto";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { MailAccountModel, MailMessageModel } from "./models";

// ─── Encryption ────────────────────────────────────────────────────────────────
const ENC_KEY_RAW = process.env.INBOX_ENC_KEY || process.env.SESSION_SECRET || "";
if (!ENC_KEY_RAW) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[Inbox] INBOX_ENC_KEY (or SESSION_SECRET) env var is REQUIRED in production");
  }
  console.warn("[Inbox] ⚠️  No INBOX_ENC_KEY/SESSION_SECRET set — using insecure dev fallback. Set INBOX_ENC_KEY before adding any real mailbox.");
}
const ENC_KEY = crypto.createHash("sha256").update(ENC_KEY_RAW || "rfperfume-dev-only-DO-NOT-USE-IN-PROD").digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encB64) throw new Error("Invalid encrypted payload");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ─── Provider presets ──────────────────────────────────────────────────────────
export const PROVIDER_PRESETS: Record<string, {
  imapHost: string; imapPort: number; smtpHost: string; smtpPort: number;
}> = {
  zoho:   { imapHost: "imap.zoho.com",      imapPort: 993, smtpHost: "smtp.zoho.com",      smtpPort: 465 },
  gmail:  { imapHost: "imap.gmail.com",     imapPort: 993, smtpHost: "smtp.gmail.com",     smtpPort: 465 },
  outlook:{ imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587 },
  yandex: { imapHost: "imap.yandex.com",    imapPort: 993, smtpHost: "smtp.yandex.com",    smtpPort: 465 },
  custom: { imapHost: "",                    imapPort: 993, smtpHost: "",                    smtpPort: 465 },
};

// ─── IMAP ──────────────────────────────────────────────────────────────────────
async function openImap(account: any) {
  const password = decryptSecret(account.password);
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort || 993,
    secure: true,
    auth: { user: account.email, pass: password },
    logger: false,
    socketTimeout: 30_000,
  });
  await client.connect();
  return client;
}

export async function testConnection(params: {
  email: string; password: string;
  imapHost: string; imapPort: number;
  smtpHost: string; smtpPort: number;
}): Promise<{ ok: boolean; imap: boolean; smtp: boolean; error?: string }> {
  const result = { ok: false, imap: false, smtp: false, error: undefined as string | undefined };
  try {
    const imap = new ImapFlow({
      host: params.imapHost, port: params.imapPort || 993, secure: true,
      auth: { user: params.email, pass: params.password }, logger: false, socketTimeout: 15_000,
    });
    await imap.connect();
    await imap.logout();
    result.imap = true;
  } catch (e: any) {
    result.error = `IMAP: ${e?.message || e}`;
    return result;
  }
  try {
    const t = nodemailer.createTransport({
      host: params.smtpHost, port: params.smtpPort || 465,
      secure: (params.smtpPort || 465) === 465,
      auth: { user: params.email, pass: params.password },
    });
    await t.verify();
    result.smtp = true;
  } catch (e: any) {
    result.error = `SMTP: ${e?.message || e}`;
    return result;
  }
  result.ok = true;
  return result;
}

// Per-account mutex to prevent concurrent syncs (manual + interval + initial)
const syncLocks = new Map<string, Promise<any>>();

/** Fetch new messages from IMAP and store in MongoDB cache */
export async function syncAccount(accountId: string, opts: { limit?: number; folder?: string } = {}) {
  const lockKey = `${accountId}:${opts.folder || "INBOX"}`;
  const existing = syncLocks.get(lockKey);
  if (existing) return existing; // dedupe — return the in-flight promise
  const p = (async () => _doSyncAccount(accountId, opts))().finally(() => syncLocks.delete(lockKey));
  syncLocks.set(lockKey, p);
  return p;
}

async function _doSyncAccount(accountId: string, opts: { limit?: number; folder?: string } = {}) {
  const account = await MailAccountModel.findById(accountId);
  if (!account) throw new Error("Account not found");
  const folder = opts.folder || "INBOX";
  const limit = opts.limit || 50;

  const client = await openImap(account);
  let fetched = 0; let stored = 0;
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const mailbox: any = client.mailbox;
      const total = mailbox?.exists || 0;
      if (total === 0) return { fetched: 0, stored: 0, total: 0 };

      const start = Math.max(1, total - limit + 1);
      const range = `${start}:${total}`;

      for await (const msg of client.fetch(range, { uid: true, envelope: true, flags: true, bodyStructure: true, source: true, internalDate: true })) {
        fetched++;
        const uid = String(msg.uid);
        const seen = msg.flags?.has?.("\\Seen") ?? false;
        const flagged = msg.flags?.has?.("\\Flagged") ?? false;
        let parsed: any = {};
        try { parsed = await simpleParser(msg.source as Buffer); } catch {}
        const env = msg.envelope || ({} as any);

        // Idempotent upsert — race-safe under concurrent syncs
        const r = await MailMessageModel.updateOne(
          { accountId, folder, uid },
          {
            $set: { isRead: seen, isStarred: flagged },
            $setOnInsert: {
              messageId: env.messageId || parsed.messageId || `${uid}@local`,
              subject: env.subject || parsed.subject || "(بدون موضوع)",
              fromEmail: env.from?.[0]?.address || parsed.from?.value?.[0]?.address || "",
              fromName: env.from?.[0]?.name || parsed.from?.value?.[0]?.name || "",
              toEmails: (env.to || parsed.to?.value || []).map((a: any) => a.address || a),
              ccEmails: (env.cc || parsed.cc?.value || []).map((a: any) => a.address || a),
              date: env.date || msg.internalDate || parsed.date || new Date(),
              textBody: parsed.text || "",
              htmlBody: parsed.html || "",
              snippet: (parsed.text || "").replace(/\s+/g, " ").slice(0, 200),
              attachments: (parsed.attachments || []).map((a: any) => ({
                filename: a.filename || "file",
                contentType: a.contentType || "application/octet-stream",
                size: a.size || 0,
              })),
              inReplyTo: parsed.inReplyTo || "",
            },
          },
          { upsert: true }
        );
        if (r.upsertedCount > 0) stored++;
      }
    } finally {
      lock.release();
    }
    account.lastSyncAt = new Date();
    account.lastSyncStatus = "ok";
    account.lastSyncError = "";
    await account.save();
    return { fetched, stored, total: fetched };
  } catch (e: any) {
    account.lastSyncStatus = "error";
    account.lastSyncError = e?.message || String(e);
    await account.save();
    throw e;
  } finally {
    try { await client.logout(); } catch {}
  }
}

/** Set IMAP flags on a server-side message (read/unread/star). */
export async function setMessageFlags(messageDocId: string, flags: { isRead?: boolean; isStarred?: boolean }) {
  const msg = await MailMessageModel.findById(messageDocId);
  if (!msg) throw new Error("Message not found");
  const account = await MailAccountModel.findById(msg.accountId);
  if (!account) throw new Error("Account not found");
  const client = await openImap(account);
  try {
    const lock = await client.getMailboxLock(msg.folder);
    try {
      if (flags.isRead === true)  await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
      if (flags.isRead === false) await client.messageFlagsRemove({ uid: msg.uid }, ["\\Seen"], { uid: true });
      if (flags.isStarred === true)  await client.messageFlagsAdd({ uid: msg.uid }, ["\\Flagged"], { uid: true });
      if (flags.isStarred === false) await client.messageFlagsRemove({ uid: msg.uid }, ["\\Flagged"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch {}
  }
  if (typeof flags.isRead    === "boolean") msg.isRead    = flags.isRead;
  if (typeof flags.isStarred === "boolean") msg.isStarred = flags.isStarred;
  await msg.save();
  return msg;
}

/** Move message to Trash folder */
export async function deleteMessage(messageDocId: string) {
  const msg = await MailMessageModel.findById(messageDocId);
  if (!msg) throw new Error("Message not found");
  const account = await MailAccountModel.findById(msg.accountId);
  if (!account) throw new Error("Account not found");
  const client = await openImap(account);
  try {
    const lock = await client.getMailboxLock(msg.folder);
    try {
      await client.messageMove({ uid: msg.uid }, "Trash", { uid: true }).catch(async () => {
        // fallback: just mark deleted
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Deleted"], { uid: true });
      });
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch {}
  }
  await MailMessageModel.deleteOne({ _id: msg._id });
}

// ─── SMTP send ─────────────────────────────────────────────────────────────────
export async function sendFromAccount(accountId: string, params: {
  to: string[]; cc?: string[]; bcc?: string[];
  subject: string; html?: string; text?: string;
  inReplyTo?: string; references?: string[];
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}) {
  const account = await MailAccountModel.findById(accountId);
  if (!account) throw new Error("Account not found");
  const password = decryptSecret(account.password);
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort || 465,
    secure: (account.smtpPort || 465) === 465,
    auth: { user: account.email, pass: password },
  });
  const info = await transporter.sendMail({
    from: `"${account.displayName || account.email}" <${account.email}>`,
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    html: params.html,
    text: params.text || (params.html ? params.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""),
    inReplyTo: params.inReplyTo,
    references: params.references,
    attachments: params.attachments,
  });
  // Append to "Sent" folder via IMAP — discover provider's actual Sent mailbox
  try {
    const client = await openImap(account);
    try {
      const raw = `From: ${account.displayName || account.email} <${account.email}>\r\nTo: ${params.to.join(", ")}\r\nSubject: ${params.subject}\r\nDate: ${new Date().toUTCString()}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${params.html || params.text || ""}`;
      // Try common Sent folder names across providers
      const candidates = ["Sent", "INBOX.Sent", "[Gmail]/Sent Mail", "Sent Items", "Sent Messages"];
      let appended = false;
      for (const folder of candidates) {
        try {
          await client.append(folder, raw, ["\\Seen"]);
          appended = true;
          break;
        } catch { /* try next */ }
      }
      if (!appended) console.warn("[Inbox] Could not append to Sent folder for", account.email);
    } finally {
      try { await client.logout(); } catch {}
    }
  } catch (e: any) {
    console.warn("[Inbox] Sent-append IMAP error:", e?.message);
  }
  return { messageId: info.messageId, accepted: info.accepted };
}
