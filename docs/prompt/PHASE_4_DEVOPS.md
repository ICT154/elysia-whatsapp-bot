# **PHASE 4 - DEVOPS & DEPLOYMENT**

**Generated:** 2026-07-22  
**Purpose:** Production-ready deployment, automation, and operational excellence  
**Timeline:** 7-10 days (1 developer, full-time)

---

## **OVERVIEW**

Phase 4 focuses pada production deployment, automation, dan operational excellence setelah semua features (Phase 1-3) selesai. Goals utama:
- Dockerize application untuk consistent deployment
- Setup CI/CD pipeline untuk automated testing & deployment
- Add comprehensive unit/integration tests
- Setup monitoring & alerting infrastructure
- Write deployment documentation & runbooks
- Performance optimization

**Prerequisites:**
- ✅ Phase 1 completed (Security layer)
- ✅ Phase 2 completed (Reliability layer)
- ✅ Phase 3 completed (All features)

---

## **TASK 1: Dockerize Application**

### **MODEL**
Kamu adalah Senior DevOps Engineer dengan expertise di Docker, container orchestration, dan multi-stage builds.

### **ROLE**
Bertindak sebagai Infrastructure Engineer yang bertanggung jawab untuk containerizing application dan creating production-ready Docker setup.

### **CONTEXT**

**Current State:**
- Application runs directly dengan Bun
- Tidak ada containerization
- Tidak ada Docker setup
- Environment-dependent deployment

**Problems:**
- **Inconsistent Environments:** "Works on my machine" syndrome
- **Difficult Deployment:** Manual setup process
- **No Isolation:** Dependencies conflict
- **Poor Scalability:** Hard to scale horizontally

**Requirements:**
1. Create multi-stage Dockerfile for production
2. Create docker-compose.yml untuk local development
3. Add .dockerignore untuk optimize build
4. Create separate images (app, worker, nginx)
5. Setup health checks di containers
6. Optimize image size (<200MB)
7. Add Docker documentation

**Technical Specs:**

**Multi-Stage Build Strategy:**
`
Stage 1: Dependencies (base)
Stage 2: Build (if needed)
Stage 3: Production (minimal runtime)
`

**Container Architecture:**
`
┌─────────────────────────────────────────┐
│         Nginx (Reverse Proxy)           │
│           Port 80/443                   │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
┌────────▼─────┐  ┌──────▼────────┐
│  App Server  │  │ Worker Server │
│  (Elysia)    │  │  (BullMQ)     │
└────────┬─────┘  └──────┬────────┘
         │                │
    ┌────┴────────────────┴────┐
    │                           │
┌───▼────┐              ┌──────▼───┐
│ Redis  │              │ (External│
│        │              │ WhatsApp)│
└────────┘              └──────────┘
`

**Files to Create:**
- Dockerfile - Production image
- Dockerfile.dev - Development image
- docker-compose.yml - Full stack
- docker-compose.dev.yml - Dev stack
- .dockerignore - Build optimization
- nginx.conf - Nginx configuration
- docs/DOCKER.md - Docker guide

**Implementation Example:**

Dockerfile:
\\\dockerfile
# Stage 1: Base dependencies
FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \\
    ca-certificates \\
    tini

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies
RUN bun install --production --frozen-lockfile

# Stage 3: Build (if needed for TypeScript)
FROM base AS build
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including dev)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build application (if needed)
# RUN bun run build

# Stage 4: Production
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S bunuser && \\
    adduser -S bunuser -u 1001

# Copy dependencies from deps stage
COPY --from=deps --chown=bunuser:bunuser /app/node_modules ./node_modules

# Copy application code
COPY --chown=bunuser:bunuser . .

# Create necessary directories
RUN mkdir -p logs auth_info data && \\
    chown -R bunuser:bunuser logs auth_info data

# Switch to non-root user
USER bunuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \\
    CMD bun run -e 'fetch("http://localhost:3000/health/live").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["bun", "run", "src/index.ts"]
\\\

docker-compose.yml:
\\\yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: whatsapp-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - whatsapp-network

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: whatsapp-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    volumes:
      - ./auth_info:/app/auth_info
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    networks:
      - whatsapp-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: whatsapp-worker
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    command: ["bun", "run", "src/workers/webhook.worker.ts"]
    volumes:
      - ./logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - whatsapp-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: whatsapp-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - whatsapp-network

volumes:
  redis_data:
    driver: local

networks:
  whatsapp-network:
    driver: bridge
\\\

nginx.conf:
\\\
ginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '\ - \ [\] "\" '
                    '\ \ "\" '
                    '"\" "\"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;

    # Rate limiting
    limit_req_zone \ zone=api_limit:10m rate=100r/s;
    limit_req_status 429;

    # Upstream backend
    upstream whatsapp_backend {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;

        # Health check endpoint (no rate limit)
        location /health {
            proxy_pass http://whatsapp_backend;
            proxy_http_version 1.1;
            proxy_set_header Host \System.Management.Automation.Internal.Host.InternalHost;
            access_log off;
        }

        # API endpoints (with rate limit)
        location / {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://whatsapp_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \System.Management.Automation.Internal.Host.InternalHost;
            proxy_set_header X-Real-IP \;
            proxy_set_header X-Forwarded-For \;
            proxy_set_header X-Forwarded-Proto \;
            proxy_cache_bypass \;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }

    # HTTPS configuration (uncomment when SSL is ready)
    # server {
    #     listen 443 ssl http2;
    #     server_name your-domain.com;
    #
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #
    #     # Same location blocks as above
    # }
}
\\\

