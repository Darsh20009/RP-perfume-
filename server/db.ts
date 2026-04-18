import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  if (process.env.NODE_ENV === "production") {
    console.warn("Warning: MONGODB_URI is not set. Database operations will fail.");
  }
}

let isConnected = false;
let retryInterval: ReturnType<typeof setInterval> | null = null;

export function getIsConnected() {
  return isConnected;
}

async function tryConnect(uri: string): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      bufferCommands: true,
      // ── Connection pool tuned for high concurrency ──
      maxPoolSize: parseInt(process.env.MONGO_POOL_MAX || "50", 10),
      minPoolSize: parseInt(process.env.MONGO_POOL_MIN || "5", 10),
      maxIdleTimeMS: 60_000,
      compressors: ["zstd", "zlib"],
    } as any);
    isConnected = true;
    console.log("Connected to MongoDB successfully");
    return true;
  } catch (err: any) {
    console.error("MongoDB connection attempt failed:", err?.message?.split('\n')[0] || err);
    return false;
  }
}

function startBackgroundRetry(uri: string) {
  if (retryInterval) return;
  console.log("Starting background MongoDB reconnection (every 30s)...");
  retryInterval = setInterval(async () => {
    if (isConnected) {
      if (retryInterval) { clearInterval(retryInterval); retryInterval = null; }
      return;
    }
    console.log("Retrying MongoDB connection...");
    const ok = await tryConnect(uri);
    if (ok && retryInterval) { clearInterval(retryInterval); retryInterval = null; }
  }, 30000);
}

export async function connectDB() {
  if (isConnected) return;
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be set.");
  }

  const uri = process.env.MONGODB_URI!;

  let connected = await tryConnect(uri);

  if (!connected) {
    console.log("Retrying MongoDB connection in 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));
    connected = await tryConnect(uri);
  }

  if (!connected) {
    console.log("Retrying MongoDB connection in 5 seconds...");
    await new Promise(r => setTimeout(r, 5000));
    connected = await tryConnect(uri);
  }

  if (!connected) {
    console.warn("=== MongoDB unavailable. Will retry every 30s in background. Whitelist 0.0.0.0/0 in Atlas Network Access. ===");
    startBackgroundRetry(uri);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn("MongoDB disconnected. Will retry...");
    isConnected = false;
    startBackgroundRetry(uri);
  });

  mongoose.connection.on('connected', async () => {
    isConnected = true;
    console.log("MongoDB reconnected successfully");
    try {
      const { seed } = await import("./seed");
      await seed();
    } catch (e: any) {
      console.error("Post-reconnect seed failed:", e?.message);
    }
  });
}

export default mongoose;
