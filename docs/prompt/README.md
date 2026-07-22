# Prompt Collection for WhatsApp Bot API

**Generated:** 2026-07-22  
**Purpose:** Dokumentasi prompt untuk development & improvement tasks

---

## 📁 Structure

```
docs/prompt/
├── README.md                    # Index file (this file)
├── PHASE_1_SECURITY.md         # Security improvements (Auth, Rate Limit, Validation)
├── PHASE_2_RELIABILITY.md      # (To be created)
├── PHASE_3_FEATURES.md         # (To be created)
└── PHASE_4_DEVOPS.md           # (To be created)
```

---

## 📋 Available Prompts

### **PHASE 1 - Critical Security Improvements** ✅
**File:** `PHASE_1_SECURITY.md`  
**Status:** Ready to execute  
**Timeline:** 6 days (1 developer)

**Tasks:**
1. ✅ API Key Authentication Middleware
2. ✅ Webhook HMAC Signature Validation
3. ✅ Input Validation & Sanitization
4. ✅ Environment Configuration Management
5. ✅ Rate Limiting Implementation
6. ✅ Integration & Testing

**When to use:**
- Sebelum deploy ke production
- Saat ada security audit requirement
- Ketika API perlu dibuka untuk external clients

---

### **PHASE 2 - Reliability & Observability** ✅
**File:** `PHASE_2_RELIABILITY.md`  
**Status:** Ready to execute  
**Timeline:** 9 days (1 developer)

**Tasks:**
1. ✅ Migrate session state ke Redis/Database
2. ✅ Add webhook retry queue (Bull/BullMQ)
3. ✅ Implement proper error logging
4. ✅ Add health check & metrics endpoint
5. ✅ Implement graceful shutdown
6. ✅ Error handling & circuit breaker pattern

**When to use:**
- Setelah Phase 1 selesai
- Ketika app sudah production dan perlu scale
- Saat perlu better monitoring & debugging

---

### **PHASE 3 - Features & Functionality** ✅
**File:** `PHASE_3_FEATURES.md`  
**Status:** Ready to execute  
**Timeline:** 14-18 days (1 developer)

**Tasks:**
1. ✅ Support additional message types (video, audio, sticker, location, contact)
2. ✅ Implement message status tracking (pending/sent/delivered/read)
3. ✅ Add bulk/broadcast messaging with anti-spam
4. ✅ Group management (create/join/leave/admin)
5. ✅ Contact management & sync
6. ✅ Admin dashboard (optional)

**When to use:**
- Setelah Phase 1 & 2 selesai
- Ketika users request additional features
- Saat competitor analysis menunjukkan feature gap

---

### **PHASE 4 - DevOps & Deployment** ✅
**File:** `PHASE_4_DEVOPS.md`  
**Status:** Ready to execute  
**Timeline:** 11 days (1 developer)

**Tasks:**
1. ✅ Dockerize application (multi-stage builds, docker-compose)
2. ✅ Setup CI/CD pipeline (GitHub Actions, automated deployment)
3. ✅ Comprehensive testing suite (unit, integration, E2E)
4. ✅ Monitoring & alerting infrastructure (Prometheus, Grafana, Alertmanager)
5. ✅ Performance optimization (caching, pooling, load testing)
6. ✅ Documentation & runbooks (API docs, deployment guides, troubleshooting)

**When to use:**
- Setelah Phase 1-3 selesai
- Ketika perlu automate deployment
- Saat team bertambah besar (need better collaboration)

---

## 🎯 How to Use These Prompts

### **Method 1: Direct Execution (AI Agent)**
```bash
# 1. Baca prompt file
cat docs/prompt/PHASE_1_SECURITY.md

# 2. Copy prompt ke AI assistant (Claude, ChatGPT, etc.)
# 3. Execute task by task
# 4. Verify dengan acceptance criteria
```