.dockerignore:
\\\
# Git
.git
.gitignore

# Dependencies
node_modules

# Environment
.env
.env.*
!.env.example

# Logs
logs
*.log

# Data
auth_info
data

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Documentation
docs
README.md

# CI/CD
.github
.gitlab-ci.yml

# Build artifacts
dist
build
*.tsbuildinfo
\\\

**Docker Commands:**

\\\ash
# Build image
docker build -t whatsapp-bot-api:latest .

# Build with specific tag
docker build -t whatsapp-bot-api:1.0.0 .

# Run single container
docker run -d \\
  --name whatsapp-bot \\
  -p 3000:3000 \\
  -v \D:\belajar\bun\whatsapp-bot-api/auth_info:/app/auth_info \\
  -v \D:\belajar\bun\whatsapp-bot-api/data:/app/data \\
  --env-file .env \\
  whatsapp-bot-api:latest

# Start full stack
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale workers
docker-compose up -d --scale worker=3

# Stop stack
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Clean up
docker-compose down -v --remove-orphans
\\\

**Acceptance Criteria:**
1. ✅ Multi-stage Dockerfile builds successfully
2. ✅ Image size <200MB
3. ✅ docker-compose stack starts completely
4. ✅ Health checks working
5. ✅ Non-root user in containers
6. ✅ Volumes persist data correctly
7. ✅ Nginx reverse proxy working
8. ✅ Logs accessible and rotating
9. ✅ Environment variables loaded
10. ✅ Zero downtime restart possible

---

## **TASK 2: Setup CI/CD Pipeline (GitHub Actions)**

### **MODEL**
Kamu adalah Senior DevOps Engineer dengan expertise di CI/CD, GitHub Actions, dan automated testing pipelines.

### **ROLE**
Bertindak sebagai CI/CD Engineer yang bertanggung jawab untuk automating build, test, and deployment processes.

### **CONTEXT**

**Current State:**
- Manual build process
- No automated testing
- Manual deployment
- No quality gates

**Problems:**
- **Human Error:** Manual steps prone to mistakes
- **Slow Deployment:** Takes hours to deploy
- **No Testing:** Changes deployed without validation
- **Poor Visibility:** No build/deployment status

**Requirements:**
1. Create CI pipeline (lint, test, build)
2. Create CD pipeline (deploy to staging/production)
3. Add automated testing on PR
4. Implement branch protection rules
5. Add deployment approval gates
6. Setup Docker image publishing
7. Add badge status to README

**Technical Specs:**

**CI/CD Flow:**
```
Push/PR → Lint → Test → Build → Docker Build → 
  → Deploy to Staging → Manual Approval → Deploy to Production
```

