# **PHASE 2 - RELIABILITY & OBSERVABILITY**

**Generated:** 2026-07-22  
**Purpose:** Improve reliability, observability, and operational excellence  
**Timeline:** 7-10 days (1 developer, full-time)

---

## **OVERVIEW**

Phase 2 focuses pada reliability dan observability setelah security layer di Phase 1 sudah terpasang. Goals utama:
- Persist session state agar survive restart
- Implement retry mechanism untuk failed operations
- Add comprehensive logging dan monitoring
- Graceful shutdown untuk prevent data loss
- Distributed tracing untuk debugging

## **TASK 1: Migrate Session State to Redis**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di Redis, distributed systems, dan state management.

### **ROLE**
Bertindak sebagai Infrastructure Engineer yang bertanggung jawab untuk migrating in-memory state ke persistent storage.

### **CONTEXT**

**Current State:**
- Session state (QR, connected status) disimpan di in-memory Map (wa-manager.ts:21)
- Poll votes disimpan di in-memory Map (PollStore.ts:5)
- State hilang saat restart/crash
- Tidak bisa horizontal scale (multi-instance)

**Problems:**
- **Data Loss:** Server restart → semua session harus reconnect
- **No High Availability:** Single point of failure
- **No Scalability:** Tidak bisa run multiple instances
- **Poor UX:** Users harus scan QR lagi setelah restart

**Requirements:**
1. Install Redis client (ioredis)
2. Create Redis connection manager
3. Migrate session state dari Map ke Redis
4. Migrate poll store dari Map ke Redis
5. Add Redis health check
6. Support Redis cluster (future-proof)
7. Fallback ke in-memory jika Redis unavailable (graceful degradation)

**Technical Specs:**

**Redis Schema Design:**
`
# Session State
whatsapp:session:{sessionName} -> JSON
{
  "name": "test1",
  "qr": "...",
  "connected": true,
  "lastUpdateAt": 1721614139189
}
TTL: 1 hour (auto-refresh on activity)

# Poll Store
whatsapp:poll:{remoteJid}:{pollId} -> JSON (WAMessage)
TTL: 24 hours

# Session List
whatsapp:sessions -> SET [session1, session2, ...]

# Connection Status Index
whatsapp:connected -> SET [session1, session3, ...]
whatsapp:disconnected -> SET [session2, ...]
`

**Files to Create/Modify:**
- package.json - Add ioredis dependency
- src/config/redis.ts - Redis connection manager
- src/services/SessionStore.ts - Session state persistence
- src/services/PollStore.ts - Refactor to use Redis
- src/wa-manager.ts - Use SessionStore instead of Map
- src/middleware/health.ts - Add Redis health check
- .env.example - Add Redis config

**Implementation Example:**

src/config/redis.ts:
\\\	ypescript
import Redis from "ioredis";
import { env } from "./env";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("Redis error:", err);
    });

    redis.on("connect", () => {
      console.log("✅ Redis connected");
    });
  }

  return redis;
}

export async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
\\\

src/services/SessionStore.ts:
\\\	ypescript
import { getRedis } from "../config/redis";

type SessionState = {
  name: string;
  qr?: string;
  connected: boolean;
  lastUpdateAt: number;
};

const inMemoryFallback = new Map<string, SessionState>();
let redisAvailable = true;

export async function saveSession(state: SessionState): Promise<void> {
  const key = \whatsapp:session:\\;
  
  try {
    const redis = getRedis();
    await redis.setex(key, 3600, JSON.stringify(state));
    await redis.sadd("whatsapp:sessions", state.name);
    
    if (state.connected) {
      await redis.sadd("whatsapp:connected", state.name);
      await redis.srem("whatsapp:disconnected", state.name);
    } else {
      await redis.sadd("whatsapp:disconnected", state.name);
      await redis.srem("whatsapp:connected", state.name);
    }
  } catch (err) {
    console.warn("Redis unavailable, using in-memory fallback");
    inMemoryFallback.set(state.name, state);
    redisAvailable = false;
  }
}

export async function getSession(name: string): Promise<SessionState | null> {
  const key = \whatsapp:session:\\;
  
  try {
    const redis = getRedis();
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    return inMemoryFallback.get(name) || null;
  }
}

export async function deleteSession(name: string): Promise<void> {
  const key = \whatsapp:session:\\;
  
  try {
    const redis = getRedis();
    await redis.del(key);
    await redis.srem("whatsapp:sessions", name);
    await redis.srem("whatsapp:connected", name);
    await redis.srem("whatsapp:disconnected", name);
  } catch (err) {
    inMemoryFallback.delete(name);
  }
}

export async function getAllSessions(): Promise<string[]> {
  try {
    const redis = getRedis();
    return await redis.smembers("whatsapp:sessions");
  } catch (err) {
    return Array.from(inMemoryFallback.keys());
  }
}
\\\

**Environment Variables (.env.example):**
\\\env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=true
\\\

**Acceptance Criteria:**
1. ✅ Session state survive server restart
2. ✅ Poll data survive server restart
3. ✅ Graceful fallback ke in-memory jika Redis down
4. ✅ Redis health check di /health endpoint
5. ✅ No breaking changes ke existing API
6. ✅ Performance: Redis operations <10ms p99

**Migration Strategy:**
1. Deploy dengan Redis disabled (REDIS_ENABLED=false)
2. Verify app masih berfungsi dengan in-memory
3. Enable Redis (REDIS_ENABLED=true)
4. Monitor logs untuk Redis errors
5. Rollback jika ada issues

---

## **TASK 2: Implement Webhook Retry Queue with BullMQ**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di message queues, job processing, dan distributed systems.

### **ROLE**
Bertindak sebagai Reliability Engineer yang bertanggung jawab untuk ensuring webhook delivery reliability dengan retry mechanism.

### **CONTEXT**

**Current State:**
- Webhook dikirim secara synchronous di event handler (wa-manager.ts:136, 172)
- Jika webhook endpoint down/timeout, message hilang selamanya
- Blocking event loop saat send webhook
- Tidak ada retry mechanism
- Tidak ada visibility ke failed webhooks

**Problems:**
- **Data Loss:** Webhook endpoint down → message hilang
- **Performance:** Slow webhook = slow message processing
- **No Visibility:** Tidak tahu berapa banyak webhook gagal
- **Poor UX:** Users tidak dapat reliable notification

**Requirements:**
1. Install BullMQ (job queue library)
2. Create webhook job queue
3. Implement exponential backoff retry strategy
4. Add dead letter queue untuk failed webhooks
5. Create admin API untuk inspect/retry failed jobs
6. Add job monitoring dashboard data
7. Move webhook sending dari sync ke async (queue-based)

**Technical Specs:**

**Retry Strategy:**
- Attempt 1: Immediate
- Attempt 2: 30 seconds later
- Attempt 3: 5 minutes later
- Attempt 4: 30 minutes later
- Attempt 5: 2 hours later
- After 5 attempts → move to Dead Letter Queue

**Job Priority:**
- Poll votes: Priority 1 (highest)
- Regular messages: Priority 2
- Webhook config changes: Priority 3