### **Method 2: Team Assignment**
```markdown
# Assign ke developer dengan context lengkap

**Assigned to:** @developer_name
**Prompt reference:** docs/prompt/PHASE_1_SECURITY.md - TASK 1
**Deadline:** 2026-07-23
**Dependencies:** None
**Acceptance criteria:** See prompt file
```

### **Method 3: Self-Service Development**
```bash
# Developer bisa baca prompt dan implement sendiri
1. Open docs/prompt/PHASE_1_SECURITY.md
2. Read TASK 1 completely
3. Follow MODEL, ROLE, CONTEXT guidelines
4. Implement according to specs
5. Test against acceptance criteria
6. Move to next task
```

---

## 📊 Progress Tracking

### **Overall Status**

| Phase | Status | Progress | ETA |
|-------|--------|----------|-----|
| Phase 1 - Security | 🟡 Ready | 0/6 tasks | 6 days |
| Phase 2 - Reliability | 🟡 Ready | 0/6 tasks | 9 days |
| Phase 3 - Features | 🟡 Ready | 0/6 tasks | 14-18 days |
| Phase 4 - DevOps | 🟡 Ready | 0/6 tasks | 11 days |

**Total Estimated Timeline:** 40-44 days (1 developer, full-time)

---

## 🔧 Maintenance

### **Adding New Prompts**

```markdown
# Template structure:

## TASK X: [Task Name]

### MODEL
[Who should AI pretend to be]

### ROLE
[What responsibility they have]

### CONTEXT
- Current State: [What exists now]
- Problems: [What's wrong]
- Requirements: [What needs to be done]
- Technical Specs: [How to implement]
- Files to Create/Modify: [File list]
- Acceptance Criteria: [How to verify]
```

### **Updating Existing Prompts**

1. Update content in relevant `.md` file
2. Update progress table in this README
3. Add changelog entry below
4. Commit with message: `docs: update prompt [PHASE_X_TASK_Y]`

---

## 📝 Changelog

### 2026-07-22
- ✅ Created prompt collection structure
- ✅ Added PHASE_1_SECURITY.md (complete)
- ✅ Added PHASE_2_RELIABILITY.md (complete)
- ✅ Added PHASE_3_FEATURES.md (complete)
- ✅ Added PHASE_4_DEVOPS.md (complete)
- ✅ Created this README
- 🔄 Identified bug in wa-manager.ts:159 (fixed)

---

## 💡 Tips for Prompt Usage

### **For AI Assistants**
- Read entire CONTEXT section before starting
- Follow acceptance criteria strictly
- Ask clarification if specs unclear
- Test thoroughly before marking complete

### **For Human Developers**
- Treat MODEL & ROLE as mindset guidance
- CONTEXT provides full background - read carefully
- Acceptance criteria = definition of done
- Don't skip testing phase

### **For Project Managers**
- Use timeline estimates for sprint planning
- Each task is independent - can parallelize some
- Acceptance criteria = QA checklist
- Integration task requires all previous tasks done

---

## 🆘 Support

**Questions about prompts?**
- Check CONTEXT section in prompt file
- Review acceptance criteria
- Look at code examples in prompt
- Ask in team chat with prompt reference

**Found issues in prompts?**
- Create issue with label `documentation`
- Reference specific prompt file & task number
- Suggest correction if possible

**Need new prompt?**
- Follow template structure above
- Get review from lead developer
- Add to appropriate PHASE file
- Update this README

---

## 📚 Related Documentation

- [Security Documentation](../SECURITY.md) - After Phase 1
- [Webhook Security Guide](../WEBHOOK_SECURITY.md) - After Phase 1 Task 2
- [API Documentation](../API.md) - After Phase 3
- [Deployment Guide](../DEPLOYMENT.md) - After Phase 4

---

**Last Updated:** 2026-07-22T01:31:56Z  
**Maintainer:** Development Team  
**Status:** 🟢 Active
