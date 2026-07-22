# **PHASE 1 - CRITICAL SECURITY IMPROVEMENTS**

**Generated:** 2026-07-22  
**Purpose:** Security hardening untuk WhatsApp Bot API  
**Timeline:** 6 days (1 developer, full-time)

---

## **TASK 1: Implement API Key Authentication Middleware**

### **MODEL**
Kamu adalah Senior Security Engineer dengan expertise di Elysia framework, TypeScript, dan REST API security best practices.

### **ROLE**
Bertindak sebagai Security Architect yang bertanggung jawab untuk mengamankan WhatsApp Bot API dari unauthorized access.

### **CONTEXT**

**Current State:**
- Semua endpoint terbuka tanpa authentication
- Siapa saja bisa hit `/session/qr/delete/:name` dan hapus session
- Siapa saja bisa kirim pesan via `/:session/message/text`
- CORS hanya filter origin, tapi tidak ada API key validation

**Security Risk:**
- **Severity: CRITICAL**
- Attacker bisa abuse API untuk spam, delete sessions, atau intercept webhooks
- Tidak ada audit trail siapa yang akses endpoint
- Compliance issue (GDPR, data protection)

**Requirements:**
1. Implement API Key authentication menggunakan `X-API-Key` header
2. Create middleware untuk validate API key di semua protected routes
3. Store API keys secara secure di environment variable
4. Return proper HTTP 401/403 untuk unauthorized requests
5. Support multiple API keys (untuk multiple clients)
6. Add basic rate limiting per API key

**Technical Constraints:**
- Framework: Elysia (latest version)
- Runtime: Bun v1.3.14
- TypeScript strict mode
- Zero breaking changes ke existing endpoints

**Files to Create/Modify:**
- `.env.example` - Template untuk environment variables
- `.env` - Actual config (gitignored)
- `src/middleware/auth.ts` - Authentication middleware
- `src/config/env.ts` - Environment config loader
- `src/index.ts` - Apply middleware globally
- `src/routes/*.ts` - Exempt public endpoints (health check)

**Expected Output Structure:**

`.env.example`:
```env
# Server Configuration
PORT=3000
CORS_ORIGINS=http://ams.test,http://localhost:3000

# API Keys (comma-separated, format: key:label)
API_KEYS=sk_live_abc123:production,sk_test_xyz789:staging

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

`src/middleware/auth.ts`:
```typescript
import { Elysia } from "elysia";

// Validate X-API-Key header
// Return 401 if missing, 403 if invalid
// Attach API key metadata to context
```

**Authentication Flow:**
```
Request → Extract X-API-Key header → Validate against env keys → 
  → If valid: proceed + attach key metadata
  → If invalid: return 403 Forbidden
  → If missing: return 401 Unauthorized