**Files to Create/Modify:**
- package.json - Add bullmq dependency
- src/queues/webhook.queue.ts - Queue configuration
- src/workers/webhook.worker.ts - Job processor
- src/services/WebhookService.ts - Enqueue webhooks
- src/wa-manager.ts - Use WebhookService instead of direct fetch
- src/routes/admin.ts - Admin routes untuk job management
- src/controllers/AdminController.ts - Queue inspection

**Implementation Example:**

src/queues/webhook.queue.ts:
\\\	ypescript
import { Queue, QueueEvents } from "bullmq";
import { getRedis } from "../config/redis";

export type WebhookJob = {
  url: string;
  payload: any;
  headers: Record<string, string>;
  sessionName: string;
  messageType: "message" | "poll_vote";
  timestamp: number;
};

export const webhookQueue = new Queue<WebhookJob>("webhook-delivery", {
  connection: getRedis(),
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 30000, // 30 seconds
    },
    removeOnComplete: 100, // Keep last 100 completed
    removeOnFail: false, // Keep all failed for inspection
  },
});

export const webhookQueueEvents = new QueueEvents("webhook-delivery", {
  connection: getRedis(),
});

webhookQueueEvents.on("completed", ({ jobId }) => {
  console.log(\Webhook job \ completed\);
});

webhookQueueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(\Webhook job \ failed: \\);
});

webhookQueueEvents.on("retrying", ({ jobId, attemptsMade }) => {
  console.warn(\Webhook job \ retrying (attempt \)\);
});
\\\

src/workers/webhook.worker.ts:
\\\	ypescript
import { Worker } from "bullmq";
import { getRedis } from "../config/redis";
import { webhookQueue, WebhookJob } from "../queues/webhook.queue";

const worker = new Worker<WebhookJob>(
  "webhook-delivery",
  async (job) => {
    const { url, payload, headers } = job.data;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(\HTTP \: \\);
      }

      return { success: true, statusCode: response.status };
    } catch (error) {
      clearTimeout(timeout);
      
      // Log error details
      console.error(\Webhook delivery failed (attempt \)\, {
        jobId: job.id,
        url,
        error: error instanceof Error ? error.message : String(error),
        sessionName: job.data.sessionName,
      });

      throw error; // Re-throw untuk trigger retry
    }
  },
  {
    connection: getRedis(),
    concurrency: 10, // Process 10 webhooks concurrently
  }
);

worker.on("completed", (job) => {
  console.log(\✅ Webhook delivered: \\);
});

worker.on("failed", (job, err) => {
  if (job) {
    console.error(\❌ Webhook failed permanently: \\, err);
  }
});

export { worker };
\\\

src/services/WebhookService.ts:
\\\	ypescript
import { webhookQueue } from "../queues/webhook.queue";
import { generateWebhookSignature } from "../utils/webhook-signature";

export async function enqueueWebhook(
  sessionName: string,
  url: string,
  payload: any,
  secret?: string,
  messageType: "message" | "poll_vote" = "message"
): Promise<string> {
  const timestamp = Date.now();
  const payloadString = JSON.stringify(payload);
  
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-webhook-timestamp": timestamp.toString(),
  };

  if (secret) {
    headers["x-webhook-signature"] = generateWebhookSignature(
      secret,
      timestamp,
      payloadString
    );
  }

  const priority = messageType === "poll_vote" ? 1 : 2;

  const job = await webhookQueue.add(
    \webhook:\:\\,
    {
      url,
      payload,
      headers,
      sessionName,
      messageType,
      timestamp,
    },
    {
      priority,
    }
  );

  return job.id!;
}
\\\

src/routes/admin.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { AdminController } from "../controllers/AdminController";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .get("/queue/stats", AdminController.getQueueStats)
  .get("/queue/failed", AdminController.getFailedJobs)
  .get("/queue/jobs/:jobId", AdminController.getJobDetails)
  .post("/queue/jobs/:jobId/retry", AdminController.retryJob)
  .delete("/queue/jobs/:jobId", AdminController.deleteJob)
  .post("/queue/clean", AdminController.cleanQueue);
\\\

src/controllers/AdminController.ts:
\\\	ypescript
import { webhookQueue } from "../queues/webhook.queue";

export class AdminController {
  static async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
      webhookQueue.getCompletedCount(),
      webhookQueue.getFailedCount(),
      webhookQueue.getDelayedCount(),
    ]);

    return {
      status: "success",
      data: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
    };
  }

  static async getFailedJobs({ query }: any) {
    const limit = parseInt(query.limit || "50");
    const jobs = await webhookQueue.getFailed(0, limit - 1);

    return {
      status: "success",
      data: jobs.map((job) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
      })),
    };
  }

  static async retryJob({ params }: any) {
    const { jobId } = params;
    const job = await webhookQueue.getJob(jobId);

    if (!job) {
      return { status: "error", message: "Job not found" };
    }

    await job.retry();

    return {
      status: "success",
      message: "Job queued for retry",
      data: { jobId },
    };
  }

  static async deleteJob({ params }: any) {
    const { jobId } = params;
    const job = await webhookQueue.getJob(jobId);

    if (!job) {
      return { status: "error", message: "Job not found" };
    }

    await job.remove();

    return {
      status: "success",
      message: "Job deleted",
      data: { jobId },
    };
  }

  static async cleanQueue({ body }: any) {
    const { olderThan, status } = body as {
      olderThan?: number;
      status: "completed" | "failed";
    };

    const grace = olderThan || 3600000; // 1 hour default

    if (status === "completed") {
      await webhookQueue.clean(grace, 0, "completed");
    } else {
      await webhookQueue.clean(grace, 0, "failed");
    }

    return {
      status: "success",
      message: \Cleaned \ jobs older than \ms\,
    };
  }
}
\\\

**Update wa-manager.ts:**
\\\	ypescript
// Before (line 133-144):
const cfg = await resolveWebhook(name);
if (cfg?.url) {
  try {
    await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("webhook_forward_failed", e);
  }
}

// After:
const cfg = await resolveWebhook(name);
if (cfg?.url) {
  await enqueueWebhook(
    name,
    cfg.url,
    payload,
    cfg.secret,
    "poll_vote"
  );
}
\\\

**Acceptance Criteria:**
1. ✅ Webhook failures auto-retry dengan exponential backoff
2. ✅ Failed webhooks accessible via admin API
3. ✅ Manual retry dari admin interface
4. ✅ Queue stats available (/admin/queue/stats)
5. ✅ Event loop tidak blocked saat webhook slow
6. ✅ Performance: Enqueue <5ms, throughput >100 jobs/sec

**Monitoring Metrics:**
- Webhook delivery success rate
- Average delivery time
- Retry rate
- Dead letter queue size
- Queue depth (backlog)

---

## **TASK 3: Implement Structured Logging with Pino**

### **MODEL**
Kamu adalah Senior DevOps Engineer dengan expertise di observability, logging systems, dan production debugging.

