import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets (JS/CSS chunks from Vite) → 1-year immutable cache
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: true,
    }),
  );

  // All other static files (images, icons, manifest, etc.) → 7-day cache + ETag
  app.use(
    express.static(distPath, {
      maxAge: "7d",
      etag: true,
      lastModified: true,
      // index.html must NOT be cached — handled below with no-cache
      index: false,
    }),
  );

  // index.html → always revalidate so users get fresh deploys immediately
  app.use("*", (_req: Request, res: Response) => {
    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