```

**Acceptance Criteria:**
1. ✅ Semua endpoint kecuali `GET /` dan `GET /health` require API key
2. ✅ Invalid API key return `{ status: 'error', message: 'Invalid API key' }` (HTTP 403)
3. ✅ Missing API key return `{ status: 'error', message: 'API key required' }` (HTTP 401)
4. ✅ Valid request tetap berfungsi seperti sebelumnya
5. ✅ Environment variables ter-load dengan benar
6. ✅ `.env` ada di `.gitignore`

**Non-Functional Requirements:**
- Performance: Middleware harus <1ms overhead
- Security: API keys minimal 32 characters
- Maintainability: Easy to add/remove keys via `.env`

---

## **TASK 2: Implement Webhook HMAC Signature Validation**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di webhook security, cryptography, dan Baileys WhatsApp Library.

### **ROLE**
Bertindak sebagai Security Engineer yang bertanggung jawab untuk securing webhook delivery dan preventing tampering.

### **CONTEXT**

**Current State:**
- Webhook config menyimpan `secret` field tapi tidak digunakan (WebhookManager.ts:7)
- Payload dikirim ke webhook tanpa signature verification
- Webhook receiver tidak bisa validate apakah payload dari server legitimate
- Risk: Man-in-the-middle attack, payload tampering

**Security Risk:**
- **Severity: HIGH**
- Attacker bisa inject fake messages ke webhook endpoint
- No proof of authenticity
- Tidak ada replay attack protection

**Requirements:**
1. Generate HMAC-SHA256 signature untuk setiap webhook payload
2. Add signature ke HTTP header `X-Webhook-Signature`
3. Add timestamp ke header `X-Webhook-Timestamp` (untuk replay protection)
4. Update webhook delivery logic di `wa-manager.ts`
5. Create utility function untuk compute signature
6. Document signature verification untuk webhook receivers

**Technical Specs:**

**Signature Algorithm:**
```
signature = HMAC-SHA256(secret, timestamp + "." + json_payload)
header = "sha256=" + hex(signature)
```

**HTTP Headers:**
```
X-Webhook-Signature: sha256=a1b2c3d4...
X-Webhook-Timestamp: 1721613276827
Content-Type: application/json
```

**Files to Create/Modify:**
- `src/utils/webhook-signature.ts` - Signature computation
- `src/wa-manager.ts` - Add signature to webhook requests (line 136-143, 172-178)
- `docs/WEBHOOK_SECURITY.md` - Documentation for webhook receivers

**Implementation Example:**

`src/utils/webhook-signature.ts`:
```typescript
import crypto from "crypto";

export function generateWebhookSignature(
  secret: string,
  timestamp: number,
  payload: string
): string {
  const message = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  return `sha256=${hmac.digest("hex")}`;
}