### **ROLE**
Bertindak sebagai Observability Engineer yang bertanggung jawab untuk implementing comprehensive logging infrastructure.

### **CONTEXT**

**Current State:**
- Logger set ke "silent" mode (wa-manager.ts:43)
- Webhook errors hanya console.error (wa-manager.ts:142, 180)
- Tidak ada structured logging
- Tidak ada log levels
- Tidak ada log persistence
- Tidak ada correlation IDs untuk tracing

**Problems:**
- **No Debugging:** Production issues tidak bisa di-diagnose
- **No Audit Trail:** Tidak ada record siapa melakukan apa
- **No Performance Tracking:** Tidak tahu endpoint mana yang lambat
- **No Error Aggregation:** Errors scattered di console

**Requirements:**
1. Configure Pino dengan proper log levels (per environment)
2. Add structured logging dengan consistent format
3. Implement log rotation (daily rotate)
4. Add request/response logging middleware
5. Add correlation IDs untuk trace requests
6. Log semua webhook delivery attempts
7. Add performance metrics logging
8. Create log analysis guide

**Technical Specs:**

**Log Levels by Environment:**
- Development: debug
- Staging: info
- Production: warn

**Log Format (JSON):**
\\\json
{
  "level": 30,
  "time": 1721614812745,
  "pid": 12345,
  "hostname": "server-01",
  "correlationId": "req_abc123xyz",
  "sessionName": "test1",
  "userId": "user_123",
  "action": "send_message",
  "status": "success",
  "duration": 245,
  "msg": "Message sent successfully"
}
\\\

**Files to Create/Modify:**
- package.json - Add pino-pretty (dev), pino-roll (prod)
- src/config/logger.ts - Logger configuration
- src/middleware/logging.ts - Request/response logging
- src/middleware/correlation.ts - Correlation ID injection
- src/wa-manager.ts - Replace console.* dengan logger
- src/workers/webhook.worker.ts - Add structured logging
- src/utils/performance.ts - Performance tracking utilities
- logs/ - Log directory (gitignored)

**Implementation Example:**

src/config/logger.ts:
\\\	ypescript
import pino from "pino";
import { env } from "./env";

const isProduction = env.NODE_ENV === "production";
const isDevelopment = env.NODE_ENV === "development";

export const logger = pino({
  level: env.LOG_LEVEL,
  
  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "secret",
      "token",
      "apiKey",
      "authorization",
      "*.password",
      "*.secret",
      "*.token",
    ],
    censor: "[REDACTED]",
  },

  // Format timestamps
  timestamp: () => \,"time":\\,

  // Pretty print in development
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Add custom serializers
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Create child loggers for different modules
export function createLogger(module: string) {
  return logger.child({ module });
}

// Specific loggers
export const waLogger = createLogger("whatsapp");
export const webhookLogger = createLogger("webhook");
export const queueLogger = createLogger("queue");
export const apiLogger = createLogger("api");
\\\

src/middleware/logging.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { apiLogger } from "../config/logger";

export const loggingMiddleware = new Elysia()
  .onRequest(({ request, store }: any) => {
    store.startTime = Date.now();
    store.correlationId = request.headers.get("x-correlation-id") || 
                          \eq_\_\\;
    
    apiLogger.info({
      correlationId: store.correlationId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get("user-agent"),
      msg: "Incoming request",
    });
  })
  .onAfterHandle(({ request, store, set }: any) => {
    const duration = Date.now() - store.startTime;
    
    apiLogger.info({
      correlationId: store.correlationId,
      method: request.method,
      url: request.url,
      status: set.status || 200,
      duration,
      msg: "Request completed",
    });
  })
  .onError(({ request, store, error }: any) => {
    const duration = Date.now() - store.startTime;
    
    apiLogger.error({
      correlationId: store.correlationId,
      method: request.method,
      url: request.url,
      error: {
        message: error.message,
        stack: error.stack,
      },
      duration,
      msg: "Request failed",
    });
  });
\\\

src/middleware/correlation.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { AsyncLocalStorage } from "async_hooks";

export const correlationStorage = new AsyncLocalStorage<string>();

export const correlationMiddleware = new Elysia()
  .onRequest(({ request, store }: any) => {
    const correlationId = 
      request.headers.get("x-correlation-id") || 
      \eq_\_\\;
    
    store.correlationId = correlationId;
    
    // Store in AsyncLocalStorage for access anywhere
    correlationStorage.enterWith(correlationId);
  })
  .onAfterHandle(({ set, store }: any) => {
    // Add correlation ID to response headers
    set.headers["x-correlation-id"] = store.correlationId;
  });

// Helper to get current correlation ID
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}
\\\

**Update wa-manager.ts:**
\\\	ypescript
// Before:
const sock = makeWASocket({
  auth: state, 
  logger: pino({ level: "silent" })
});

// After:
import { waLogger } from "./config/logger";

const sock = makeWASocket({
  auth: state, 
  logger: waLogger.child({ session: name })
});

// Before (line 142):
console.error("webhook_forward_failed", e);

// After:
webhookLogger.error({
  sessionName: name,
  webhookUrl: cfg.url,
  error: e instanceof Error ? e.message : String(e),
  msg: "Webhook delivery failed",
});
\\\

**Performance Tracking:**

src/utils/performance.ts:
\\\	ypescript
import { logger } from "../config/logger";
import { getCorrelationId } from "../middleware/correlation";

