import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { connectDB } from "./db";
import { WebSocketServer } from "ws";
import { registerWsClient } from "./notifications";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── Security Headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
}));

// ─── Remove x-powered-by ──────────────────────────────────────────────────────
app.disable("x-powered-by");

// ─── Gzip / Brotli compression for responses ─────────────────────────────────
app.use(compression({
  threshold: 1024, // only compress responses ≥1KB
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// ─── Global Rate Limiting ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "طلبات كثيرة جداً، يرجى المحاولة بعد قليل" },
  skip: (req) => !req.path.startsWith("/api"),
});
app.use(globalLimiter);

// ─── Strict Rate Limiting for Auth ───────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login attempts per 15min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات تسجيل دخول كثيرة جداً، يرجى الانتظار 15 دقيقة" },
  skipSuccessfulRequests: true,
});

// ─── Upload Rate Limiting ─────────────────────────────────────────────────────
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: { message: "تجاوزت حد الرفع المسموح به" },
});

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "2mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Prevent process crash from unhandled promise rejections (e.g. DB timeouts)
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection] caught:', reason?.message || reason);
  // Do NOT exit — keep server alive
});

process.on('uncaughtException', (err: any) => {
  console.error('[uncaughtException] caught:', err?.message || err);
  // Do NOT exit — keep server alive
});

(async () => {
  await connectDB();
  await registerRoutes(httpServer, app);

  // ─── WebSocket Server ──────────────────────────────────────────────────────
  // Attach WS on /ws path so it doesn't interfere with Vite's HMR websocket
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    // Client must send { type: "auth", userId: "..." } within 3s
    let authTimeout = setTimeout(() => ws.terminate(), 3000);
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth" && msg.userId) {
          clearTimeout(authTimeout);
          registerWsClient(msg.userId, ws);
          ws.send(JSON.stringify({ type: "auth_ok" }));
        }
      } catch {
        // ignore malformed messages
      }
    });
    ws.on("error", () => {});
  });
  console.log("[WS] WebSocket server ready on /ws");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
