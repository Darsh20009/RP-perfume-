/**
 * File upload abstraction.
 *
 * • If `OBJECT_STORAGE_BUCKET` env is set AND `@replit/object-storage` is
 *   installed → uploads go to Replit Object Storage (durable, scales horizontally,
 *   survives container restarts/deploys).
 * • Otherwise → falls back to local disk (`/uploads`) so dev works out of the box.
 *
 * Both modes return a public URL of the form `/uploads/<filename>` so frontend
 * code is identical. In cloud mode, Express transparently streams the file
 * from the bucket via the same `/uploads/:key` route.
 */

import fs from "fs";
import path from "path";
import type { Request, Response } from "express";

const LOCAL_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

const BUCKET = process.env.OBJECT_STORAGE_BUCKET || process.env.REPLIT_OBJECT_STORAGE_BUCKET || "";

// Shared promise prevents duplicate Client instances under concurrent first-hits
let bucketPromise: Promise<any> | null = null;

function getBucket(): Promise<any> {
  if (!BUCKET) return Promise.resolve(null);
  if (bucketPromise) return bucketPromise;
  bucketPromise = (async () => {
    try {
      const mod: any = await import("@replit/object-storage");
      const Client = mod.Client || mod.default?.Client;
      const client = new Client({ bucketId: BUCKET });
      console.log(`[uploads] Object Storage enabled (bucket: ${BUCKET})`);
      return client;
    } catch (e: any) {
      console.warn(`[uploads] Object Storage unavailable, falling back to local disk: ${e?.message}`);
      return null;
    }
  })();
  return bucketPromise;
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf",
};
function mimeFor(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] || "application/octet-stream";
}

export function getLocalUploadsDir() { return LOCAL_DIR; }
export function isCloudMode() { return !!BUCKET; }

export interface UploadResult {
  filename: string;
  url: string;
  storage: "cloud" | "local";
  bytes: number;
}

/** Persist a file (already on local disk via multer) into the active backend. */
export async function persistUpload(localPath: string, filename: string): Promise<UploadResult> {
  const stats = fs.statSync(localPath);
  const bucket = await getBucket();
  if (bucket) {
    try {
      const buf = fs.readFileSync(localPath);
      await bucket.uploadFromBytes(filename, buf);
      // Cloud-stored — remove the temp local copy
      try { fs.unlinkSync(localPath); } catch {}
      return { filename, url: `/uploads/${filename}`, storage: "cloud", bytes: stats.size };
    } catch (e: any) {
      console.error(`[uploads] cloud put failed (${filename}), keeping local copy:`, e?.message);
    }
  }
  // Local mode (or cloud failure) — file already saved by multer to LOCAL_DIR
  return { filename, url: `/uploads/${filename}`, storage: "local", bytes: stats.size };
}

/** Express handler that serves /uploads/:key from cloud (if enabled) else from disk.
 *  Uses path.basename to strip any traversal attempts (../ or %2e%2e/), and verifies
 *  the resolved local path stays inside LOCAL_DIR before serving. */
export async function serveUpload(req: Request, res: Response) {
  const rawKey = req.params.key || "";
  const key = path.basename(rawKey); // strips any directory components
  if (!key || key !== rawKey) return res.sendStatus(400);

  // Try local disk first (fast path — multer-saved files, dev mode, fallback)
  const localPath = path.join(LOCAL_DIR, key);
  const resolved = path.resolve(localPath);
  if (!resolved.startsWith(path.resolve(LOCAL_DIR) + path.sep)) {
    return res.sendStatus(400);
  }
  if (fs.existsSync(resolved)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", mimeFor(key));
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(resolved);
  }

  const bucket = await getBucket();
  if (!bucket) return res.sendStatus(404);

  try {
    const result = await bucket.downloadAsBytes(key);
    const buf = Array.isArray(result) ? result[0] : result?.value || result;
    if (!buf) return res.sendStatus(404);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", mimeFor(key));
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  } catch (e: any) {
    console.error(`[uploads] cloud get failed for ${key}:`, e?.message);
    return res.sendStatus(404);
  }
}

/** Optional: delete a file from the active backend. */
export async function deleteUpload(filename: string): Promise<boolean> {
  let ok = false;
  const localPath = path.join(LOCAL_DIR, filename);
  if (fs.existsSync(localPath)) { try { fs.unlinkSync(localPath); ok = true; } catch {} }
  const bucket = await getBucket();
  if (bucket) { try { await bucket.delete(filename); ok = true; } catch {} }
  return ok;
}