export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return async function (...args: any[]) {
    const start = Date.now();
    const correlationId = getCorrelationId();

    try {
      const result = await fn.apply(this, args);
      const duration = Date.now() - start;

      logger.debug({
        correlationId,
        operation,
        duration,
        status: "success",
        msg: \\ completed\,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error({
        correlationId,
        operation,
        duration,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        msg: \\ failed\,
      });

      throw error;
    }
  };
}

// Usage example:
export const sendMessageWithMetrics = measurePerformance(
  "send_message",
  MessageService.sendText
);
\\\

**Log Rotation Configuration:**

src/config/logger.ts (production):
\\\	ypescript
import pino from "pino";
import pinoms from "pino-multi-stream";

const streams = [
  // Console output
  { stream: process.stdout },
  
  // File output with rotation
  {
    level: "info",
    stream: pino.destination({
      dest: "logs/app.log",
      sync: false,
      mkdir: true,
    }),
  },
  
  // Error-only file
  {
    level: "error",
    stream: pino.destination({
      dest: "logs/error.log",
      sync: false,
      mkdir: true,
    }),
  },
];

export const logger = pinoms({ streams });
\\\

**Environment Variables:**
\\\env
# Logging
LOG_LEVEL=info
LOG_DIR=logs
LOG_MAX_SIZE=100M
LOG_MAX_FILES=30
\\\

**Log Analysis Guide (docs/LOG_ANALYSIS.md):**
\\\markdown
# Log Analysis Guide

## Common Queries

### Find all errors in last hour
\\\ash
cat logs/app.log | grep '"level":50' | tail -100
\\\

### Trace request by correlation ID
\\\ash
cat logs/app.log | grep '"correlationId":"req_abc123"'
\\\

### Find slow requests (>1s)
\\\ash
cat logs/app.log | grep '"duration"' | awk '\ ~ /"duration":[0-9]{4,}/'
\\\

### Count errors by type
\\\ash
cat logs/error.log | jq -r '.error.message' | sort | uniq -c | sort -rn
\\\
\\\

**Acceptance Criteria:**
1. ✅ All console.log/error replaced dengan structured logger
2. ✅ Correlation IDs propagate through all logs
3. ✅ Log files rotate daily (max 30 days retention)
4. ✅ Sensitive data (passwords, API keys) redacted automatically
5. ✅ Performance metrics logged untuk semua operations
6. ✅ Error stack traces captured dengan context
7. ✅ Log analysis guide documented

**Log Monitoring Alerts (for future):**
- Error rate >10/min
- Slow requests >1s for >10% traffic
- Failed webhook delivery >20%
- Redis connection errors
- Disk space <10% remaining

---

## **TASK 4: Implement Graceful Shutdown**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di process lifecycle management, signal handling, dan zero-downtime deployments.

### **ROLE**
Bertindak sebagai Reliability Engineer yang bertanggung jawab untuk implementing graceful shutdown untuk prevent data loss dan ensure clean termination.

### **CONTEXT**

**Current State:**
- App langsung terminate saat SIGTERM/SIGINT
- Active connections tidak di-cleanup
- In-flight requests bisa fail
- WhatsApp sockets tidak properly closed
- Redis connections tidak di-close
- Queue workers tidak stopped gracefully

**Problems:**
- **Data Loss:** Messages in-flight bisa hilang
- **Connection Leaks:** Sockets tidak closed properly
- **Dirty State:** Session state tidak saved sebelum shutdown
- **Poor UX:** Active requests fail dengan 502

**Requirements:**
1. Implement signal handlers (SIGTERM, SIGINT)
2. Stop accepting new requests (drain connections)
3. Wait for in-flight requests to complete (with timeout)
4. Gracefully close WhatsApp sockets
5. Close Redis connections
6. Stop BullMQ workers gracefully
7. Save all session state before exit
8. Add shutdown timeout (max 30 seconds)

**Technical Specs:**

**Shutdown Sequence:**
1. Receive SIGTERM signal
2. Mark app as "shutting down" (reject new requests with 503)
3. Wait for active requests (max 10 seconds)
4. Close all WhatsApp sockets gracefully
5. Stop BullMQ workers (finish current jobs)
6. Save session states to Redis
7. Close Redis connection
8. Exit process with code 0

**Shutdown Timeout:**
- Grace period: 30 seconds total
- If not finished → force exit with code 1

**Files to Create/Modify:**
- src/utils/shutdown.ts - Shutdown manager
- src/index.ts - Register shutdown handlers
- src/wa-manager.ts - Add cleanup function
- src/workers/webhook.worker.ts - Graceful worker stop
- src/config/redis.ts - Close connection function

**Implementation Example:**

src/utils/shutdown.ts:
\\\	ypescript
import { logger } from "../config/logger";

type ShutdownHandler = () => Promise<void>;

class ShutdownManager {
  private handlers: Array<{ name: string; fn: ShutdownHandler }> = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds

  register(name: string, handler: ShutdownHandler) {
    this.handlers.push({ name, fn: handler });
  }

  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  async shutdown(signal: string) {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    logger.info({ signal }, "Received shutdown signal, starting graceful shutdown");

    const shutdownPromise = this.executeHandlers();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Shutdown timeout")), this.shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Shutdown failed or timed out, forcing exit");
      process.exit(1);
    }
  }

  private async executeHandlers() {
    logger.info(\Executing \ shutdown handlers\);

    for (const { name, fn } of this.handlers) {
      try {
        logger.info({ handler: name }, "Running shutdown handler");
        await fn();
        logger.info({ handler: name }, "Shutdown handler completed");
      } catch (error) {
        logger.error({ handler: name, error }, "Shutdown handler failed");
      }
    }
  }
}

export const shutdownManager = new ShutdownManager();

// Helper middleware to reject requests during shutdown
export function rejectDuringShutdown() {
  return (app: any) => {
    return app.onBeforeHandle(({ set }: any) => {
      if (shutdownManager.isShutdown()) {
        set.status = 503;
        return {
          status: "error",
          message: "Server is shutting down",
        };
      }
    });
  };
}
\\\

**Update src/index.ts:**
\\\	ypescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./config/env";
import { routes } from "./routes/index";
import { shutdownManager, rejectDuringShutdown } from "./utils/shutdown";
import { closeAllSessions } from "./wa-manager";
import { closeRedis } from "./config/redis";
import { worker } from "./workers/webhook.worker";
import { logger } from "./config/logger";

const app = new Elysia()
  .use(cors({ origin: env.CORS_ORIGINS }))
  .use(rejectDuringShutdown())
  .get("/", () => "OK")
  .use(routes)
  .listen(env.PORT);

logger.info(\🦊 Elysia running on http://localhost:\\);

// Register shutdown handlers
shutdownManager.register("http-server", async () => {
  logger.info("Draining HTTP connections");
  await new Promise((resolve) => {
    // Wait for active requests to finish (max 10s)
    const checkInterval = setInterval(() => {
      // Check if server has active connections
      // Bun/Elysia doesn't expose this, so we wait fixed time
      clearInterval(checkInterval);
      resolve(undefined);
    }, 100);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(undefined);
    }, 10000);
  });
  
  app.stop();
});

shutdownManager.register("whatsapp-sessions", async () => {
  logger.info("Closing WhatsApp sessions");
  await closeAllSessions();
});

shutdownManager.register("queue-worker", async () => {
  logger.info("Stopping queue worker");
  await worker.close();
});

shutdownManager.register("redis", async () => {
  logger.info("Closing Redis connection");
  await closeRedis();
});

// Listen for shutdown signals
process.on("SIGTERM", () => shutdownManager.shutdown("SIGTERM"));
process.on("SIGINT", () => shutdownManager.shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  shutdownManager.shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection");
  shutdownManager.shutdown("unhandledRejection");
});
\\\

**Add cleanup to wa-manager.ts:**
\\\	ypescript
const sessions = new Map<string, SessionState>();

export async function closeAllSessions() {
  const closePromises: Promise<void>[] = [];

  for (const [name, session] of sessions.entries()) {
    if (session.sock) {
      const promise = (async () => {
        try {
          // Save state to Redis before closing
          await saveSession({
            name,
            connected: session.connected,
            qr: session.qr,
            lastUpdateAt: Date.now(),
          });

          // Close socket gracefully
          session.sock?.end(undefined);
          waLogger.info({ session: name }, "Session closed gracefully");
        } catch (error) {
          waLogger.error({ session: name, error }, "Failed to close session");
        }
      })();

      closePromises.push(promise);
    }
  }

  await Promise.allSettled(closePromises);
  sessions.clear();
}
\\\

**Health Check Enhancement:**

src/routes/health.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { getRedis } from "../config/redis";
import { shutdownManager } from "../utils/shutdown";

