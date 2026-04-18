/**
 * In-process job queue for background side-effects (emails, notifications,
 * invoices, analytics). Decouples the slow stuff from the request path so
 * /api/orders responds in <100ms even under heavy load.
 *
 *  • FIFO queue with concurrent workers
 *  • Per-job retries with exponential backoff
 *  • Bounded queue (drops oldest non-critical jobs if overloaded)
 *  • Stats exposed for the admin Performance page
 *  • Single-process only — for multi-instance deployments swap with BullMQ+Redis
 */

type JobHandler = () => Promise<void>;

interface Job {
  id: number;
  name: string;
  handler: JobHandler;
  attempt: number;
  maxAttempts: number;
  enqueuedAt: number;
  critical: boolean;
}

const queue: Job[] = [];
const MAX_QUEUE_SIZE = 50_000;
const CONCURRENCY = parseInt(process.env.JOB_QUEUE_CONCURRENCY || "8", 10);
let nextId = 1;
let activeWorkers = 0;

const stats = {
  enqueued: 0,
  completed: 0,
  failed: 0,
  retried: 0,
  dropped: 0,
  byName: {} as Record<string, { enqueued: number; completed: number; failed: number; avgMs: number }>,
};

function bumpStat(name: string, key: "enqueued" | "completed" | "failed", durationMs?: number) {
  const s = stats.byName[name] ||= { enqueued: 0, completed: 0, failed: 0, avgMs: 0 };
  s[key]++;
  if (key === "completed" && typeof durationMs === "number") {
    s.avgMs = s.completed === 1 ? durationMs : Math.round((s.avgMs * (s.completed - 1) + durationMs) / s.completed);
  }
}

export function enqueueJob(
  name: string,
  handler: JobHandler,
  opts: { maxAttempts?: number; critical?: boolean } = {},
): number | null {
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Try to drop oldest non-critical job to make room
    const idx = queue.findIndex(j => !j.critical);
    if (idx >= 0) {
      queue.splice(idx, 1);
      stats.dropped++;
    } else {
      stats.dropped++;
      console.warn(`[JobQueue] FULL — dropping new job: ${name}`);
      return null;
    }
  }
  const job: Job = {
    id: nextId++,
    name,
    handler,
    attempt: 0,
    maxAttempts: opts.maxAttempts ?? 3,
    enqueuedAt: Date.now(),
    critical: !!opts.critical,
  };
  queue.push(job);
  stats.enqueued++;
  bumpStat(name, "enqueued");
  setImmediate(tick);
  return job.id;
}

async function runJob(job: Job) {
  const t0 = Date.now();
  job.attempt++;
  try {
    await job.handler();
    stats.completed++;
    bumpStat(job.name, "completed", Date.now() - t0);
  } catch (err: any) {
    if (job.attempt < job.maxAttempts) {
      stats.retried++;
      const backoffMs = Math.min(30_000, 500 * 2 ** (job.attempt - 1));
      console.warn(`[JobQueue] '${job.name}' failed (attempt ${job.attempt}/${job.maxAttempts}) — retrying in ${backoffMs}ms: ${err?.message || err}`);
      setTimeout(() => { queue.unshift(job); setImmediate(tick); }, backoffMs);
    } else {
      stats.failed++;
      bumpStat(job.name, "failed");
      console.error(`[JobQueue] '${job.name}' permanently failed after ${job.attempt} attempts: ${err?.message || err}`);
    }
  }
}

function tick() {
  while (activeWorkers < CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!;
    activeWorkers++;
    runJob(job).finally(() => {
      activeWorkers--;
      if (queue.length > 0) setImmediate(tick);
    });
  }
}

export function getQueueStats() {
  return {
    pending: queue.length,
    active: activeWorkers,
    capacity: MAX_QUEUE_SIZE,
    concurrency: CONCURRENCY,
    ...stats,
  };
}

export function resetQueueStats() {
  stats.enqueued = 0;
  stats.completed = 0;
  stats.failed = 0;
  stats.retried = 0;
  stats.dropped = 0;
  stats.byName = {};
}