export function verifyWebhookSignature(
  signature: string,
  secret: string,
  timestamp: number,
  payload: string,
  toleranceSeconds = 300
): boolean {
  // Check timestamp freshness (prevent replay)
  const currentTime = Date.now();
  if (Math.abs(currentTime - timestamp) > toleranceSeconds * 1000) {
    return false;
  }

  // Verify signature
  const expected = generateWebhookSignature(secret, timestamp, payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

**Webhook Delivery Update (wa-manager.ts):**
```typescript
// Before (line 136-143):
await fetch(cfg.url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

// After:
const timestamp = Date.now();
const payloadString = JSON.stringify(payload);
const signature = cfg.secret 
  ? generateWebhookSignature(cfg.secret, timestamp, payloadString)
  : null;

const headers: Record<string, string> = {
  "content-type": "application/json",
  "x-webhook-timestamp": timestamp.toString(),
};

if (signature) {
  headers["x-webhook-signature"] = signature;
}

await fetch(cfg.url, {
  method: "POST",
  headers,
  body: payloadString,
});
```

**Documentation (docs/WEBHOOK_SECURITY.md):**
```markdown
# Webhook Security

## Verifying Webhook Signatures

All webhook payloads include:
- `X-Webhook-Signature`: HMAC-SHA256 signature
- `X-Webhook-Timestamp`: Unix timestamp (milliseconds)

### Example Verification (Node.js):
[Include code example]
```

**Acceptance Criteria:**
1. ✅ Webhook dengan `secret` configured kirim signature header
2. ✅ Webhook tanpa `secret` tetap berfungsi (backward compatible)
3. ✅ Signature valid untuk 5 menit (replay protection)
4. ✅ Documentation lengkap dengan code examples (Node.js, PHP, Python)
5. ✅ Unit tests untuk signature generation & verification

---

## **TASK 3: Input Validation & Sanitization**

### **MODEL**
Kamu adalah Senior Security Engineer dengan expertise di input validation, injection attacks, dan secure coding practices.

### **ROLE**
Bertindak sebagai Application Security Specialist yang bertanggung jawab mencegah injection attacks dan malicious input.

### **CONTEXT**

**Current State:**
- `to`, `text`, `filePath` tidak divalidasi (MessageController.ts)
- `url` di webhook config tidak divalidasi (WebhookController.ts:7)
- Risk: Path traversal, command injection, XSS di webhook receivers

**Security Risks:**
- **Path Traversal** di `sendDocumentFile`: `filePath: "../../../etc/passwd"`
- **Invalid Phone Numbers**: `to: "notaphonenumber"` → error tidak jelas
- **Malicious Webhook URL**: `url: "file:///etc/passwd"` → SSRF attack
- **XSS in Text**: `text: "<script>alert(1)</script>"` → jika webhook render HTML

**Requirements:**
1. Install & configure Elysia validation plugin (`@elysiajs/validator` atau custom)
2. Create validation schemas untuk semua request bodies
3. Validate phone numbers (format: 628xxx, length 10-15 digits)
4. Validate file paths (must be absolute, within allowed directories)
5. Validate webhook URLs (must be http/https, no file:// or internal IPs)
6. Sanitize text input (strip dangerous characters jika perlu)
7. Return clear error messages dengan field-level validation

**Technical Specs:**

**Phone Number Validation:**
```typescript
// Valid: 628123456789, 62812345678901234
// Invalid: +62xxx, 08xxx, abc123
const phoneRegex = /^62\d{9,13}$/;
```

**File Path Validation:**
```typescript
// Must be absolute path
// Must exist
// Must not traverse outside project directory
// Prevent: ../../../etc/passwd
```

**Webhook URL Validation:**
```typescript
// Must be http:// or https://
// Must not be localhost/127.0.0.1/internal IPs (unless in dev mode)
// Must be valid URL format
```

**Files to Create/Modify:**
- `src/utils/validation.ts` - Validation helper functions
- `src/schemas/*.ts` - Request validation schemas
- `src/controllers/MessageController.ts` - Apply validation
- `src/controllers/WebhookController.ts` - Apply validation
- `src/middleware/validator.ts` - Global validation middleware

**Example Validation Schema:**

`src/schemas/message.schema.ts`:
```typescript
import { t } from "elysia";

export const sendTextSchema = {
  body: t.Object({
    to: t.String({ 
      minLength: 10, 
      maxLength: 15,
      pattern: "^62\\d{9,13}$",
      error: "Phone number must be in format 62XXXXXXXXX"
    }),
    text: t.String({ 
      minLength: 1, 
      maxLength: 4096,
      error: "Text must be between 1-4096 characters"
    })
  })
};
```

**Error Response Format:**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "to": "Phone number must be in format 62XXXXXXXXX",
    "text": "Text is required"
  }
}
```

**Acceptance Criteria:**
1. ✅ Invalid phone number return 400 dengan error message jelas
2. ✅ Path traversal attempt blocked dengan error
3. ✅ Invalid webhook URL rejected
4. ✅ All validation errors include field name & reason
5. ✅ Valid requests tidak terpengaruh (no breaking changes)
6. ✅ Unit tests untuk semua validation rules

---

## **TASK 4: Environment Configuration Management**

### **MODEL**
Kamu adalah DevOps Engineer dengan expertise di application configuration, secrets management, dan 12-factor app principles.

### **ROLE**
Bertindak sebagai Platform Engineer yang bertanggung jawab untuk externalizing configuration dan removing hardcoded values.

### **CONTEXT**

**Current State:**
- Port hardcoded ke 3000 (index.ts:15)
- CORS origin hardcoded ke `http://ams.test` (index.ts:8)
- Logger level hardcoded ke `silent` (wa-manager.ts:43)
- No environment variable support

**Problems:**
- Tidak bisa deploy ke multiple environments (dev/staging/prod)
- Configuration changes require code changes
- Secrets bisa accidentally committed
- Tidak sesuai 12-factor app principles

**Requirements:**
1. Create `.env` file untuk environment-specific config
2. Create `.env.example` template
3. Create config loader module (`src/config/env.ts`)
4. Support validation untuk required env vars
5. Support default values untuk optional env vars
6. Update all hardcoded values ke env vars
7. Add type-safe config object

**Environment Variables Needed:**

```env
# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGINS=http://ams.test,http://localhost:3000

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log

# Security
API_KEYS=sk_live_xxx:prod,sk_test_yyy:dev

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_ENABLED=true

# Webhook
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_RETRY_ENABLED=false

# WhatsApp
WA_AUTH_DIR=auth_info
WA_DATA_DIR=data
WA_AUTO_RECONNECT=true
```

**Files to Create/Modify:**
- `.env.example` - Template with all variables
- `.env` - Actual config (gitignored)
- `src/config/env.ts` - Config loader with validation
- `src/index.ts` - Use env config
- `src/wa-manager.ts` - Use env config
- `.gitignore` - Ensure `.env` is ignored

**Config Loader Implementation:**

`src/config/env.ts`:
```typescript
import { z } from "zod"; // or custom validation

const envSchema = z.object({
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().transform(s => s.split(",")),
  LOG_LEVEL: z.enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  API_KEYS: z.string().transform(parseApiKeys),
  // ... more fields
});

export const env = envSchema.parse(process.env);

function parseApiKeys(raw: string): Map<string, string> {
  // Parse "key1:label1,key2:label2" format
}
```

**Usage Example:**

```typescript
// Before:
.listen(3000)

// After:
.listen(env.PORT)
```

**Acceptance Criteria:**
1. ✅ All hardcoded values diganti dengan env vars
2. ✅ `.env.example` comprehensive dengan comments
3. ✅ Config validation throw error jika required var missing
4. ✅ Type-safe config object (autocomplete di IDE)
5. ✅ `.env` di-gitignore, tidak ter-commit
6. ✅ App bisa run di dev/staging/prod dengan config berbeda

---

## **TASK 5: Rate Limiting Implementation**

### **MODEL**
Kamu adalah Backend Engineer dengan expertise di API rate limiting, DDoS protection, dan performance optimization.

### **ROLE**
Bertindak sebagai API Reliability Engineer yang bertanggung jawab mencegah API abuse dan ensuring fair usage.

### **CONTEXT**

**Current State:**
- Tidak ada rate limiting
- Attacker bisa spam request tanpa batas
- Bisa cause service degradation atau WhatsApp ban
- Tidak ada protection dari brute force attacks

**Security Risk:**
- **Severity: HIGH**
- API abuse → WhatsApp account banned
- DoS attack via spam requests
- Resource exhaustion (memory/CPU)

**Requirements:**
1. Implement rate limiting per API key
2. Different limits untuk different endpoint types:
   - Message endpoints: 20 req/min
   - Session endpoints: 10 req/min
   - Webhook endpoints: 5 req/min
3. Return proper HTTP 429 (Too Many Requests) dengan Retry-After header
4. Store rate limit state in-memory (upgrade ke Redis later)
5. Configurable via environment variables
6. Bypass rate limiting untuk health check endpoint

**Technical Specs:**

**Rate Limit Strategy:**
- **Algorithm:** Sliding window (more accurate than fixed window)
- **Granularity:** Per API key + endpoint
- **Storage:** In-memory Map (Phase 2: migrate to Redis)
- **Response:** HTTP 429 + JSON error

**Rate Limit Tiers:**
```typescript
const RATE_LIMITS = {
  message: { windowMs: 60000, maxRequests: 20 },
  session: { windowMs: 60000, maxRequests: 10 },
  webhook: { windowMs: 60000, maxRequests: 5 },
  default: { windowMs: 60000, maxRequests: 100 },
};
```

**Response Format (HTTP 429):**
```json
{
  "status": "error",
  "message": "Rate limit exceeded",
  "retryAfter": 45,
  "limit": 20,
  "remaining": 0,
  "resetAt": 1721613300000
}
```

**HTTP Headers:**
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1721613300000
Retry-After: 45
```

**Files to Create/Modify:**
- `src/middleware/rate-limit.ts` - Rate limiting logic
- `src/utils/sliding-window.ts` - Sliding window implementation
- `src/config/env.ts` - Add rate limit config
- `src/routes/*.ts` - Apply rate limiting middleware

**Implementation Example:**

`src/middleware/rate-limit.ts`:
```typescript
import { Elysia } from "elysia";

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const requestLog = new Map<string, number[]>(); // key -> timestamps[]

export function rateLimit(config: RateLimitConfig) {
  return (app: Elysia) => {
    return app.onBeforeHandle(({ headers, set }) => {
      const apiKey = headers["x-api-key"];
      const now = Date.now();
      const key = `${apiKey}:${config.windowMs}`;

      // Get request timestamps within window
      const timestamps = requestLog.get(key) || [];
      const validTimestamps = timestamps.filter(
        ts => now - ts < config.windowMs
      );

      if (validTimestamps.length >= config.maxRequests) {
        const oldestTimestamp = validTimestamps[0];
        const resetAt = oldestTimestamp + config.windowMs;
        const retryAfter = Math.ceil((resetAt - now) / 1000);

        set.status = 429;
        set.headers["retry-after"] = retryAfter.toString();
        set.headers["x-ratelimit-limit"] = config.maxRequests.toString();
        set.headers["x-ratelimit-remaining"] = "0";
        set.headers["x-ratelimit-reset"] = resetAt.toString();

        return {
          status: "error",
          message: "Rate limit exceeded",
          retryAfter,
          limit: config.maxRequests,
          remaining: 0,
          resetAt,
        };
      }

      // Add current request
      validTimestamps.push(now);
      requestLog.set(key, validTimestamps);

      // Set rate limit headers
      const remaining = config.maxRequests - validTimestamps.length;
      set.headers["x-ratelimit-limit"] = config.maxRequests.toString();
      set.headers["x-ratelimit-remaining"] = remaining.toString();
    });
  };
}
```

**Usage:**
```typescript
// In routes/message.ts:
export const messageRoutes = new Elysia({ prefix: "/:session/message" })
  .use(rateLimit({ windowMs: 60000, maxRequests: 20 }))
  .post("/text", MessageController.sendText)
  // ...
```

**Acceptance Criteria:**
1. ✅ Exceed limit return HTTP 429 dengan proper headers
2. ✅ Rate limit reset setelah window expired
3. ✅ Different endpoints punya different limits
4. ✅ Health check endpoint tidak kena rate limit
5. ✅ Rate limit configurable via `.env`
6. ✅ Performance: <0.5ms overhead per request

---

## **INTEGRATION TASK: Combine All Phase 1 Changes**

### **MODEL**
Kamu adalah Lead Backend Engineer dengan expertise di system integration, testing, dan deployment.

### **ROLE**
Bertindak sebagai Technical Lead yang bertanggung jawab untuk integrating all security improvements dan ensuring smooth deployment.

### **CONTEXT**

**Goal:**
Integrate semua 5 tasks di atas menjadi satu cohesive security layer tanpa breaking existing functionality.

**Integration Checklist:**
1. ✅ Semua middleware loaded dalam urutan yang benar
2. ✅ Environment variables ter-load sebelum app start
3. ✅ Authentication → Rate Limiting → Validation → Business Logic
4. ✅ Error handling consistent across all layers
5. ✅ Backward compatibility maintained (optional auth mode untuk migration)

**Final Index.ts Structure:**

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./config/env";
import { authMiddleware } from "./middleware/auth";
import { routes } from "./routes/index";

const app = new Elysia()
  // 1. CORS (must be first)
  .use(cors({
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  }))
  
  // 2. Public routes (no auth needed)
  .get("/", () => "OK")
  .get("/health", () => ({ 
    status: "healthy", 
    timestamp: Date.now(),
    version: "1.0.0" 
  }))
  
  // 3. Authentication (all routes after this need API key)
  .use(authMiddleware)
  
  // 4. Protected routes (with rate limiting & validation)
  .use(routes)
  
  .listen(env.PORT);

console.log(`🦊 Elysia running on http://localhost:${app.server?.port}`);
console.log(`🔒 Authentication: ${env.API_KEYS.size} API keys configured`);
console.log(`📊 Environment: ${env.NODE_ENV}`);
```

**Testing Requirements:**

1. **Manual Testing:**
```bash
# Test 1: No API key → 401
curl http://localhost:3000/session/qr/get/test

# Test 2: Invalid API key → 403
curl -H "X-API-Key: invalid" http://localhost:3000/session/qr/get/test

# Test 3: Valid API key → Success
curl -H "X-API-Key: sk_live_xxx" http://localhost:3000/session/qr/get/test

# Test 4: Rate limit → 429
for i in {1..25}; do curl -H "X-API-Key: sk_live_xxx" http://localhost:3000/session/start/test; done

# Test 5: Invalid phone → 400
curl -H "X-API-Key: sk_live_xxx" -X POST http://localhost:3000/test/message/text \
  -d '{"to":"08123","text":"test"}'

# Test 6: Webhook signature (check headers)
# Trigger incoming message → inspect webhook request
```

2. **Automated Tests** (create `tests/security.test.ts`):
```typescript
import { describe, it, expect } from "bun:test";

describe("Security Layer", () => {
  it("should reject requests without API key", async () => {
    // ...
  });
  
  it("should reject requests with invalid API key", async () => {
    // ...
  });
  
  it("should enforce rate limits", async () => {
    // ...
  });
  
  it("should validate phone numbers", async () => {
    // ...
  });
  
  it("should sign webhook payloads", async () => {
    // ...
  });
});
```

**Documentation Updates:**

Create `docs/SECURITY.md`:
```markdown
# Security Documentation

## Authentication
- All endpoints require `X-API-Key` header
- Get your API key from admin
- Keep API keys secret

## Rate Limits
- Message endpoints: 20 req/min
- Session endpoints: 10 req/min
- Contact admin for higher limits

## Webhook Security
- All webhooks signed with HMAC-SHA256
- Verify signature before processing
- Check timestamp to prevent replay

## Input Validation
- Phone numbers: 62XXXXXXXXX format
- File paths: Absolute paths only
- Text: Max 4096 characters
```

**Migration Guide (for existing users):**

Create `docs/MIGRATION_V2.md`:
```markdown
# Migration Guide: v1 → v2 (Security Update)

## Breaking Changes
1. All requests now require `X-API-Key` header
2. Phone number format must be 62XXX (no +, no 08)
3. Webhook payloads now include signature headers

## Migration Steps
1. Get your API key from admin
2. Update all API calls to include `X-API-Key` header
3. Update phone number formatting
4. (Optional) Implement webhook signature verification

## Backward Compatibility Mode
Set `REQUIRE_API_KEY=false` in `.env` for grace period (not recommended for production)
```

**Deployment Checklist:**
- [ ] Create `.env` from `.env.example`
- [ ] Generate secure API keys (min 32 chars)
- [ ] Update CORS origins
- [ ] Set appropriate rate limits
- [ ] Test all endpoints with Postman/Insomnia
- [ ] Run automated tests: `bun test`
- [ ] Update client applications with API keys
- [ ] Monitor logs for authentication errors
- [ ] Document API keys securely (password manager)

**Rollback Plan:**
If deployment fails:
1. Set `REQUIRE_API_KEY=false` untuk disable auth temporarily
2. Revert code to previous version via git
3. Investigate errors in logs
4. Fix issues and redeploy

**Success Metrics:**
- ✅ Zero unauthorized access attempts succeed
- ✅ Rate limiting prevents >95% of abuse attempts
- ✅ All webhook signatures validate correctly
- ✅ API response time increase <10ms
- ✅ Zero false positives (valid requests blocked)

**Estimated Timeline:**
- Task 1 (Auth): 1 day
- Task 2 (Webhook): 1 day
- Task 3 (Validation): 1 day
- Task 4 (Config): 0.5 day
- Task 5 (Rate Limit): 1 day
- Integration & Testing: 1.5 days
- **Total: 6 days** (1 developer, full-time)

---

**READY TO START?** Mulai dari Task 1, lalu proceed sequentially. Setiap task harus pass acceptance criteria sebelum lanjut ke next task.