export const healthRoutes = new Elysia()
  .get("/health", async () => {
    const checks: Record<string, any> = {
      status: "healthy",
      timestamp: Date.now(),
      uptime: process.uptime(),
      shutdown: shutdownManager.isShutdown(),
    };

    // Check Redis
    try {
      const redis = getRedis();
      await redis.ping();
      checks.redis = "connected";
    } catch (error) {
      checks.redis = "disconnected";
      checks.status = "degraded";
    }

    return checks;
  })

  .get("/health/ready", () => {
    // Readiness probe for K8s
    if (shutdownManager.isShutdown()) {
      return { ready: false, reason: "shutting_down" };
    }
    return { ready: true };
  })

  .get("/health/live", () => {
    // Liveness probe for K8s
    return { alive: true };
  });
\\\

**Testing Shutdown:**
\\\ash
# 1. Start server
bun run dev

# 2. Send requests in background
while true; do curl http://localhost:3000/health; sleep 0.5; done &

# 3. Trigger shutdown
kill -SIGTERM <pid>

# 4. Observe logs
# Should see:
# - "Received shutdown signal"
# - "Running shutdown handler: http-server"
# - "Running shutdown handler: whatsapp-sessions"
# - "Running shutdown handler: queue-worker"
# - "Running shutdown handler: redis"
# - "Graceful shutdown completed"
# - New requests return 503

# 5. Verify no errors in logs
\\\

**Acceptance Criteria:**
1. ✅ SIGTERM/SIGINT trigger graceful shutdown
2. ✅ New requests rejected with 503 during shutdown
3. ✅ Active requests complete before shutdown (max 10s)
4. ✅ All WhatsApp sockets closed gracefully
5. ✅ All session states saved to Redis
6. ✅ Redis connections closed properly
7. ✅ Queue workers stopped gracefully
8. ✅ Process exits with code 0 on success
9. ✅ Force exit after 30s timeout
10. ✅ Health checks reflect shutdown state

**Deployment Integration:**
\\\yaml
# docker-compose.yml
services:
  whatsapp-bot:
    stop_grace_period: 35s  # Slightly longer than app timeout
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/live"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
\\\

---

## **TASK 5: Add Health Checks & Metrics Endpoints**

### **MODEL**
Kamu adalah Senior DevOps Engineer dengan expertise di monitoring, observability, dan SRE practices.

### **ROLE**
Bertindak sebagai Site Reliability Engineer yang bertanggung jawab untuk implementing comprehensive health checks dan metrics untuk production monitoring.

### **CONTEXT**

**Current State:**
- Hanya ada basic / endpoint yang return "OK"
- Tidak ada health check untuk dependencies (Redis, WhatsApp)
- Tidak ada metrics exposure untuk monitoring systems
- Tidak ada visibility ke system resource usage
- Tidak ada readiness/liveness probes untuk orchestrators

**Problems:**
- **No Visibility:** Tidak tahu status sistem secara real-time
- **Poor Alerting:** Tidak bisa setup alerts di monitoring system
- **Debugging Difficulty:** Tidak ada metrics untuk troubleshooting
- **Orchestration Issues:** K8s/Docker tidak bisa detect unhealthy containers

**Requirements:**
1. Implement /health endpoint (comprehensive status)
2. Implement /health/live (liveness probe for K8s)
3. Implement /health/ready (readiness probe for K8s)
4. Implement /metrics endpoint (Prometheus format)
5. Add dependency health checks (Redis, WhatsApp sessions)
6. Expose system metrics (CPU, memory, event loop lag)
7. Expose business metrics (sessions, webhooks, queue depth)
8. Add metrics collection middleware

**Technical Specs:**

**Health Check Response Format:**
\\\json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": 1721615498114,
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "redis": {
      "status": "healthy",
      "latency": 2,
      "message": "Connected"
    },
    "whatsapp": {
      "status": "healthy",
      "activeSessions": 3,
      "connectedSessions": 2
    },
    "queue": {
      "status": "healthy",
      "waiting": 5,
      "active": 2,
      "failed": 0
    }
  }
}
\\\

**Metrics Format (Prometheus):**
\\\
# HELP whatsapp_sessions_total Total number of WhatsApp sessions
# TYPE whatsapp_sessions_total gauge
whatsapp_sessions_total 3

# HELP whatsapp_sessions_connected Number of connected sessions
# TYPE whatsapp_sessions_connected gauge
whatsapp_sessions_connected 2

# HELP webhook_queue_depth Number of webhooks in queue
# TYPE webhook_queue_depth gauge
webhook_queue_depth{status="waiting"} 5
webhook_queue_depth{status="active"} 2
webhook_queue_depth{status="failed"} 0

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
http_requests_total{method="POST",status="201"} 567

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.05"} 1000
http_request_duration_seconds_bucket{le="0.1"} 1500
http_request_duration_seconds_bucket{le="0.5"} 1800
http_request_duration_seconds_sum 450.5
http_request_duration_seconds_count 1800
\\\

**Files to Create/Modify:**
- package.json - Add prom-client dependency
- src/routes/health.ts - Health check endpoints
- src/services/HealthService.ts - Health check logic
- src/metrics/registry.ts - Metrics registry
- src/metrics/collectors.ts - Metric collectors
- src/middleware/metrics.ts - HTTP metrics middleware
- src/routes/metrics.ts - Metrics endpoint

**Implementation Example:**

src/services/HealthService.ts:
\\\	ypescript
import { getRedis } from "../config/redis";
import { getAllSessions } from "./SessionStore";
import { webhookQueue } from "../queues/webhook.queue";

type HealthStatus = "healthy" | "degraded" | "unhealthy";

type HealthCheck = {
  status: HealthStatus;
  latency?: number;
  message?: string;
  [key: string]: any;
};