**Branch Strategy:**
- main → Production
- develop → Staging
- feature/* → Feature branches (CI only)
- hotfix/* → Hotfix branches

**Files to Create:**
- .github/workflows/ci.yml - Continuous Integration
- .github/workflows/cd.yml - Continuous Deployment
- .github/workflows/pr.yml - Pull Request checks
- .github/dependabot.yml - Dependency updates
- scripts/deploy.sh - Deployment script

**GitHub Actions examples dan deployment scripts tersedia di dokumentasi GitHub Actions official.**

**GitHub Secrets Required:**
```
DOCKER_USERNAME
DOCKER_PASSWORD
SSH_PRIVATE_KEY
SSH_USER
SERVER_HOST
SLACK_WEBHOOK (optional)
```

**Branch Protection Rules:**
- Require pull request before merging
- Require status checks to pass (lint, test, build)
- Require approvals: 1
- Dismiss stale approvals
- Require linear history
- Include administrators

**Acceptance Criteria:**
1. ✅ CI runs on every push/PR
2. ✅ All tests pass before merge
3. ✅ Docker image built and pushed
4. ✅ Automated deployment to staging
5. ✅ Manual approval for production
6. ✅ Zero downtime deployment
7. ✅ Rollback on health check failure
8. ✅ Slack notifications working
9. ✅ Security scan integrated
10. ✅ Badge status in README

---


## **TASK 3: Comprehensive Testing Suite**

### **MODEL**
Kamu adalah Senior QA Engineer dengan expertise di test automation, TDD, dan quality assurance.

### **ROLE**
Bertindak sebagai Test Engineer yang bertanggung jawab untuk implementing comprehensive test coverage.

### **CONTEXT**

**Current State:**
- Zero test coverage
- No testing framework setup
- Manual testing only
- No test documentation

**Problems:**
- **No Confidence:** Can't verify changes don't break existing features
- **Regression Bugs:** Old bugs reappear
- **Slow Development:** Manual testing takes too long
- **Poor Quality:** Bugs reach production

**Requirements:**
1. Setup Bun test framework
2. Write unit tests (target: 80% coverage)
3. Write integration tests
4. Write E2E tests for critical flows
5. Add test fixtures and factories
6. Setup test database/Redis
7. Add test documentation

**Technical Specs:**

**Test Pyramid:**
```
        E2E Tests (10%)
       /              \
    Integration (30%)
   /                    \
  Unit Tests (60%)
```

**Test Coverage Targets:**
- Unit tests: 80%
- Integration tests: Critical paths
- E2E tests: Happy paths

**Files to Create:**
- tests/unit/ - Unit tests
- tests/integration/ - Integration tests
- tests/e2e/ - End-to-end tests
- tests/fixtures/ - Test data
- tests/helpers/ - Test utilities
- tests/setup.ts - Test setup

**Implementation Example:**

tests/setup.ts:
```typescript
import { beforeAll, afterAll, beforeEach } from "bun:test";
import { getRedis, closeRedis } from "../src/config/redis";

// Setup test environment
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.REDIS_DB = "1"; // Use different DB for tests
});

// Clean up after each test
beforeEach(async () => {
  const redis = getRedis();
  await redis.flushdb(); // Clear test database
});

// Cleanup after all tests
afterAll(async () => {
  await closeRedis();
});
```

tests/unit/services/MessageService.test.ts:
```typescript
import { describe, it, expect, mock } from "bun:test";
import { MessageService } from "../../../src/services/MessageService";

describe("MessageService", () => {
  describe("sendText", () => {
    it("should send text message successfully", async () => {
      const mockSock = {
        sendMessage: mock(() => Promise.resolve({
          key: { id: "test_msg_123" }
        })),
      };

      // Mock getSockOrThrow
      const result = await MessageService.sendText("test1", "628123456789", "Hello");

      expect(result.ok).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should throw error for invalid session", async () => {
      expect(async () => {
        await MessageService.sendText("invalid_session", "628123", "Hello");
      }).toThrow();
    });
  });
});
```

tests/integration/api/message.test.ts:
```typescript
import { describe, it, expect, beforeAll } from "bun:test";

describe("Message API Integration", () => {
  let apiKey: string;
  let sessionName: string;

  beforeAll(() => {
    apiKey = process.env.TEST_API_KEY || "test_key";
    sessionName = "test_session";
  });

  describe("POST /:session/message/text", () => {
    it("should send text message with valid API key", async () => {
      const response = await fetch(`http://localhost:3000/${sessionName}/message/text`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "628123456789",
          text: "Test message",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("success");
      expect(data.data.messageId).toBeDefined();
    });

    it("should reject request without API key", async () => {
      const response = await fetch(`http://localhost:3000/${sessionName}/message/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "628123456789",
          text: "Test",
        }),
      });

      expect(response.status).toBe(401);
    });

    it("should validate phone number format", async () => {
      const response = await fetch(`http://localhost:3000/${sessionName}/message/text`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "invalid_phone",
          text: "Test",
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});
```

tests/e2e/message-flow.test.ts:
```typescript
import { describe, it, expect } from "bun:test";

describe("E2E: Complete Message Flow", () => {
  it("should complete full message lifecycle", async () => {
    const apiKey = process.env.TEST_API_KEY;
    const session = "e2e_test";
    const recipient = "628123456789";

    // 1. Start session
    let response = await fetch(`http://localhost:3000/session/start/${session}`, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
    });
    expect(response.status).toBe(200);

    // 2. Send message
    response = await fetch(`http://localhost:3000/${session}/message/text`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: recipient,
        text: "E2E Test Message",
      }),
    });
    expect(response.status).toBe(200);
    const sendResult = await response.json();
    const messageId = sendResult.data.messageId;

    // 3. Check message status
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for processing

    response = await fetch(
      `http://localhost:3000/${session}/message/${messageId}/status`,
      {
        headers: { "X-API-Key": apiKey },
      }
    );
    expect(response.status).toBe(200);
    const statusResult = await response.json();
    expect(statusResult.data.status).toMatch(/pending|sent|delivered/);

    // 4. Verify message in history
    response = await fetch(`http://localhost:3000/${session}/message/history?limit=1`, {
      headers: { "X-API-Key": apiKey },
    });
    expect(response.status).toBe(200);
    const historyResult = await response.json();
    expect(historyResult.data.messages).toHaveLength(1);
    expect(historyResult.data.messages[0].id).toBe(messageId);
  });
});
```

tests/helpers/factories.ts:
```typescript
// Test data factories
export const factories = {
  message: (overrides = {}) => ({
    id: `msg_${Date.now()}`,
    sessionName: "test_session",
    to: "628123456789",
    type: "text",
    content: "Test message",
    status: "pending",
    sentAt: Date.now(),
    ...overrides,
  }),

  bulkJob: (overrides = {}) => ({
    id: `bulk_${Date.now()}`,
    sessionName: "test_session",
    totalRecipients: 10,
    sent: 0,
    failed: 0,
    pending: 10,
    status: "pending",
    createdAt: Date.now(),
    ...overrides,
  }),

  contact: (overrides = {}) => ({
    id: "628123456789@s.whatsapp.net",
    name: "Test Contact",
    isOnWhatsApp: true,
    ...overrides,
  }),
};
```

package.json (update):
```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:e2e": "bun test tests/e2e",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

**Test Commands:**
```bash
# Run all tests
bun test

# Run specific test suite
bun test tests/unit/services/MessageService.test.ts

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch

# Run only integration tests
bun test tests/integration

# Run E2E tests (requires running server)
bun test tests/e2e
```

**Acceptance Criteria:**
1. ✅ Test framework setup complete
2. ✅ Unit test coverage >80%
3. ✅ Integration tests for all endpoints
4. ✅ E2E tests for critical flows
5. ✅ All tests pass in CI
6. ✅ Test fixtures available
7. ✅ Test documentation complete
8. ✅ Coverage report generated

---


## **TASK 4: Monitoring & Alerting Infrastructure**

### **MODEL**
Kamu adalah Senior SRE dengan expertise di monitoring, observability, Prometheus, Grafana, dan alerting systems.

### **ROLE**
Bertindak sebagai Site Reliability Engineer yang bertanggung jawab untuk implementing comprehensive monitoring dan alerting infrastructure.

### **CONTEXT**

**Current State:**
- Basic metrics endpoint (Phase 2)
- No visualization dashboard
- No alerting system
- No log aggregation

**Problems:**
- **No Visibility:** Can't see system health in real-time
- **Reactive:** Only know about issues when users report
- **No Trends:** Can't analyze historical data
- **Poor Debugging:** Hard to troubleshoot production issues

**Requirements:**
1. Setup Prometheus for metrics collection
2. Setup Grafana for visualization
3. Create comprehensive dashboards
4. Setup Alertmanager for alerts
5. Configure alert rules
6. Setup log aggregation (Loki)
7. Add on-call rotation (PagerDuty/Opsgenie)

**Technical Specs:**

**Monitoring Stack:**
```
Application → Prometheus → Grafana
                ↓
           Alertmanager → Slack/PagerDuty
                ↓
              Logs → Loki → Grafana
```

**Metrics to Monitor:**
- System: CPU, memory, disk, network
- Application: Request rate, latency, errors
- Business: Active sessions, message count, webhook success rate
- Dependencies: Redis health, WhatsApp connection status

**Files to Create:**
- docker-compose.monitoring.yml - Monitoring stack
- prometheus.yml - Prometheus config
- alertmanager.yml - Alert config
- grafana/dashboards/ - Dashboard definitions
- grafana/provisioning/ - Auto-provisioning
- docs/MONITORING.md - Monitoring guide

**Implementation Example:**

docker-compose.monitoring.yml:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_INSTALL_PLUGINS=redis-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on:
      - prometheus
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    restart: unless-stopped
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - monitoring

  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    restart: unless-stopped
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml:ro
      - ../logs:/var/log/app:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    networks:
      - monitoring

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:

networks:
  monitoring:
    driver: bridge
```

prometheus.yml:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'whatsapp-bot'
    environment: 'production'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alerts.yml'

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'whatsapp-bot'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

alerts.yml:
```yaml
groups:
  - name: application
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} for {{ $labels.instance }}"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time"
          description: "95th percentile latency is {{ $value }}s"

      - alert: WebhookQueueBacklog
        expr: webhook_queue_depth{status="waiting"} > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Webhook queue backlog"
          description: "{{ $value }} webhooks waiting in queue"

      - alert: SessionDisconnected
        expr: whatsapp_sessions_connected < whatsapp_sessions_total
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "WhatsApp session disconnected"
          description: "Some sessions are disconnected"

  - name: infrastructure
    interval: 30s
    rules:
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}%"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low"
          description: "Only {{ $value | humanizePercentage }} disk space available"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is down"
          description: "Redis instance is not reachable"
```

alertmanager.yml:
```yaml
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    - match:
        severity: warning
      receiver: 'slack-notifications'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
```

grafana/dashboards/overview.json (simplified):
```json
{
  "dashboard": {
    "title": "WhatsApp Bot - Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Sessions",
        "targets": [
          {
            "expr": "whatsapp_sessions_connected"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Webhook Queue",
        "targets": [
          {
            "expr": "webhook_queue_depth"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

**Grafana Dashboards to Create:**
1. Overview Dashboard
   - Request rate, error rate, latency
   - Active sessions, connected sessions
   - Webhook queue depth
   - System resources (CPU, memory)

2. Performance Dashboard
   - P50, P95, P99 latency
   - Request throughput
   - Cache hit rate
   - Database query time

3. Business Metrics Dashboard
   - Messages sent/received
   - Webhook delivery success rate
   - Bulk job completion rate
   - Active groups

4. Infrastructure Dashboard
   - CPU, memory, disk usage
   - Network I/O
   - Container health
   - Redis performance

**Alert Routing:**
```
Critical → PagerDuty → On-call engineer
Warning → Slack → Team channel
Info → Logs only
```

**Acceptance Criteria:**
1. ✅ Prometheus scraping metrics every 15s
2. ✅ Grafana dashboards operational
3. ✅ All critical alerts configured
4. ✅ Alertmanager routing to Slack
5. ✅ PagerDuty integration working
6. ✅ Log aggregation with Loki
7. ✅ Historical data retained (30 days)
8. ✅ Monitoring documentation complete

---


## **TASK 5: Performance Optimization**

### **MODEL**
Kamu adalah Senior Performance Engineer dengan expertise di profiling, optimization, caching strategies, dan scalability.

### **ROLE**
Bertindak sebagai Performance Engineer yang bertanggung jawab untuk optimizing application performance untuk production workloads.

### **CONTEXT**

**Current State:**
- No performance optimization
- No caching strategy
- No database query optimization
- No connection pooling
- No load testing

**Problems:**
- **Slow Response Times:** Some endpoints take >1s
- **High Memory Usage:** Memory leaks possible
- **Poor Throughput:** Limited concurrent requests
- **Database Bottleneck:** Redis queries not optimized

**Requirements:**
1. Profile application for bottlenecks
2. Implement caching strategies
3. Optimize database queries
4. Add connection pooling
5. Optimize WhatsApp session management
6. Add request batching
7. Load test and benchmark

**Technical Specs:**

**Performance Targets:**
- API response time: P95 <200ms, P99 <500ms
- Throughput: >1000 req/s
- Memory usage: <512MB per instance
- CPU usage: <70% under load
- Webhook delivery: <100ms enqueue time

**Optimization Areas:**
1. Redis connection pooling
2. Response caching
3. Batch operations
4. Lazy loading
5. Query optimization
6. Memory management

**Files to Create/Modify:**
- src/cache/CacheManager.ts - Caching layer
- src/utils/pool.ts - Connection pooling
- src/utils/batch.ts - Batch operations
- tests/load/scenarios.js - Load test scenarios
- docs/PERFORMANCE.md - Performance guide

**Implementation Example:**

src/cache/CacheManager.ts:
```typescript
import { getRedis } from "../config/redis";
import { logger } from "../config/logger";

type CacheOptions = {
  ttl?: number; // seconds
  prefix?: string;
};

export class CacheManager {
  private static prefix = "cache:";

  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedis();
      const cached = await redis.get(`${this.prefix}${key}`);
      
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error({ key, error }, "Cache get failed");
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      const redis = getRedis();
      await redis.setex(
        `${this.prefix}${key}`,
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      logger.error({ key, error }, "Cache set failed");
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.del(`${this.prefix}${key}`);
    } catch (error) {
      logger.error({ key, error }, "Cache delete failed");
    }
  }

  static async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // Execute function
    const result = await fn();

    // Store in cache
    await this.set(key, result, options.ttl || 300);

    return result;
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const redis = getRedis();
      const keys = await redis.keys(`${this.prefix}${pattern}`);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error({ pattern, error }, "Cache invalidation failed");
    }
  }
}
```

**Usage Example:**
```typescript
// Cache contact list for 5 minutes
export async function getContactList(session: string) {
  return await CacheManager.wrap(
    `contacts:${session}`,
    async () => {
      // Expensive operation
      const contacts = await fetchFromWhatsApp(session);
      return contacts;
    },
    { ttl: 300 }
  );
}
```

src/utils/batch.ts:
```typescript
type BatchOptions = {
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
};

export class BatchProcessor<T, R> {
  private queue: Array<{
    item: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
  }> = [];

  private timer: Timer | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: BatchOptions = { maxBatchSize: 100, maxWaitTime: 50 }
  ) {}

  async add(item: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ item, resolve, reject });

      if (this.queue.length >= this.options.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.options.maxWaitTime);
      }
    });
  }

  private async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);
    const items = batch.map((b) => b.item);

    try {
      const results = await this.processor(items);

      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach((b) => {
        b.reject(error as Error);
      });
    }
  }
}

// Usage: Batch Redis operations
const redisBatch = new BatchProcessor(
  async (keys: string[]) => {
    const redis = getRedis();
    return await redis.mget(...keys);
  },
  { maxBatchSize: 100, maxWaitTime: 10 }
);
```

**Redis Connection Pooling:**
```typescript
import Redis from "ioredis";

const pool: Redis[] = [];
const POOL_SIZE = 10;

export function getRedisFromPool(): Redis {
  if (pool.length < POOL_SIZE) {
    const client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      lazyConnect: true,
    });
    pool.push(client);
  }

  // Round-robin selection
  return pool[Math.floor(Math.random() * pool.length)];
}
```

**Query Optimization:**
```typescript
// Before: N+1 queries
for (const session of sessions) {
  const status = await getSessionStatus(session); // N queries
}

// After: Single batch query
const statuses = await getSessionStatuses(sessions); // 1 query
```

**Load Testing with k6:**

tests/load/scenarios.js:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 200 }, // Ramp to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // 95% <200ms, 99% <500ms
    http_req_failed: ['rate<0.01'], // Error rate <1%
  },
};

const BASE_URL = 'http://localhost:3000';
const API_KEY = __ENV.API_KEY;

export default function () {
  // Test 1: Health check (warm-up)
  let res = http.get(`${BASE_URL}/health`, {
    headers: { 'X-API-Key': API_KEY },
  });
  check(res, { 'health check ok': (r) => r.status === 200 });

  sleep(1);

  // Test 2: Send message
  res = http.post(
    `${BASE_URL}/test1/message/text`,
    JSON.stringify({
      to: '628123456789',
      text: 'Load test message',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
    }
  );
  check(res, {
    'send message ok': (r) => r.status === 200,
    'response time ok': (r) => r.timings.duration < 500,
  });

  sleep(2);

  // Test 3: Get message history
  res = http.get(`${BASE_URL}/test1/message/history?limit=10`, {
    headers: { 'X-API-Key': API_KEY },
  });
  check(res, { 'get history ok': (r) => r.status === 200 });

  sleep(1);
}
```

**Run Load Test:**
```bash
# Install k6
brew install k6  # macOS
# or
choco install k6  # Windows

# Run test
k6 run tests/load/scenarios.js
```

**Profiling with Bun:**
```bash
# CPU profiling
bun --cpu-prof src/index.ts

# Heap profiling
bun --heap-prof src/index.ts

# Generate markdown CPU profile
bun --cpu-prof --cpu-prof-md src/index.ts
```

**Memory Optimization:**
```typescript
// Use WeakMap for caching objects
const sessionCache = new WeakMap();

// Clear large objects after use
async function processLargeData(data: any[]) {
  try {
    // Process
    const result = await process(data);
    return result;
  } finally {
    // Clear reference
    data.length = 0;
  }
}

// Use streaming for large responses
export async function* streamMessages(session: string) {
  const cursor = 0;
  const limit = 100;

  while (true) {
    const messages = await getMessages(session, cursor, limit);
    if (messages.length === 0) break;

    yield messages;
    cursor += limit;
  }
}
```

**Optimization Checklist:**
- ✅ Add response caching (5min TTL for read-heavy endpoints)
- ✅ Implement Redis connection pooling
- ✅ Batch Redis operations
- ✅ Optimize database queries (use MGET instead of multiple GETs)
- ✅ Add lazy loading for large datasets
- ✅ Implement pagination (all list endpoints)
- ✅ Use streaming for large responses
- ✅ Optimize JSON serialization
- ✅ Add CDN for static assets (if any)
- ✅ Enable HTTP/2

**Acceptance Criteria:**
1. ✅ P95 latency <200ms
2. ✅ P99 latency <500ms
3. ✅ Throughput >1000 req/s
4. ✅ Memory usage <512MB
5. ✅ CPU usage <70% under load
6. ✅ Load test passes all thresholds
7. ✅ No memory leaks detected
8. ✅ Performance documentation complete

---


## **TASK 6: Documentation & Runbooks**

### **MODEL**
Kamu adalah Senior Technical Writer dengan expertise di API documentation, operational procedures, dan knowledge management.

### **ROLE**
Bertindak sebagai Documentation Engineer yang bertanggung jawab untuk creating comprehensive documentation untuk development, operations, dan end-users.

### **CONTEXT**

**Current State:**
- Basic README only
- No API documentation
- No operational procedures
- No troubleshooting guides
- No architecture diagrams

**Problems:**
- **Knowledge Silos:** Only developers know how things work
- **Slow Onboarding:** New team members take weeks to understand
- **Incident Resolution:** No playbooks for common issues
- **Poor User Experience:** Users struggle with API usage

**Requirements:**
1. Create comprehensive API documentation
2. Write deployment runbooks
3. Create troubleshooting guides
4. Document architecture & design decisions
5. Write operational procedures
6. Create user guides
7. Add code examples & tutorials

**Technical Specs:**

**Documentation Structure:**
```
docs/
├── README.md                    # Project overview
├── API.md                       # Complete API reference
├── ARCHITECTURE.md              # System architecture
├── DEPLOYMENT.md                # Deployment guide
├── MONITORING.md                # Monitoring guide (Phase 2)
├── SECURITY.md                  # Security guide (Phase 1)
├── TROUBLESHOOTING.md           # Common issues & solutions
├── RUNBOOKS.md                  # Operational procedures
├── CONTRIBUTING.md              # Contribution guidelines
├── CHANGELOG.md                 # Version history
├── examples/                    # Code examples
│   ├── nodejs/
│   ├── python/
│   └── php/
└── diagrams/                    # Architecture diagrams
    ├── architecture.png
    ├── data-flow.png
    └── deployment.png
```

**Files to Create:**

docs/DEPLOYMENT.md:
```markdown
# Deployment Guide

## Prerequisites
- Docker & Docker Compose installed
- Redis 7+ running
- SSL certificate (for HTTPS)
- Minimum 2GB RAM, 2 CPU cores

## Environment Setup

1. Clone repository
\`\`\`bash
git clone https://github.com/yourorg/whatsapp-bot-api.git
cd whatsapp-bot-api
\`\`\`

2. Copy environment template
\`\`\`bash
cp .env.example .env
\`\`\`

3. Configure environment variables
\`\`\`bash
# Required
PORT=3000
NODE_ENV=production
REDIS_HOST=redis
REDIS_PORT=6379

# Security
API_KEYS=your-secret-key-here:production

# CORS
CORS_ORIGINS=https://yourdomain.com

# Optional
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=100
\`\`\`

## Deployment Methods

### Method 1: Docker Compose (Recommended)

\`\`\`bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Verify health
curl http://localhost:3000/health
\`\`\`

### Method 2: Manual Deployment

\`\`\`bash
# Install dependencies
bun install --production

# Start application
bun run src/index.ts

# Or with PM2
pm2 start src/index.ts --name whatsapp-bot --interpreter bun
\`\`\`

## SSL/TLS Setup

### Using Let's Encrypt
\`\`\`bash
# Install certbot
apt-get install certbot

# Generate certificate
certbot certonly --standalone -d yourdomain.com

# Copy to nginx
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
\`\`\`

## Zero-Downtime Deployment

\`\`\`bash
# Use deployment script
./scripts/deploy.sh production v1.2.3

# Or manual steps
docker-compose pull
docker-compose up -d --no-deps --scale app=2 app
# Wait 10 seconds
docker-compose up -d --no-deps --scale app=1 app
\`\`\`

## Health Checks

- Liveness: GET /health/live
- Readiness: GET /health/ready
- Full health: GET /health

## Rollback Procedure

\`\`\`bash
# Check previous version
git log --oneline -5

# Rollback to previous commit
git revert HEAD
docker-compose up -d --build

# Or use tagged version
git checkout v1.2.2
docker-compose up -d --build
\`\`\`

## Post-Deployment Checklist

- [ ] Health checks pass
- [ ] Metrics visible in Grafana
- [ ] Logs flowing to Loki
- [ ] SSL certificate valid
- [ ] API endpoints responding
- [ ] Redis connected
- [ ] Webhooks delivering
```

docs/RUNBOOKS.md:
```markdown
# Operational Runbooks

## Runbook 1: High Memory Usage

### Symptoms
- Memory usage >80%
- Slow response times
- OOM errors in logs

### Investigation
\`\`\`bash
# Check memory usage
docker stats whatsapp-app

# Check process memory
ps aux | grep bun

# Analyze heap dump
bun --heap-prof src/index.ts
\`\`\`

### Resolution
1. Restart application
   \`\`\`bash
   docker-compose restart app
   \`\`\`

2. Scale horizontally
   \`\`\`bash
   docker-compose up -d --scale app=2
   \`\`\`

3. If persistent: Check for memory leaks
   - Review recent code changes
   - Profile with heap snapshot
   - Check for unclosed connections

### Prevention
- Regular restarts (weekly)
- Monitor memory trends
- Code review for leaks

---

## Runbook 2: Redis Connection Failed

### Symptoms
- Error: "Redis connection failed"
- 503 errors on health check
- Degraded service

### Investigation
\`\`\`bash
# Check Redis status
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test connection
redis-cli -h localhost -p 6379 ping
\`\`\`

### Resolution
1. Restart Redis
   \`\`\`bash
   docker-compose restart redis
   \`\`\`

2. Check Redis memory
   \`\`\`bash
   redis-cli info memory
   \`\`\`

3. Clear cache if needed
   \`\`\`bash
   redis-cli FLUSHDB
   \`\`\`

### Prevention
- Monitor Redis memory
- Set max memory policy
- Regular backups

---

## Runbook 3: WhatsApp Session Disconnected

### Symptoms
- Session status: disconnected
- Messages not sending
- QR code expired

### Investigation
\`\`\`bash
# Check session status
curl -H "X-API-Key: xxx" http://localhost:3000/session/qr/check/mysession

# Check logs
docker-compose logs app | grep -i "session.*disconnected"
\`\`\`

### Resolution
1. Reconnect session
   \`\`\`bash
   # Delete old session
   curl -X DELETE -H "X-API-Key: xxx" \\
     http://localhost:3000/session/qr/delete/mysession
   
   # Get new QR
   curl -H "X-API-Key: xxx" \\
     http://localhost:3000/session/qr/get/mysession
   \`\`\`

2. Scan QR with WhatsApp mobile

3. Verify connection
   \`\`\`bash
   curl -H "X-API-Key: xxx" \\
     http://localhost:3000/session/qr/check/mysession
   \`\`\`

### Prevention
- Monitor session status
- Set up auto-reconnect alerts
- Keep WhatsApp mobile online

---

## Runbook 4: High Error Rate

### Symptoms
- Error rate >5%
- Alert: HighErrorRate
- 5xx responses

### Investigation
\`\`\`bash
# Check error logs
docker-compose logs app | grep ERROR | tail -50

# Check error rate in Grafana
# Dashboard → Overview → Error Rate panel

# Check specific errors
curl http://localhost:3000/metrics | grep http_requests_total
\`\`\`

### Resolution
1. Identify error pattern
   - Which endpoint?
   - What error code?
   - Any pattern in timing?

2. Quick fixes:
   - Restart if transient
   - Scale if overloaded
   - Rollback if recent deploy

3. Long-term:
   - Fix root cause
   - Add tests
   - Improve error handling

---

## Runbook 5: Webhook Delivery Failed

### Symptoms
- Webhook queue depth high
- Failed webhooks in admin panel
- Customer complaints

### Investigation
\`\`\`bash
# Check queue status
curl -H "X-API-Key: xxx" \\
  http://localhost:3000/admin/queue/stats

# Check failed jobs
curl -H "X-API-Key: xxx" \\
  http://localhost:3000/admin/queue/failed
\`\`\`

### Resolution
1. Check webhook endpoint
   \`\`\`bash
   curl -X POST https://customer-webhook.com/receive \\
     -d '{"test": true}'
   \`\`\`

2. Retry failed jobs
   \`\`\`bash
   curl -X POST -H "X-API-Key: xxx" \\
     http://localhost:3000/admin/queue/jobs/{jobId}/retry
   \`\`\`

3. Clean up old failed jobs
   \`\`\`bash
   curl -X POST -H "X-API-Key: xxx" \\
     http://localhost:3000/admin/queue/clean \\
     -d '{"status": "failed", "olderThan": 86400000}'
   \`\`\`

### Prevention
- Monitor webhook success rate
- Set up customer alerting
- Implement circuit breaker

---

## Emergency Contacts

- On-call Engineer: PagerDuty
- DevOps Team: #devops-alerts (Slack)
- Infrastructure: ops@company.com
- Security: security@company.com
```

docs/TROUBLESHOOTING.md:
```markdown
# Troubleshooting Guide

## Common Issues

### Issue: "API key required" error

**Cause:** Missing or invalid X-API-Key header

**Solution:**
\`\`\`bash
# Add header to request
curl -H "X-API-Key: your-key-here" http://localhost:3000/endpoint
\`\`\`

### Issue: "Rate limit exceeded"

**Cause:** Too many requests in short time

**Solution:**
- Wait for rate limit to reset (check Retry-After header)
- Reduce request frequency
- Contact admin for higher limits

### Issue: "Session not connected"

**Cause:** WhatsApp session disconnected or not initialized

**Solution:**
1. Check session status
2. Reconnect if needed
3. Scan QR code

### Issue: "Invalid phone number format"

**Cause:** Phone number not in 62XXXXXXXXX format

**Solution:**
- Use format: 62812345678 (country code + number without +)
- Remove spaces and special characters

### Issue: Docker build fails

**Cause:** Various (dependencies, permissions, etc.)

**Solution:**
\`\`\`bash
# Clear Docker cache
docker builder prune -af

# Rebuild from scratch
docker-compose build --no-cache

# Check logs
docker-compose logs --tail=100
\`\`\`

## Debugging Tools

### Check Application Logs
\`\`\`bash
# Docker logs
docker-compose logs -f app

# File logs
tail -f logs/app.log

# Search errors
grep ERROR logs/app.log
\`\`\`

### Check Database
\`\`\`bash
# Redis CLI
docker-compose exec redis redis-cli

# Check keys
KEYS whatsapp:*

# Get value
GET whatsapp:session:test1
\`\`\`

### Check Network
\`\`\`bash
# Test endpoint
curl -v http://localhost:3000/health

# Check port listening
netstat -tulpn | grep 3000

# Check DNS
nslookup yourdomain.com
\`\`\`

### Performance Debugging
\`\`\`bash
# CPU profiling
bun --cpu-prof src/index.ts

# Memory profiling
bun --heap-prof src/index.ts

# Trace logs
LOG_LEVEL=trace bun run src/index.ts
\`\`\`

## Getting Help

1. Check documentation
2. Search GitHub issues
3. Check monitoring dashboards
4. Contact support: support@company.com
```

docs/examples/nodejs/send-message.js:
```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const API_KEY = 'your-api-key-here';
const SESSION = 'mysession';

async function sendTextMessage(to, text) {
  try {
    const response = await axios.post(
      `${API_URL}/${SESSION}/message/text`,
      { to, text },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
sendTextMessage('628123456789', 'Hello from Node.js!');
```

**Acceptance Criteria:**
1. ✅ Complete API reference documented
2. ✅ Deployment guide complete
3. ✅ 5+ runbooks for common scenarios
4. ✅ Troubleshooting guide comprehensive
5. ✅ Code examples in 3+ languages
6. ✅ Architecture diagrams created
7. ✅ All docs reviewed and tested
8. ✅ Contributing guidelines clear

---

## **INTEGRATION TASK: Production Readiness Checklist**

### **MODEL**
Kamu adalah Lead DevOps Engineer dengan expertise di production operations dan release management.

### **ROLE**
Bertindak sebagai Release Manager yang bertanggung jawab untuk ensuring production readiness.

### **CONTEXT**

**Goal:**
Validate semua Phase 4 changes dan ensure application production-ready.

**Production Readiness Checklist:**

### Infrastructure
- [ ] Docker images built and tested
- [ ] docker-compose stack runs successfully
- [ ] Nginx reverse proxy configured
- [ ] SSL certificates installed
- [ ] Health checks operational
- [ ] Volumes persist data correctly

### CI/CD
- [ ] GitHub Actions workflows working
- [ ] All tests pass in CI
- [ ] Docker images pushed to registry
- [ ] Deployment script tested
- [ ] Rollback procedure verified
- [ ] Branch protection enabled

### Testing
- [ ] Unit test coverage >80%
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Load tests pass (1000 req/s)
- [ ] Security scan pass

### Monitoring
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards created
- [ ] Alerting rules configured
- [ ] PagerDuty integration working
- [ ] Log aggregation operational

### Performance
- [ ] P95 latency <200ms
- [ ] Memory usage <512MB
- [ ] No memory leaks detected
- [ ] Caching implemented
- [ ] Connection pooling enabled

### Documentation
- [ ] API documentation complete
- [ ] Deployment guide written
- [ ] Runbooks created
- [ ] Troubleshooting guide ready
- [ ] Code examples provided
- [ ] Architecture documented

### Security
- [ ] API keys configured
- [ ] Rate limiting active
- [ ] Input validation working
- [ ] Webhook signatures enabled
- [ ] Secrets not committed

### Operations
- [ ] Backup strategy defined
- [ ] Disaster recovery plan documented
- [ ] On-call rotation setup
- [ ] Monitoring dashboards reviewed
- [ ] Incident response procedures ready

**Go-Live Procedure:**

1. **Pre-Launch (T-7 days)**
   - Complete all checklist items
   - Run full test suite
   - Load test production environment
   - Review all documentation

2. **Launch Day (T-0)**
   - Deploy to production
   - Monitor metrics closely
   - Verify all integrations
   - Customer communication

3. **Post-Launch (T+7 days)**
   - Monitor error rates
   - Review performance metrics
   - Gather feedback
   - Create post-mortem

**Success Criteria:**
- ✅ Zero critical issues in first week
- ✅ 99.9% uptime
- ✅ P95 latency <200ms
- ✅ All monitoring operational
- ✅ No security incidents

**Estimated Timeline:**
- Task 1 (Docker): 1.5 days
- Task 2 (CI/CD): 1.5 days
- Task 3 (Testing): 2 days
- Task 4 (Monitoring): 1.5 days
- Task 5 (Performance): 1.5 days
- Task 6 (Documentation): 2 days
- Integration & Testing: 1 day
- **Total: 11 days** (1 developer, full-time)

---

**Generated:** 2026-07-22T02:13:31Z  
**Status:** ✅ Ready to execute
