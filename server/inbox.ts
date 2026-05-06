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
import { SITE, ASSETS } from "./site-config";

// ─── Branded email wrapper ─────────────────────────────────────────────────────
const BRANDED_MARKER = "<!--RFP-BRANDED-EMAIL-->";

/** Detect if content is already wrapped (avoid double-wrapping replies/forwards). */
function isAlreadyBranded(html?: string): boolean {
  if (!html) return false;
  return html.includes(BRANDED_MARKER) || /<!doctype\s+html/i.test(html);
}

/** Convert plain text or simple HTML into branded RTL HTML email body. */
function normalizeBody(html?: string, text?: string): string {
  if (html && html.trim()) {
    // Already has paragraph/div tags — keep as-is. Otherwise wrap line breaks.
    if (/<\s*(p|div|table|br|h[1-6]|ul|ol|blockquote)\b/i.test(html)) return html;
    return html.replace(/\r?\n/g, "<br/>");
  }
  if (text && text.trim()) {
    const escaped = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\r?\n/g, "<br/>");
    return escaped;
  }
  return "";
}

/** Wrap any outgoing email body in the official RF Perfume branded HTML template. */
export function wrapInboxHtml(params: {
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}): string {
  const { senderName, senderEmail, subject, body } = params;
  const safeSubject = (subject || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `${BRANDED_MARKER}<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${safeSubject}</title>
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f5f5f0; direction: rtl; }
    table { border-collapse: collapse !important; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
    a { color: #1a2744; text-decoration: none; }
    .body-content p { margin: 0 0 14px; line-height: 1.85; font-size: 15px; color: #1a1a1a; }
    .body-content a { color: #c9a96e; font-weight: 700; text-decoration: underline; }
    .body-content blockquote { margin: 14px 0; padding: 12px 18px; border-right: 3px solid #c9a96e; background: #faf8f3; color: #4a4a4a; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px-content { padding-left: 22px !important; padding-right: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f0;direction:rtl;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color:#f5f5f0;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="600" class="container" style="max-width:600px;background-color:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <!-- Header with logo -->
          <tr>
            <td align="center" bgcolor="#0f1a2e" style="background:#0f1a2e;background-image:linear-gradient(135deg,#0f1a2e 0%,#1a2744 50%,#243154 100%);padding:32px 24px 26px;border-bottom:3px solid #c9a96e;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 12px;">
                <tr>
                  <td align="center" valign="middle" bgcolor="#000000" style="background-color:#000000;border:1px solid #c9a96e;border-radius:10px;padding:8px 16px;">
                    <img src="${ASSETS.LOGO_SQUARE}" alt="RF Perfume" width="120" height="90" style="display:block;width:120px;height:90px;border:0;outline:none;" />
                  </td>
                </tr>
              </table>
              <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:0.18em;line-height:1.2;margin-top:10px;">${SITE.BRAND_AR}</div>
              <div style="color:#c9a96e;font-size:10px;font-weight:700;letter-spacing:0.4em;text-transform:uppercase;margin-top:6px;">${SITE.BRAND_EN}</div>
            </td>
          </tr>
          <!-- Sender strip -->
          <tr>
            <td style="padding:14px 28px;background:#faf8f3;border-bottom:1px solid rgba(201,169,110,0.25);">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="font-size:11px;color:rgba(0,0,0,0.5);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">من / From</td>
                  <td align="left" style="font-size:12px;color:#1a2744;font-weight:800;direction:ltr;text-align:left;">${senderName} &lt;${senderEmail}&gt;</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="px-content body-content" style="padding:38px 32px 24px;color:#1a1a1a;direction:rtl;text-align:right;font-size:15px;line-height:1.85;">
              ${body}
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-top:1px solid rgba(0,0,0,0.08);padding-top:20px;">
                <tr>
                  <td style="font-size:13px;color:#1a2744;font-weight:900;line-height:1.5;">${senderName}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:rgba(0,0,0,0.55);font-weight:600;direction:ltr;text-align:right;padding-top:2px;">${senderEmail}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:rgba(0,0,0,0.55);font-weight:600;padding-top:6px;">
                    <a href="${SITE.URL}" style="color:#c9a96e;font-weight:800;text-decoration:none;">${SITE.DOMAIN}</a>
                    <span style="color:rgba(0,0,0,0.2);margin:0 6px;">|</span>
                    <span>${SITE.BRAND_AR} &mdash; ${SITE.BRAND_EN}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background:#0f1a2e;padding:22px 28px;">
              <p style="margin:0;color:rgba(255,255,255,0.55);font-size:11px;font-weight:600;line-height:1.7;">
                &copy; ${new Date().getFullYear()} ${SITE.BRAND_AR} &mdash; جميع الحقوق محفوظة
              </p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.35);font-size:10px;">
                <a href="${SITE.URL}" style="color:#c9a96e;text-decoration:none;font-weight:700;">${SITE.DOMAIN}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
  let password: string;
  try {
    password = decryptSecret(account.password);
  } catch (e: any) {
    throw new Error(
      `فشل فك تشفير كلمة مرور (${account.email}). ` +
      `يرجى إعادة إضافة الحساب أو التحقق من ثبات INBOX_ENC_KEY.`
    );
  }
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
  let password: string;
  try {
    password = decryptSecret(account.password);
  } catch (e: any) {
    throw new Error(
      `فشل فك تشفير كلمة مرور الحساب (${account.email}). ` +
      `يرجى حذف الحساب وإعادة إضافته، أو التأكد من ثبات INBOX_ENC_KEY. (${e?.message})`
    );
  }
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort || 465,
    secure: (account.smtpPort || 465) === 465,
    auth: { user: account.email, pass: password },
  });

  // Always wrap outgoing emails in the official RF Perfume branded template
  // (logo, header, signature, footer) — unless content is already a full HTML doc.
  const senderName = account.displayName || account.email;
  const finalHtml = isAlreadyBranded(params.html)
    ? params.html!
    : wrapInboxHtml({
        senderName,
        senderEmail: account.email,
        subject: params.subject,
        body: normalizeBody(params.html, params.text),
      });

  const info = await transporter.sendMail({
    from: `"${senderName}" <${account.email}>`,
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    html: finalHtml,
    text: params.text || finalHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
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