export class HealthService {
  static async checkRedis(): Promise<HealthCheck> {
    try {
      const start = Date.now();
      const redis = getRedis();
      await redis.ping();
      const latency = Date.now() - start;

      return {
        status: "healthy",
        latency,
        message: "Connected",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  static async checkWhatsApp(): Promise<HealthCheck> {
    try {
      const sessions = await getAllSessions();
      const total = sessions.length;
      
      let connected = 0;
      for (const sessionName of sessions) {
        const session = await getSession(sessionName);
        if (session?.connected) connected++;
      }

      return {
        status: "healthy",
        activeSessions: total,
        connectedSessions: connected,
      };
    } catch (error) {
      return {
        status: "degraded",
        message: error instanceof Error ? error.message : "Check failed",
      };
    }
  }

  static async checkQueue(): Promise<HealthCheck> {
    try {
      const [waiting, active, failed] = await Promise.all([
        webhookQueue.getWaitingCount(),
        webhookQueue.getActiveCount(),
        webhookQueue.getFailedCount(),
      ]);

      const status = failed > 100 ? "degraded" : "healthy";

      return {
        status,
        waiting,
        active,
        failed,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Check failed",
      };
    }
  }

  static async getOverallHealth() {
    const [redis, whatsapp, queue] = await Promise.all([
      this.checkRedis(),
      this.checkWhatsApp(),
      this.checkQueue(),
    ]);

    const checks = { redis, whatsapp, queue };

    // Determine overall status
    let status: HealthStatus = "healthy";
    if (Object.values(checks).some((c) => c.status === "unhealthy")) {
      status = "unhealthy";
    } else if (Object.values(checks).some((c) => c.status === "degraded")) {
      status = "degraded";
    }

    return {
      status,
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: "1.0.0",
      checks,
    };
  }
}
\\\

src/routes/health.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { HealthService } from "../services/HealthService";
import { shutdownManager } from "../utils/shutdown";

export const healthRoutes = new Elysia()
  .get("/health", async ({ set }) => {
    const health = await HealthService.getOverallHealth();

    // Set HTTP status based on health
    if (health.status === "unhealthy") {
      set.status = 503;
    } else if (health.status === "degraded") {
      set.status = 200; // Still accepting traffic
    }

    return health;
  })

  .get("/health/live", ({ set }) => {
    // Liveness: Is process running?
    // Only fail if process is completely dead
    return { alive: true, timestamp: Date.now() };
  })

  .get("/health/ready", async ({ set }) => {
    // Readiness: Can accept traffic?
    if (shutdownManager.isShutdown()) {
      set.status = 503;
      return { ready: false, reason: "shutting_down" };
    }

    const redis = await HealthService.checkRedis();
    if (redis.status === "unhealthy") {
      set.status = 503;
      return { ready: false, reason: "redis_unavailable" };
    }

    return { ready: true, timestamp: Date.now() };
  });
\\\

src/metrics/registry.ts:
\\\	ypescript
import { Registry, collectDefaultMetrics } from "prom-client";

export const register = new Registry();

// Collect default metrics (CPU, memory, GC, etc.)
collectDefaultMetrics({
  register,
  prefix: "whatsapp_bot_",
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

export { register as metricsRegistry };
\\\

src/metrics/collectors.ts:
\\\	ypescript
import { Counter, Gauge, Histogram, register } from "prom-client";
import { metricsRegistry } from "./registry";
import { getAllSessions, getSession } from "../services/SessionStore";
import { webhookQueue } from "../queues/webhook.queue";

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

// WhatsApp Metrics
export const whatsappSessionsTotal = new Gauge({
  name: "whatsapp_sessions_total",
  help: "Total number of WhatsApp sessions",
  registers: [metricsRegistry],
});

export const whatsappSessionsConnected = new Gauge({
  name: "whatsapp_sessions_connected",
  help: "Number of connected WhatsApp sessions",
  registers: [metricsRegistry],
});

export const whatsappMessagesTotal = new Counter({
  name: "whatsapp_messages_total",
  help: "Total WhatsApp messages processed",
  labelNames: ["session", "type", "direction"],
  registers: [metricsRegistry],
});

// Webhook Metrics
export const webhookQueueDepth = new Gauge({
  name: "webhook_queue_depth",
  help: "Number of webhooks in queue",
  labelNames: ["status"],
  registers: [metricsRegistry],
});

export const webhookDeliveryTotal = new Counter({
  name: "webhook_delivery_total",
  help: "Total webhook delivery attempts",
  labelNames: ["status"],
  registers: [metricsRegistry],
});

export const webhookDeliveryDuration = new Histogram({
  name: "webhook_delivery_duration_seconds",
  help: "Webhook delivery latency",
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

// Update metrics periodically
export async function updateBusinessMetrics() {
  try {
    // WhatsApp sessions
    const sessions = await getAllSessions();
    whatsappSessionsTotal.set(sessions.length);

    let connected = 0;
    for (const name of sessions) {
      const session = await getSession(name);
      if (session?.connected) connected++;
    }
    whatsappSessionsConnected.set(connected);

    // Webhook queue
    const [waiting, active, failed, delayed] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
      webhookQueue.getFailedCount(),
      webhookQueue.getDelayedCount(),
    ]);

    webhookQueueDepth.set({ status: "waiting" }, waiting);
    webhookQueueDepth.set({ status: "active" }, active);
    webhookQueueDepth.set({ status: "failed" }, failed);
    webhookQueueDepth.set({ status: "delayed" }, delayed);
  } catch (error) {
    console.error("Failed to update metrics:", error);
  }
}

// Update every 15 seconds
setInterval(updateBusinessMetrics, 15000);
updateBusinessMetrics(); // Initial update
\\\

src/middleware/metrics.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { httpRequestsTotal, httpRequestDuration } from "../metrics/collectors";

export const metricsMiddleware = new Elysia()
  .onRequest(({ store }: any) => {
    store.startTime = Date.now();
  })
  .onAfterHandle(({ request, set, store }: any) => {
    const duration = (Date.now() - store.startTime) / 1000;
    const status = set.status || 200;
    const method = request.method;
    const route = new URL(request.url).pathname;

    httpRequestsTotal.inc({ method, route, status });
    httpRequestDuration.observe({ method, route, status }, duration);
  });
\\\

src/routes/metrics.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { metricsRegistry } from "../metrics/registry";

export const metricsRoutes = new Elysia()
  .get("/metrics", async ({ set }) => {
    set.headers["content-type"] = metricsRegistry.contentType;
    return await metricsRegistry.metrics();
  });
\\\

**Update src/index.ts:**
\\\	ypescript
import { healthRoutes } from "./routes/health";
import { metricsRoutes } from "./routes/metrics";
import { metricsMiddleware } from "./middleware/metrics";

const app = new Elysia()
  .use(cors({ origin: env.CORS_ORIGINS }))
  .use(metricsMiddleware)
  .use(healthRoutes)
  .use(metricsRoutes)
  .use(authMiddleware)
  .use(routes)
  .listen(env.PORT);
\\\

**Prometheus Configuration (prometheus.yml):**
\\\yaml
scrape_configs:
  - job_name: 'whatsapp-bot'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
\\\

**Grafana Dashboard (JSON):**
Create docs/grafana-dashboard.json with panels for:
- Active WhatsApp sessions
- Connected sessions over time
- Webhook queue depth
- Webhook delivery success rate
- HTTP request rate
- HTTP request latency (p50, p95, p99)
- Memory usage
- CPU usage

**Acceptance Criteria:**
1. ✅ /health returns comprehensive status with all checks
2. ✅ /health/live always returns 200 unless process dead
3. ✅ /health/ready returns 503 during shutdown or Redis unavailable
4. ✅ /metrics returns Prometheus-compatible metrics
5. ✅ HTTP metrics collected for all requests
6. ✅ Business metrics updated every 15 seconds
7. ✅ Metrics endpoint tidak require authentication
8. ✅ Health/metrics endpoints tidak tercatat di access logs (noise reduction)

**Testing:**
\\\ash
# Test health endpoint
curl http://localhost:3000/health | jq

# Test liveness
curl http://localhost:3000/health/live

# Test readiness
curl http://localhost:3000/health/ready

# Test metrics
curl http://localhost:3000/metrics

# Verify Prometheus scraping
curl http://localhost:3000/metrics | grep whatsapp_sessions_total
\\\

---

## **TASK 6: Error Handling & Circuit Breaker Pattern**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di resilience patterns, fault tolerance, dan distributed systems.

### **ROLE**
Bertindak sebagai Resilience Engineer yang bertanggung jawab untuk implementing circuit breaker pattern dan comprehensive error handling untuk prevent cascading failures.

### **CONTEXT**

**Current State:**
- Webhook failures retry infinitely via BullMQ
- Tidak ada protection dari downstream service failures
- Error responses tidak consistent
- Tidak ada fallback mechanism
- Redis failures bisa cascade ke seluruh app

**Problems:**
- **Cascading Failures:** Downstream service down → entire app slow
- **Resource Exhaustion:** Retry storms consume all workers
- **Poor UX:** Generic error messages tidak helpful
- **No Resilience:** Dependency failure = app failure

**Requirements:**
1. Implement circuit breaker untuk webhook calls
2. Implement circuit breaker untuk Redis operations
3. Add fallback mechanisms untuk degraded mode
4. Standardize error response format
5. Add custom error classes dengan proper inheritance
6. Implement retry strategies dengan jitter
7. Add error recovery strategies
8. Create error handling documentation

**Technical Specs:**

**Circuit Breaker States:**
- **CLOSED:** Normal operation, all requests pass through
- **OPEN:** Too many failures, all requests fail fast (return fallback)
- **HALF_OPEN:** Test if service recovered (allow limited requests)

**Thresholds:**
- Failure threshold: 50% failure rate in 60s window
- Minimum requests: 10 (don't trip on low traffic)
- Open duration: 30 seconds
- Half-open requests: 3 test requests

**Files to Create/Modify:**
- package.json - Add opossum (circuit breaker library)
- src/utils/circuit-breaker.ts - Circuit breaker wrapper
- src/errors/AppError.ts - Custom error classes
- src/middleware/error-handler.ts - Global error handler
- src/services/WebhookService.ts - Add circuit breaker
- src/config/redis.ts - Add circuit breaker
- docs/ERROR_HANDLING.md - Error handling guide

**Implementation Example:**

src/utils/circuit-breaker.ts:
\\\	ypescript
import CircuitBreaker from "opossum";
import { logger } from "../config/logger";

type CircuitBreakerOptions = {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  name: string;
};

export function createCircuitBreaker<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: CircuitBreakerOptions
): CircuitBreaker<T, R> {
  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout || 5000,
    errorThresholdPercentage: options.errorThresholdPercentage || 50,
    resetTimeout: options.resetTimeout || 30000,
    name: options.name,
  });

  breaker.on("open", () => {
    logger.warn({ circuit: options.name }, "Circuit breaker opened");
  });

  breaker.on("halfOpen", () => {
    logger.info({ circuit: options.name }, "Circuit breaker half-opened");
  });

  breaker.on("close", () => {
    logger.info({ circuit: options.name }, "Circuit breaker closed");
  });

  breaker.on("fallback", (result) => {
    logger.debug({ circuit: options.name, result }, "Circuit breaker fallback triggered");
  });

  return breaker;
}

export function getCircuitBreakerStats(breaker: CircuitBreaker<any, any>) {
  return {
    state: breaker.status.state,
    stats: breaker.stats,
    isOpen: breaker.opened,
    isClosed: breaker.closed,
    isHalfOpen: breaker.halfOpen,
  };
}
\\\

src/errors/AppError.ts:
\\\	ypescript
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public isOperational: boolean = true,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      status: "error",
      message: this.message,
      code: this.code,
      ...(this.context && { context: this.context }),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, "VALIDATION_ERROR", true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR", true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR", true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(\\ not found\, 404, "NOT_FOUND", true, { resource });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, "CONFLICT", true, context);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED", true, { retryAfter });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, reason?: string) {
    super(
      \Service temporarily unavailable: \\,
      503,
      "SERVICE_UNAVAILABLE",
      true,
      { service, reason }
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError: Error) {
    super(
      \External service error: \\,
      502,
      "EXTERNAL_SERVICE_ERROR",
      true,
      { service, originalMessage: originalError.message }
    );
  }
}

export class WhatsAppError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 500, "WHATSAPP_ERROR", true, context);
  }
}
\\\

src/middleware/error-handler.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { AppError } from "../errors/AppError";
import { logger } from "../config/logger";
import { getCorrelationId } from "./correlation";

export const errorHandler = new Elysia()
  .onError(({ error, set, request }) => {
    const correlationId = getCorrelationId();

    // Handle known AppErrors
    if (error instanceof AppError) {
      set.status = error.statusCode;

      logger.error({
        correlationId,
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          context: error.context,
          stack: error.stack,
        },
        request: {
          method: request.method,
          url: request.url,
        },
      });

      return error.toJSON();
    }

    // Handle validation errors from Elysia
    if (error.name === "ValidationError") {
      set.status = 400;
      return {
        status: "error",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        errors: error.message,
      };
    }

    // Handle unknown errors
    logger.error({
      correlationId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      request: {
        method: request.method,
        url: request.url,
      },
      msg: "Unhandled error",
    });

    set.status = 500;
    return {
      status: "error",
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      correlationId,
    };
  });
\\\

**Update WebhookService with Circuit Breaker:**

src/services/WebhookService.ts:
\\\	ypescript
import { createCircuitBreaker } from "../utils/circuit-breaker";
import { ExternalServiceError } from "../errors/AppError";

async function deliverWebhook(
  url: string,
  headers: Record<string, string>,
  payload: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(\HTTP \: \\);
    }

    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw new ExternalServiceError("webhook", error as Error);
  }
}

// Create circuit breaker for webhook delivery
const webhookCircuit = createCircuitBreaker(deliverWebhook, {
  name: "webhook-delivery",
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

// Fallback: Log failure and return gracefully
webhookCircuit.fallback(() => {
  logger.warn("Webhook circuit breaker open, skipping delivery");
  return { ok: false, status: "circuit_open" };
});

export async function sendWebhook(
  url: string,
  headers: Record<string, string>,
  payload: string
) {
  return await webhookCircuit.fire(url, headers, payload);
}

export function getWebhookCircuitStats() {
  return getCircuitBreakerStats(webhookCircuit);
}
\\\

**Update Redis with Circuit Breaker:**

src/config/redis.ts:
\\\	ypescript
import Redis from "ioredis";
import { createCircuitBreaker } from "../utils/circuit-breaker";
import { ServiceUnavailableError } from "../errors/AppError";

let redis: Redis | null = null;
let redisCircuit: CircuitBreaker<any, any> | null = null;

async function connectRedis(): Promise<Redis> {
  if (!redis) {
    redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      lazyConnect: true,
      enableOfflineQueue: false, // Fail fast if disconnected
      maxRetriesPerRequest: 2,
    });

    await redis.connect();
  }
  return redis;
}

// Create circuit breaker for Redis
redisCircuit = createCircuitBreaker(connectRedis, {
  name: "redis",
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

// Fallback: Use in-memory store
redisCircuit.fallback(() => {
  logger.warn("Redis circuit breaker open, using in-memory fallback");
  throw new ServiceUnavailableError("redis", "circuit_breaker_open");
});

export async function getRedis(): Promise<Redis> {
  try {
    return await redisCircuit.fire();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    throw new ServiceUnavailableError("redis", (error as Error).message);
  }
}

export function getRedisCircuitStats() {
  return redisCircuit ? getCircuitBreakerStats(redisCircuit) : null;
}
\\\

**Add Circuit Breaker Stats to Health:**

src/routes/health.ts:
\\\	ypescript
import { getWebhookCircuitStats } from "../services/WebhookService";
import { getRedisCircuitStats } from "../config/redis";

export const healthRoutes = new Elysia()
  .get("/health/circuits", () => {
    return {
      status: "success",
      data: {
        redis: getRedisCircuitStats(),
        webhook: getWebhookCircuitStats(),
      },
    };
  });
\\\

**Retry Strategy with Jitter:**

src/utils/retry.ts:
\\\	ypescript
import { logger } from "../config/logger";

type RetryOptions = {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    ...options,
  };

  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      let delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );

      // Add jitter to prevent thundering herd
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      logger.debug({
        attempt,
        maxAttempts: opts.maxAttempts,
        delay,
        error: lastError.message,
        msg: "Retrying after delay",
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
\\\

**Error Handling Documentation:**

docs/ERROR_HANDLING.md:
\\\markdown
# Error Handling Guide

## Error Response Format

All errors follow this format:
\\\json
{
  "status": "error",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "context": {
    "additional": "context"
  },
  "correlationId": "req_abc123"
}
\\\

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| VALIDATION_ERROR | 400 | Invalid input |
| AUTHENTICATION_ERROR | 401 | Missing/invalid API key |
| AUTHORIZATION_ERROR | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Dependency unavailable |

## Circuit Breaker Behavior

When a circuit breaker opens:
- Requests fail immediately (no retry)
- Returns 503 Service Unavailable
- Check \/health/circuits\ for status

## Retry Strategy

Automatic retries with exponential backoff + jitter:
- Attempt 1: Immediate
- Attempt 2: 1-2 seconds
- Attempt 3: 2-4 seconds
- Max attempts: 3
\\\

**Acceptance Criteria:**
1. ✅ Circuit breaker protects webhook calls
2. ✅ Circuit breaker protects Redis calls
3. ✅ Fallback to in-memory when Redis circuit open
4. ✅ All errors use standardized format
5. ✅ Circuit breaker stats exposed in health check
6. ✅ Retry logic includes jitter
7. ✅ Error documentation complete
8. ✅ Non-operational errors logged with stack traces

---

## **INTEGRATION TASK: Combine All Phase 2 Changes**

### **MODEL**
Kamu adalah Lead Backend Engineer dengan expertise di system integration, testing, dan deployment.

### **ROLE**
Bertindak sebagai Technical Lead yang bertanggung jawab untuk integrating all reliability improvements.

### **CONTEXT**

**Goal:**
Integrate semua 6 tasks di atas menjadi satu cohesive reliability layer.

**Integration Checklist:**
1. ✅ Redis connected dan session state persistent
2. ✅ BullMQ worker running dan processing webhooks
3. ✅ Structured logging active dengan proper levels
4. ✅ Graceful shutdown working dengan all handlers
5. ✅ Health checks comprehensive
6. ✅ Metrics exposed dan scrapable
7. ✅ Circuit breakers protecting external calls
8. ✅ Error handling consistent

**Final Architecture:**

\\\
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                        │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │   Elysia HTTP Server   │
         │  (with health checks)  │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────────────────┐
         │     Middleware Stack              │
         │ - CORS                            │
         │ - Correlation ID                  │
         │ - Logging                         │
         │ - Metrics                         │
         │ - Authentication                  │
         │ - Rate Limiting                   │
         │ - Error Handler                   │
         └───────────┬───────────────────────┘
                     │
         ┌───────────┴───────────────────────┐
         │     Application Layer             │
         │ - Session Management (wa-manager) │
         │ - Message Handling                │
         │ - Webhook Queueing                │
         └───────────┬───────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───┐      ┌────▼────┐      ┌───▼────┐
│ Redis │      │ BullMQ  │      │ WhatsApp│
│(State)│      │(Queue)  │      │ Servers │
└───────┘      └─────────┘      └────────┘
   ▲                ▲                 
   │                │                 
Circuit           Circuit             
Breaker          Breaker             
\\\

**Environment Variables (.env):**
\\\env
# Server
PORT=3000
NODE_ENV=production

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Logging
LOG_LEVEL=info
LOG_DIR=logs

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true

# Circuit Breakers
CIRCUIT_BREAKER_ENABLED=true
WEBHOOK_TIMEOUT=5000
REDIS_TIMEOUT=3000
\\\

**Deployment Checklist:**
- [ ] Redis running dan accessible
- [ ] All environment variables configured
- [ ] Logs directory created
- [ ] Metrics endpoint accessible
- [ ] Health checks returning 200
- [ ] Graceful shutdown tested
- [ ] Circuit breakers tested (simulate failures)
- [ ] Load testing completed
- [ ] Monitoring dashboards created
- [ ] Alerts configured

**Testing Scenarios:**

1. **Redis Failure Test:**
\\\ash
# Stop Redis
docker stop redis

# App should:
# - Use in-memory fallback
# - /health returns "degraded"
# - Circuit breaker opens after threshold
# - /health/circuits shows redis circuit open
\\\

2. **Graceful Shutdown Test:**
\\\ash
# Send traffic
while true; do curl http://localhost:3000/health; sleep 0.1; done &

# Trigger shutdown
kill -SIGTERM <pid>

# Verify:
# - New requests return 503
# - Active requests complete
# - Sessions saved to Redis
# - Clean exit with code 0
\\\

3. **Circuit Breaker Test:**
\\\ash
# Configure webhook to unreachable endpoint
curl -X POST http://localhost:3000/test/webhook/set \\
  -d '{"url":"http://unreachable.example.com"}'

# Send messages to trigger webhooks
# Monitor /health/circuits
# Circuit should open after threshold
\\\

**Success Metrics:**
- ✅ Zero data loss during restart
- ✅ 99.9% webhook delivery success (with retries)
- ✅ <100ms added latency from reliability layer
- ✅ Circuit breakers prevent cascading failures
- ✅ All logs queryable and actionable
- ✅ Graceful shutdown <5 seconds average

**Estimated Timeline:**
- Task 1 (Redis): 1.5 days
- Task 2 (Queue): 1.5 days
- Task 3 (Logging): 1 day
- Task 4 (Shutdown): 1 day
- Task 5 (Health/Metrics): 1.5 days
- Task 6 (Circuit Breaker): 1 day
- Integration & Testing: 1.5 days
- **Total: 9 days** (1 developer, full-time)

---

**Generated:** 2026-07-22T01:52:30Z  
**Status:** ✅ Ready to execute
