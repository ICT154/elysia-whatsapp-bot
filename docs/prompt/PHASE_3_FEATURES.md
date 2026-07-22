# **PHASE 3 - FEATURES & FUNCTIONALITY**

**Generated:** 2026-07-22  
**Purpose:** Expand WhatsApp Bot API functionality dan feature parity  
**Timeline:** 14-18 days (1 developer, full-time)

---

## **OVERVIEW**

Phase 3 focuses pada expanding feature set setelah security (Phase 1) dan reliability (Phase 2) sudah solid. Goals utama:
- Support semua WhatsApp message types
- Implement message status tracking
- Add bulk/broadcast messaging
- Group management capabilities
- Contact sync dan management
- Admin dashboard untuk monitoring

**Prerequisites:**
- ✅ Phase 1 completed (Security layer active)
- ✅ Phase 2 completed (Redis, queue, logging ready)

---

## **TASK 1: Support Additional Message Types**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di WhatsApp Business API, Baileys library, dan multimedia handling.

### **ROLE**
Bertindak sebagai Feature Engineer yang bertanggung jawab untuk implementing comprehensive message type support.

### **CONTEXT**

**Current State:**
- Support: text, image (URL only), document (file), poll
- Tidak support: video, audio, sticker, location, contact, button, template
- Image hanya dari URL, tidak bisa upload
- Tidak ada media validation

**Missing Features:**
- Video messages (upload & URL)
- Audio messages (voice notes & audio files)
- Stickers (static & animated)
- Location sharing
- Contact cards (vCard)
- Button messages
- Template messages (WhatsApp Business)
- Reply/quote messages
- Forwarded messages

**Requirements:**
1. Implement video message sending (file & URL)
2. Implement audio message sending (voice notes)
3. Implement sticker sending (convert image to sticker)
4. Implement location sharing
5. Implement contact card (vCard) sharing
6. Implement reply/quote message
7. Add media validation (size, format, duration)
8. Add media upload from base64
9. Create comprehensive message type documentation

**Technical Specs:**

**Media Limits:**
- Image: Max 5MB, formats: JPG, PNG, WEBP
- Video: Max 16MB, formats: MP4, 3GP, MOV
- Audio: Max 16MB, formats: MP3, OGG, AAC, M4A
- Document: Max 100MB, any format
- Sticker: Max 500KB, 512x512px, WEBP

**Files to Create/Modify:**
- src/services/MessageService.ts - Add new message types
- src/controllers/MessageController.ts - Add new endpoints
- src/routes/message.ts - Add new routes
- src/utils/media-validator.ts - Media validation utilities
- src/utils/media-converter.ts - Media conversion (image to sticker)
- docs/MESSAGE_TYPES.md - Message type documentation

**Implementation Example:**

src/services/MessageService.ts:
\\\	ypescript
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { getSockOrThrow, toJid } from "../wa-manager";
import { ValidationError } from "../errors/AppError";
import { validateMedia } from "../utils/media-validator";

export class MessageService {
  // Existing methods...

  static async sendVideoFromUrl(
    session: string,
    to: string,
    videoUrl: string,
    caption?: string
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    await sock.sendMessage(jid, {
      video: { url: videoUrl },
      caption,
      gifPlayback: false,
    });

    return { ok: true };
  }

  static async sendVideoFromFile(
    session: string,
    to: string,
    filePath: string,
    caption?: string,
    asGif: boolean = false
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    // Validate video file
    await validateMedia(filePath, "video");

    const buffer = fs.readFileSync(filePath);
    await sock.sendMessage(jid, {
      video: buffer,
      caption,
      gifPlayback: asGif,
      mimetype: mime.lookup(filePath) || "video/mp4",
    });

    return { ok: true };
  }

  static async sendAudio(
    session: string,
    to: string,
    audioPath: string,
    asVoiceNote: boolean = false
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    await validateMedia(audioPath, "audio");

    const buffer = fs.readFileSync(audioPath);
    
    if (asVoiceNote) {
      // Voice note (PTT - Push To Talk)
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
      });
    } else {
      // Regular audio file
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: mime.lookup(audioPath) || "audio/mp4",
      });
    }

    return { ok: true };
  }

  static async sendSticker(
    session: string,
    to: string,
    stickerPath: string
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    await validateMedia(stickerPath, "sticker");

    const buffer = fs.readFileSync(stickerPath);
    await sock.sendMessage(jid, {
      sticker: buffer,
    });

    return { ok: true };
  }

  static async sendLocation(
    session: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError("Invalid latitude", { latitude });
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError("Invalid longitude", { longitude });
    }

    await sock.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name,
        address,
      },
    });

    return { ok: true };
  }

  static async sendContact(
    session: string,
    to: string,
    contacts: Array<{
      displayName: string;
      vcard: string;
    }>
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    if (contacts.length === 0) {
      throw new ValidationError("At least one contact required");
    }

    await sock.sendMessage(jid, {
      contacts: {
        displayName: contacts[0].displayName,
        contacts: contacts.map((c) => ({ vcard: c.vcard })),
      },
    });

    return { ok: true };
  }

  static async sendReply(
    session: string,
    to: string,
    text: string,
    quotedMessageId: string
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    await sock.sendMessage(jid, {
      text,
    }, {
      quoted: {
        key: {
          remoteJid: jid,
          id: quotedMessageId,
        },
      },
    });

    return { ok: true };
  }

  static async sendMediaFromBase64(
    session: string,
    to: string,
    base64Data: string,
    mediaType: "image" | "video" | "audio" | "document",
    options?: {
      caption?: string;
      fileName?: string;
      mimetype?: string;
    }
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    // Decode base64
    const buffer = Buffer.from(base64Data, "base64");

    const message: any = {
      [mediaType]: buffer,
      caption: options?.caption,
    };

    if (mediaType === "document") {
      message.fileName = options?.fileName || "document";
      message.mimetype = options?.mimetype || "application/octet-stream";
    } else if (options?.mimetype) {
      message.mimetype = options.mimetype;
    }

    await sock.sendMessage(jid, message);

    return { ok: true };
  }
}
\\\

src/utils/media-validator.ts:
\\\	ypescript
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { ValidationError } from "../errors/AppError";

type MediaType = "image" | "video" | "audio" | "document" | "sticker";

const MEDIA_LIMITS: Record<MediaType, { maxSize: number; formats: string[] }> = {
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    formats: ["image/jpeg", "image/png", "image/webp"],
  },
  video: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ["video/mp4", "video/3gpp", "video/quicktime"],
  },
  audio: {
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: ["audio/mpeg", "audio/ogg", "audio/aac", "audio/mp4"],
  },
  document: {
    maxSize: 100 * 1024 * 1024, // 100MB
    formats: [], // Any format
  },
  sticker: {
    maxSize: 500 * 1024, // 500KB
    formats: ["image/webp"],
  },
};

export async function validateMedia(
  filePath: string,
  mediaType: MediaType
): Promise<void> {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new ValidationError("File not found", { filePath });
  }

  // Check file size
  const stats = fs.statSync(filePath);
  const limit = MEDIA_LIMITS[mediaType];

  if (stats.size > limit.maxSize) {
    throw new ValidationError(
      \File too large. Max size: \MB\,
      { size: stats.size, maxSize: limit.maxSize }
    );
  }

  // Check mime type
  const mimeType = mime.lookup(filePath);
  if (!mimeType) {
    throw new ValidationError("Could not determine file type", { filePath });
  }

  if (limit.formats.length > 0 && !limit.formats.includes(mimeType)) {
    throw new ValidationError(
      \Invalid file format. Allowed: \\,
      { mimeType, allowed: limit.formats }
    );
  }
}

export function validateVCard(vcard: string): void {
  // Basic vCard validation
  if (!vcard.startsWith("BEGIN:VCARD")) {
    throw new ValidationError("Invalid vCard format");
  }
  if (!vcard.includes("END:VCARD")) {
    throw new ValidationError("Incomplete vCard");
  }
  if (!vcard.includes("FN:")) {
    throw new ValidationError("vCard missing FN (formatted name)");
  }
}
\\\

src/routes/message.ts (add new routes):
\\\	ypescript
export const messageRoutes = new Elysia({ prefix: "/:session/message" })
  // Existing routes...
  .post("/text", (ctx) => MessageController.sendText(ctx))
  .post("/image/url", (ctx) => MessageController.sendImageUrl(ctx))
  .post("/document/file", (ctx) => MessageController.sendDocumentFile(ctx))
  .post("/poll/yesno", (ctx) => MessageController.sendYesNoPoll(ctx))
  
  // New routes
  .post("/video/url", (ctx) => MessageController.sendVideoUrl(ctx))
  .post("/video/file", (ctx) => MessageController.sendVideoFile(ctx))
  .post("/audio", (ctx) => MessageController.sendAudio(ctx))
  .post("/sticker", (ctx) => MessageController.sendSticker(ctx))
  .post("/location", (ctx) => MessageController.sendLocation(ctx))
  .post("/contact", (ctx) => MessageController.sendContact(ctx))
  .post("/reply", (ctx) => MessageController.sendReply(ctx))
  .post("/media/base64", (ctx) => MessageController.sendMediaBase64(ctx));
\\\

src/controllers/MessageController.ts:
\\\	ypescript
export class MessageController {
  // Existing methods...

  static async sendVideoUrl({ params, body, set }: any) {
    try {
      const session = params.session;
      const { to, videoUrl, caption } = body;

      if (!to || !videoUrl) {
        set.status = 400;
        return { status: "error", message: "to & videoUrl required" };
      }

      return {
        status: "success",
        message: "Video from URL sent successfully",
        data: await MessageService.sendVideoFromUrl(session, to, videoUrl, caption),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to send video",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async sendLocation({ params, body, set }: any) {
    try {
      const session = params.session;
      const { to, latitude, longitude, name, address } = body;

      if (!to || latitude === undefined || longitude === undefined) {
        set.status = 400;
        return { status: "error", message: "to, latitude & longitude required" };
      }

      return {
        status: "success",
        message: "Location sent successfully",
        data: await MessageService.sendLocation(
          session,
          to,
          latitude,
          longitude,
          name,
          address
        ),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to send location",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async sendContact({ params, body, set }: any) {
    try {
      const session = params.session;
      const { to, contacts } = body;

      if (!to || !contacts || !Array.isArray(contacts)) {
        set.status = 400;
        return { status: "error", message: "to & contacts array required" };
      }

      return {
        status: "success",
        message: "Contact sent successfully",
        data: await MessageService.sendContact(session, to, contacts),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to send contact",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
\\\

**API Examples:**

\\\ash
# Send video from URL
curl -X POST http://localhost:3000/mysession/message/video/url \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "to": "628123456789",
    "videoUrl": "https://example.com/video.mp4",
    "caption": "Check this out!"
  }'

# Send location
curl -X POST http://localhost:3000/mysession/message/location \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "to": "628123456789",
    "latitude": -6.2088,
    "longitude": 106.8456,
    "name": "Monas",
    "address": "Jakarta Pusat"
  }'

# Send contact (vCard)
curl -X POST http://localhost:3000/mysession/message/contact \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "to": "628123456789",
    "contacts": [{
      "displayName": "John Doe",
      "vcard": "BEGIN:VCARD\\nVERSION:3.0\\nFN:John Doe\\nTEL:+628123456789\\nEND:VCARD"
    }]
  }'

# Send media from base64
curl -X POST http://localhost:3000/mysession/message/media/base64 \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "to": "628123456789",
    "mediaType": "image",
    "base64Data": "iVBORw0KGgoAAAANSUhEUgAA...",
    "caption": "Image from base64"
  }'
\\\

**Acceptance Criteria:**
1. ✅ Support video (URL & file upload)
2. ✅ Support audio & voice notes
3. ✅ Support stickers
4. ✅ Support location sharing
5. ✅ Support contact cards (vCard)
6. ✅ Support reply/quote messages
7. ✅ Media validation working (size, format)
8. ✅ Base64 upload working
9. ✅ All new endpoints documented
10. ✅ Error handling comprehensive

---

## **TASK 2: Implement Message Status Tracking**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di event-driven architecture, WebSocket, dan real-time systems.

### **ROLE**
Bertindak sebagai Feature Engineer yang bertanggung jawab untuk implementing message delivery status tracking.

### **CONTEXT**

**Current State:**
- Messages dikirim tanpa status tracking
- Tidak tahu apakah message delivered/read
- Tidak ada callback untuk status updates
- Webhook hanya untuk incoming messages

**Missing Features:**
- Message delivery confirmation (sent, delivered, read)
- Message failure tracking
- Status update webhooks
- Message history/log
- Delivery receipt tracking

**Requirements:**
1. Track message status (pending, sent, delivered, read, failed)
2. Store message metadata di Redis
3. Emit status updates via webhook
4. Add API endpoint untuk query message status
5. Add message history endpoint
6. Implement delivery receipt handling
7. Add read receipt handling
8. Support status update subscriptions

**Technical Specs:**

**Message Status Flow:**
`
pending → sent → delivered → read
                ↓
              failed
`

**Redis Schema:**
`
# Message metadata
whatsapp:message:{sessionName}:{messageId} -> JSON
{
  "id": "msg_abc123",
  "sessionName": "test1",
  "to": "628123456789@s.whatsapp.net",
  "type": "text",
  "content": "Hello",
  "status": "delivered",
  "sentAt": 1721616000000,
  "deliveredAt": 1721616002000,
  "readAt": null,
  "failedReason": null
}
TTL: 7 days

# Message index by session
whatsapp:messages:{sessionName} -> ZSET (score = timestamp, value = messageId)

# Status index
whatsapp:messages:status:{sessionName}:{status} -> SET [messageId1, messageId2, ...]
`

**Webhook Payload (Status Update):**
`json
{
  "session": "test1",
  "type": "message_status",
  "messageId": "msg_abc123",
  "status": "delivered",
  "to": "628123456789",
  "timestamp": 1721616002000
}
`

**Files to Create/Modify:**
- src/services/MessageStore.ts - Message persistence
- src/services/MessageService.ts - Add status tracking
- src/wa-manager.ts - Add receipt handlers
- src/controllers/MessageController.ts - Add query endpoints
- src/routes/message.ts - Add history routes
- src/webhook/WebhookManager.ts - Add status webhooks

**Implementation Example:**

src/services/MessageStore.ts:
\\\	ypescript
import { getRedis } from "../config/redis";
import { logger } from "../config/logger";

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type MessageMetadata = {
  id: string;
  sessionName: string;
  to: string;
  type: string;
  content?: string;
  status: MessageStatus;
  sentAt: number;
  deliveredAt?: number;
  readAt?: number;
  failedReason?: string;
};

export class MessageStore {
  static async saveMessage(data: MessageMetadata): Promise<void> {
    const redis = getRedis();
    const key = \whatsapp:message:\:\\;
    const indexKey = \whatsapp:messages:\\;
    const statusKey = \whatsapp:messages:status:\:\\;

    await Promise.all([
      // Save message data
      redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(data)), // 7 days TTL

      // Add to session index (sorted by timestamp)
      redis.zadd(indexKey, data.sentAt, data.id),

      // Add to status index
      redis.sadd(statusKey, data.id),
    ]);

    logger.debug({
      messageId: data.id,
      sessionName: data.sessionName,
      status: data.status,
      msg: "Message saved",
    });
  }

  static async updateMessageStatus(
    sessionName: string,
    messageId: string,
    status: MessageStatus,
    timestamp: number,
    failedReason?: string
  ): Promise<MessageMetadata | null> {
    const redis = getRedis();
    const key = \whatsapp:message:\:\\;

    const data = await redis.get(key);
    if (!data) {
      logger.warn({ messageId, sessionName }, "Message not found for status update");
      return null;
    }

    const message: MessageMetadata = JSON.parse(data);
    const oldStatus = message.status;

    // Update status
    message.status = status;
    if (status === "delivered") {
      message.deliveredAt = timestamp;
    } else if (status === "read") {
      message.readAt = timestamp;
    } else if (status === "failed") {
      message.failedReason = failedReason;
    }

    // Save updated message
    await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(message));

    // Update status indexes
    const oldStatusKey = \whatsapp:messages:status:\:\\;
    const newStatusKey = \whatsapp:messages:status:\:\\;

    await Promise.all([
      redis.srem(oldStatusKey, messageId),
      redis.sadd(newStatusKey, messageId),
    ]);

    logger.info({
      messageId,
      sessionName,
      oldStatus,
      newStatus: status,
      msg: "Message status updated",
    });

    return message;
  }

  static async getMessage(
    sessionName: string,
    messageId: string
  ): Promise<MessageMetadata | null> {
    const redis = getRedis();
    const key = \whatsapp:message:\:\\;

    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  }

  static async getMessageHistory(
    sessionName: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MessageMetadata[]> {
    const redis = getRedis();
    const indexKey = \whatsapp:messages:\\;

    // Get message IDs (sorted by timestamp, newest first)
    const messageIds = await redis.zrevrange(indexKey, offset, offset + limit - 1);

    if (messageIds.length === 0) return [];

    // Get message data
    const pipeline = redis.pipeline();
    messageIds.forEach((id) => {
      pipeline.get(\whatsapp:message:\:\\);
    });

    const results = await pipeline.exec();
    if (!results) return [];

    return results
      .map(([err, data]) => {
        if (err || !data) return null;
        return JSON.parse(data as string);
      })
      .filter((m): m is MessageMetadata => m !== null);
  }

  static async getMessagesByStatus(
    sessionName: string,
    status: MessageStatus
  ): Promise<MessageMetadata[]> {
    const redis = getRedis();
    const statusKey = \whatsapp:messages:status:\:\\;

    const messageIds = await redis.smembers(statusKey);
    if (messageIds.length === 0) return [];

    const pipeline = redis.pipeline();
    messageIds.forEach((id) => {
      pipeline.get(\whatsapp:message:\:\\);
    });

    const results = await pipeline.exec();
    if (!results) return [];

    return results
      .map(([err, data]) => {
        if (err || !data) return null;
        return JSON.parse(data as string);
      })
      .filter((m): m is MessageMetadata => m !== null);
  }

  static async getMessageStats(sessionName: string) {
    const redis = getRedis();

    const [pending, sent, delivered, read, failed] = await Promise.all([
      redis.scard(\whatsapp:messages:status:\:pending\),
      redis.scard(\whatsapp:messages:status:\:sent\),
      redis.scard(\whatsapp:messages:status:\:delivered\),
      redis.scard(\whatsapp:messages:status:\:read\),
      redis.scard(\whatsapp:messages:status:\:failed\),
    ]);

    return {
      pending,
      sent,
      delivered,
      read,
      failed,
      total: pending + sent + delivered + read + failed,
    };
  }
}
\\\

**Update wa-manager.ts (add receipt handlers):**
\\\	ypescript
sock.ev.on("messages.update", async (updates) => {
  for (const update of updates) {
    const messageId = update.key.id;
    if (!messageId) continue;

    // Handle status updates
    if (update.update.status) {
      const status = update.update.status;
      let messageStatus: MessageStatus;

      switch (status) {
        case 1: // Server received
          messageStatus = "sent";
          break;
        case 2: // Delivered to device
          messageStatus = "delivered";
          break;
        case 3: // Read by recipient
          messageStatus = "read";
          break;
        case 0: // Pending
        default:
          messageStatus = "pending";
          break;
      }

      // Update in store
      const updated = await MessageStore.updateMessageStatus(
        name,
        messageId,
        messageStatus,
        Date.now()
      );

      if (updated) {
        // Send webhook notification
        const cfg = await resolveWebhook(name);
        if (cfg?.url) {
          await enqueueWebhook(
            name,
            cfg.url,
            {
              session: name,
              type: "message_status",
              messageId,
              status: messageStatus,
              to: update.key.remoteJid,
              timestamp: Date.now(),
            },
            cfg.secret
          );
        }
      }
    }
  }
});

// Handle message failures
sock.ev.on("messages.upsert", async ({ messages }) => {
  for (const msg of messages) {
    if (msg.key.fromMe && msg.messageStubType) {
      // Message stub indicates some special event (like failure)
      const messageId = msg.key.id;
      if (messageId) {
        await MessageStore.updateMessageStatus(
          name,
          messageId,
          "failed",
          Date.now(),
          \Stub type: \\
        );
      }
    }
  }
});
\\\

**Update MessageService.ts:**
\\\	ypescript
export class MessageService {
  static async sendText(session: string, to: string, text: string) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(to);

    // Send message
    const sent = await sock.sendMessage(jid, { text });

    // Save to store
    const messageId = sent.key.id!;
    await MessageStore.saveMessage({
      id: messageId,
      sessionName: session,
      to: jid,
      type: "text",
      content: text,
      status: "pending",
      sentAt: Date.now(),
    });

    return { ok: true, messageId };
  }

  // Similar updates for other send methods...
}
\\\

**Add Query Endpoints:**

src/controllers/MessageController.ts:
\\\	ypescript
export class MessageController {
  // Existing send methods...

  static async getMessageStatus({ params }: any) {
    try {
      const { session, messageId } = params;

      const message = await MessageStore.getMessage(session, messageId);

      if (!message) {
        return {
          status: "error",
          message: "Message not found",
        };
      }

      return {
        status: "success",
        data: {
          messageId: message.id,
          status: message.status,
          sentAt: message.sentAt,
          deliveredAt: message.deliveredAt,
          readAt: message.readAt,
          failedReason: message.failedReason,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get message status",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getMessageHistory({ params, query }: any) {
    try {
      const session = params.session;
      const limit = parseInt(query.limit || "50");
      const offset = parseInt(query.offset || "0");

      const messages = await MessageStore.getMessageHistory(session, limit, offset);

      return {
        status: "success",
        data: {
          messages,
          count: messages.length,
          limit,
          offset,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get message history",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getMessageStats({ params }: any) {
    try {
      const session = params.session;
      const stats = await MessageStore.getMessageStats(session);

      return {
        status: "success",
        data: stats,
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get message stats",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
\\\

src/routes/message.ts:
\\\	ypescript
export const messageRoutes = new Elysia({ prefix: "/:session/message" })
  // Send endpoints...
  .post("/text", (ctx) => MessageController.sendText(ctx))
  // ... other send endpoints

  // Query endpoints
  .get("/:messageId/status", (ctx) => MessageController.getMessageStatus(ctx))
  .get("/history", (ctx) => MessageController.getMessageHistory(ctx))
  .get("/stats", (ctx) => MessageController.getMessageStats(ctx));
\\\

**API Examples:**
\\\ash
# Get message status
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/message/3A123ABC456DEF/status

# Get message history
curl -H "X-API-Key: sk_live_xxx" \\
  "http://localhost:3000/test1/message/history?limit=20&offset=0"

# Get message stats
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/message/stats
\\\

**Acceptance Criteria:**
1. ✅ Message status tracked (pending → sent → delivered → read)
2. ✅ Status updates stored in Redis
3. ✅ Webhook notifications for status changes
4. ✅ API endpoint untuk query message status
5. ✅ Message history endpoint working
6. ✅ Message stats endpoint working
7. ✅ Failed messages tracked dengan reason
8. ✅ 7-day retention period enforced

---

## **TASK 3: Implement Bulk/Broadcast Messaging**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di high-throughput systems, job queuing, dan anti-spam strategies.

### **ROLE**
Bertindak sebagai Feature Engineer yang bertanggung jawab untuk implementing bulk messaging dengan proper rate limiting dan anti-ban mechanisms.

### **CONTEXT**

**Current State:**
- Hanya support single recipient per request
- Tidak ada bulk send API
- Tidak ada rate limiting per recipient
- Risk of WhatsApp ban jika spam

**Missing Features:**
- Bulk message sending (multiple recipients)
- Broadcast messages (with personalization)
- Scheduled messages
- Message templates
- Anti-ban protection (delay between messages)
- Delivery reporting for bulk sends

**Requirements:**
1. Implement bulk send API (batch of recipients)
2. Add message scheduling (send at specific time)
3. Implement smart throttling (prevent WhatsApp ban)
4. Add message templates with variables
5. Add bulk delivery reporting
6. Implement recipient list management
7. Add dry-run mode (validate without sending)
8. Create anti-spam safeguards

**Technical Specs:**

**Rate Limiting Strategy:**
- Max 20 messages/minute per session (conservative)
- Min 3 seconds delay between messages to same recipient
- Randomized jitter (±500ms) to avoid pattern detection
- Exponential backoff if rate limit hit

**Bulk Send Process:**
`
1. Validate recipients (phone format, duplicates)
2. Create bulk job with unique ID
3. Queue individual messages with delays
4. Track progress in Redis
5. Send delivery report webhook when complete
`

**Redis Schema:**
`
# Bulk job metadata
whatsapp:bulk:{jobId} -> JSON
{
  "id": "bulk_abc123",
  "sessionName": "test1",
  "totalRecipients": 100,
  "sent": 45,
  "failed": 2,
  "pending": 53,
  "status": "in_progress",
  "createdAt": 1721617200000,
  "completedAt": null
}
TTL: 30 days

# Bulk recipients
whatsapp:bulk:{jobId}:recipients -> LIST [recipient1, recipient2, ...]

# Last message timestamp (for rate limiting)
whatsapp:ratelimit:{sessionName}:{recipient} -> timestamp
TTL: 300 seconds (5 minutes)
`

**Files to Create/Modify:**
- src/services/BulkMessageService.ts - Bulk messaging logic
- src/controllers/BulkMessageController.ts - Bulk endpoints
- src/routes/bulk.ts - Bulk routes
- src/queues/bulk-message.queue.ts - Bulk message queue
- src/workers/bulk-message.worker.ts - Bulk message processor
- src/utils/anti-spam.ts - Anti-spam utilities

**Implementation Example:**

src/services/BulkMessageService.ts:
\\\	ypescript
import { nanoid } from "nanoid";
import { getRedis } from "../config/redis";
import { bulkMessageQueue } from "../queues/bulk-message.queue";
import { logger } from "../config/logger";
import { ValidationError } from "../errors/AppError";

export type BulkJobStatus = "pending" | "in_progress" | "completed" | "failed";

export type BulkJob = {
  id: string;
  sessionName: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  pending: number;
  status: BulkJobStatus;
  createdAt: number;
  completedAt?: number;
};

export type BulkMessagePayload = {
  recipients: string[];
  message: {
    type: "text" | "image" | "document";
    content: string;
    caption?: string;
  };
  template?: {
    variables: Record<string, string>[];
  };
  schedule?: number; // Unix timestamp
  dryRun?: boolean;
};

export class BulkMessageService {
  static async createBulkJob(
    sessionName: string,
    payload: BulkMessagePayload
  ): Promise<BulkJob> {
    // Validate recipients
    if (!payload.recipients || payload.recipients.length === 0) {
      throw new ValidationError("At least one recipient required");
    }

    if (payload.recipients.length > 1000) {
      throw new ValidationError("Maximum 1000 recipients per bulk job");
    }

    // Remove duplicates
    const uniqueRecipients = [...new Set(payload.recipients)];

    // Validate phone numbers
    const invalidRecipients = uniqueRecipients.filter(
      (phone) => !/^62\d{9,13}$/.test(phone)
    );

    if (invalidRecipients.length > 0) {
      throw new ValidationError("Invalid phone numbers", {
        invalid: invalidRecipients.slice(0, 5), // Show first 5
        count: invalidRecipients.length,
      });
    }

    // Create bulk job
    const jobId = \ulk_\\;
    const redis = getRedis();

    const job: BulkJob = {
      id: jobId,
      sessionName,
      totalRecipients: uniqueRecipients.length,
      sent: 0,
      failed: 0,
      pending: uniqueRecipients.length,
      status: payload.dryRun ? "pending" : "in_progress",
      createdAt: Date.now(),
    };

    // Save job metadata
    await redis.setex(
      \whatsapp:bulk:\\,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(job)
    );

    // Save recipients list
    await redis.rpush(
      \whatsapp:bulk:\:recipients\,
      ...uniqueRecipients
    );
    await redis.expire(\whatsapp:bulk:\:recipients\, 30 * 24 * 60 * 60);

    if (payload.dryRun) {
      logger.info({ jobId, recipients: uniqueRecipients.length }, "Bulk job validated (dry run)");
      return job;
    }

    // Queue messages with delays
    const now = Date.now();
    const scheduleTime = payload.schedule || now;

    for (let i = 0; i < uniqueRecipients.length; i++) {
      const recipient = uniqueRecipients[i];
      
      // Calculate delay: 3 seconds per message + jitter
      const baseDelay = i * 3000;
      const jitter = Math.random() * 1000 - 500; // ±500ms
      const delay = Math.max(0, baseDelay + jitter);

      const variables = payload.template?.variables?.[i] || {};

      await bulkMessageQueue.add(
        \ulk:\:\\,
        {
          jobId,
          sessionName,
          recipient,
          message: payload.message,
          variables,
        },
        {
          delay: scheduleTime - now + delay,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        }
      );
    }

    logger.info({
      jobId,
      sessionName,
      recipients: uniqueRecipients.length,
      msg: "Bulk job created and queued",
    });

    return job;
  }

  static async getBulkJob(jobId: string): Promise<BulkJob | null> {
    const redis = getRedis();
    const data = await redis.get(\whatsapp:bulk:\\);

    if (!data) return null;

    return JSON.parse(data);
  }

  static async updateBulkJob(
    jobId: string,
    updates: Partial<BulkJob>
  ): Promise<void> {
    const redis = getRedis();
    const job = await this.getBulkJob(jobId);

    if (!job) {
      logger.warn({ jobId }, "Bulk job not found for update");
      return;
    }

    const updated = { ...job, ...updates };

    // Auto-complete if all messages processed
    if (updated.sent + updated.failed === updated.totalRecipients) {
      updated.status = "completed";
      updated.completedAt = Date.now();
    }

    await redis.setex(
      \whatsapp:bulk:\\,
      30 * 24 * 60 * 60,
      JSON.stringify(updated)
    );

    logger.debug({ jobId, updates }, "Bulk job updated");
  }

  static async incrementBulkJobCounter(
    jobId: string,
    counter: "sent" | "failed"
  ): Promise<void> {
    const job = await this.getBulkJob(jobId);
    if (!job) return;

    job[counter]++;
    job.pending = job.totalRecipients - job.sent - job.failed;

    await this.updateBulkJob(jobId, job);
  }

  static async getBulkJobRecipients(jobId: string): Promise<string[]> {
    const redis = getRedis();
    return await redis.lrange(\whatsapp:bulk:\:recipients\, 0, -1);
  }
}
\\\

src/utils/anti-spam.ts:
\\\	ypescript
import { getRedis } from "../config/redis";
import { RateLimitError } from "../errors/AppError";

export class AntiSpam {
  static async checkRateLimit(
    sessionName: string,
    recipient: string
  ): Promise<void> {
    const redis = getRedis();
    const key = \whatsapp:ratelimit:\:\\;

    const lastMessageTime = await redis.get(key);

    if (lastMessageTime) {
      const elapsed = Date.now() - parseInt(lastMessageTime);
      const minDelay = 3000; // 3 seconds

      if (elapsed < minDelay) {
        const retryAfter = Math.ceil((minDelay - elapsed) / 1000);
        throw new RateLimitError(retryAfter);
      }
    }

    // Update last message time
    await redis.setex(key, 300, Date.now().toString()); // 5 min TTL
  }

  static async getSessionMessageCount(
    sessionName: string,
    windowSeconds: number = 60
  ): Promise<number> {
    const redis = getRedis();
    const key = \whatsapp:message_count:\\;

    const count = await redis.get(key);
    return count ? parseInt(count) : 0;
  }

  static async incrementSessionMessageCount(
    sessionName: string,
    windowSeconds: number = 60
  ): Promise<number> {
    const redis = getRedis();
    const key = \whatsapp:message_count:\\;

    const count = await redis.incr(key);
    
    if (count === 1) {
      // First message in window, set expiry
      await redis.expire(key, windowSeconds);
    }

    return count;
  }

  static async enforceSessionLimit(
    sessionName: string,
    maxPerMinute: number = 20
  ): Promise<void> {
    const count = await this.getSessionMessageCount(sessionName);

    if (count >= maxPerMinute) {
      throw new RateLimitError(60);
    }

    await this.incrementSessionMessageCount(sessionName);
  }
}
\\\

src/workers/bulk-message.worker.ts:
\\\	ypescript
import { Worker } from "bullmq";
import { getRedis } from "../config/redis";
import { MessageService } from "../services/MessageService";
import { BulkMessageService } from "../services/BulkMessageService";
import { AntiSpam } from "../utils/anti-spam";
import { logger } from "../config/logger";

type BulkMessageJob = {
  jobId: string;
  sessionName: string;
  recipient: string;
  message: {
    type: "text" | "image" | "document";
    content: string;
    caption?: string;
  };
  variables: Record<string, string>;
};

const worker = new Worker<BulkMessageJob>(
  "bulk-message",
  async (job) => {
    const { jobId, sessionName, recipient, message, variables } = job.data;

    try {
      // Check rate limits
      await AntiSpam.checkRateLimit(sessionName, recipient);
      await AntiSpam.enforceSessionLimit(sessionName);

      // Apply template variables
      let content = message.content;
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(\{{\\s*\\\s*}}\, "g"), value);
      }

      // Send message
      let result;
      switch (message.type) {
        case "text":
          result = await MessageService.sendText(sessionName, recipient, content);
          break;
        case "image":
          result = await MessageService.sendImageFromUrl(
            sessionName,
            recipient,
            message.content,
            message.caption
          );
          break;
        case "document":
          result = await MessageService.sendDocumentFromFile(
            sessionName,
            recipient,
            message.content,
            undefined,
            undefined,
            message.caption
          );
          break;
        default:
          throw new Error(\Unsupported message type: \\);
      }

      // Update bulk job counter
      await BulkMessageService.incrementBulkJobCounter(jobId, "sent");

      logger.info({
        jobId,
        recipient,
        messageId: result.messageId,
        msg: "Bulk message sent",
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      // Update failed counter
      await BulkMessageService.incrementBulkJobCounter(jobId, "failed");

      logger.error({
        jobId,
        recipient,
        error: error instanceof Error ? error.message : String(error),
        msg: "Bulk message failed",
      });

      throw error;
    }
  },
  {
    connection: getRedis(),
    concurrency: 5, // Process 5 bulk messages concurrently
  }
);

export { worker };
\\\

src/controllers/BulkMessageController.ts:
\\\	ypescript
import { BulkMessageService } from "../services/BulkMessageService";

export class BulkMessageController {
  static async sendBulk({ params, body, set }: any) {
    try {
      const sessionName = params.session;
      const job = await BulkMessageService.createBulkJob(sessionName, body);

      return {
        status: "success",
        message: body.dryRun
          ? "Bulk job validated (dry run)"
          : "Bulk job created and queued",
        data: job,
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to create bulk job",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getBulkJob({ params }: any) {
    try {
      const { jobId } = params;
      const job = await BulkMessageService.getBulkJob(jobId);

      if (!job) {
        return {
          status: "error",
          message: "Bulk job not found",
        };
      }

      return {
        status: "success",
        data: job,
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get bulk job",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getBulkJobRecipients({ params }: any) {
    try {
      const { jobId } = params;
      const recipients = await BulkMessageService.getBulkJobRecipients(jobId);

      return {
        status: "success",
        data: {
          jobId,
          recipients,
          count: recipients.length,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get recipients",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
\\\

src/routes/bulk.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { BulkMessageController } from "../controllers/BulkMessageController";

export const bulkRoutes = new Elysia({ prefix: "/:session/bulk" })
  .post("/send", (ctx) => BulkMessageController.sendBulk(ctx))
  .get("/job/:jobId", (ctx) => BulkMessageController.getBulkJob(ctx))
  .get("/job/:jobId/recipients", (ctx) => BulkMessageController.getBulkJobRecipients(ctx));
\\\

**API Examples:**
\\\ash
# Send bulk messages
curl -X POST http://localhost:3000/test1/bulk/send \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "recipients": ["628123456789", "628987654321"],
    "message": {
      "type": "text",
      "content": "Hello {{name}}, your order {{orderId}} is ready!"
    },
    "template": {
      "variables": [
        {"name": "John", "orderId": "ORD-001"},
        {"name": "Jane", "orderId": "ORD-002"}
      ]
    }
  }'

# Dry run (validate without sending)
curl -X POST http://localhost:3000/test1/bulk/send \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "recipients": ["628123456789", "628987654321"],
    "message": {"type": "text", "content": "Test"},
    "dryRun": true
  }'

# Get bulk job status
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/bulk/job/bulk_abc123

# Schedule bulk send (1 hour from now)
curl -X POST http://localhost:3000/test1/bulk/send \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "recipients": ["628123456789"],
    "message": {"type": "text", "content": "Reminder!"},
    "schedule": 1721620800000
  }'
\\\

**Acceptance Criteria:**
1. ✅ Bulk send API working (max 1000 recipients)
2. ✅ Template variables replacement working
3. ✅ Anti-spam delays enforced (3s between messages)
4. ✅ Rate limiting enforced (20 msg/min per session)
5. ✅ Scheduled messages working
6. ✅ Dry-run mode working
7. ✅ Bulk job tracking working (sent/failed/pending)
8. ✅ Delivery reporting complete

---

## **TASK 4: Group Management Features**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di WhatsApp Business API, group administration, dan permission management.

### **ROLE**
Bertindak sebagai Feature Engineer yang bertanggung jawab untuk implementing comprehensive WhatsApp group management capabilities.

### **CONTEXT**

**Current State:**
- Tidak ada group management API
- Tidak bisa create/join/leave groups
- Tidak bisa manage group members
- Tidak bisa update group settings
- Tidak bisa get group info

**Missing Features:**
- Create group
- Get group info (name, description, participants)
- Add/remove participants
- Promote/demote admins
- Update group settings (name, description, icon)
- Leave group
- Get group invite link
- Join group via invite link
- Get participant list

**Requirements:**
1. Implement create group API
2. Add get group info endpoint
3. Implement add/remove participants
4. Add promote/demote admin
5. Implement update group settings
6. Add leave group endpoint
7. Implement invite link generation
8. Add join via invite link
9. Create group management documentation

**Technical Specs:**

**Group Permissions:**
- Only group admins can: add/remove members, change settings, promote/demote
- Bot must be admin to perform admin actions
- Validate permissions before operations

**Files to Create/Modify:**
- src/services/GroupService.ts - Group management logic
- src/controllers/GroupController.ts - Group endpoints
- src/routes/group.ts - Group routes
- src/utils/group-validator.ts - Group validation utilities
- docs/GROUP_MANAGEMENT.md - Group management guide

**Implementation Example:**

src/services/GroupService.ts:
\\\	ypescript
import { getSockOrThrow, toJid } from "../wa-manager";
import { ValidationError, AuthorizationError } from "../errors/AppError";
import { logger } from "../config/logger";

export class GroupService {
  static async createGroup(
    session: string,
    name: string,
    participants: string[]
  ) {
    const sock = await getSockOrThrow(session);

    if (!name || name.trim().length === 0) {
      throw new ValidationError("Group name required");
    }

    if (participants.length === 0) {
      throw new ValidationError("At least one participant required");
    }

    // Convert phone numbers to JIDs
    const participantJids = participants.map(toJid);

    try {
      const group = await sock.groupCreate(name, participantJids);

      logger.info({
        session,
        groupId: group.id,
        name,
        participants: participants.length,
        msg: "Group created",
      });

      return {
        ok: true,
        groupId: group.id,
        name,
        participants: group.participants,
      };
    } catch (error) {
      logger.error({
        session,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to create group",
      });
      throw error;
    }
  }

  static async getGroupInfo(session: string, groupId: string) {
    const sock = await getSockOrThrow(session);

    try {
      const metadata = await sock.groupMetadata(groupId);

      return {
        ok: true,
        group: {
          id: metadata.id,
          name: metadata.subject,
          description: metadata.desc,
          owner: metadata.owner,
          creation: metadata.creation,
          participants: metadata.participants.map((p) => ({
            id: p.id,
            isAdmin: p.admin !== null,
            isSuperAdmin: p.admin === "superadmin",
          })),
          participantCount: metadata.participants.length,
          announce: metadata.announce, // Only admins can send messages
          restrict: metadata.restrict, // Only admins can edit group info
        },
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to get group info",
      });
      throw error;
    }
  }

  static async addParticipants(
    session: string,
    groupId: string,
    participants: string[]
  ) {
    const sock = await getSockOrThrow(session);

    if (participants.length === 0) {
      throw new ValidationError("At least one participant required");
    }

    const participantJids = participants.map(toJid);

    try {
      const result = await sock.groupParticipantsUpdate(
        groupId,
        participantJids,
        "add"
      );

      logger.info({
        session,
        groupId,
        added: participants.length,
        msg: "Participants added",
      });

      return {
        ok: true,
        groupId,
        results: result,
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to add participants",
      });
      throw error;
    }
  }

  static async removeParticipants(
    session: string,
    groupId: string,
    participants: string[]
  ) {
    const sock = await getSockOrThrow(session);

    if (participants.length === 0) {
      throw new ValidationError("At least one participant required");
    }

    const participantJids = participants.map(toJid);

    try {
      const result = await sock.groupParticipantsUpdate(
        groupId,
        participantJids,
        "remove"
      );

      logger.info({
        session,
        groupId,
        removed: participants.length,
        msg: "Participants removed",
      });

      return {
        ok: true,
        groupId,
        results: result,
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to remove participants",
      });
      throw error;
    }
  }

  static async promoteToAdmin(
    session: string,
    groupId: string,
    participants: string[]
  ) {
    const sock = await getSockOrThrow(session);

    if (participants.length === 0) {
      throw new ValidationError("At least one participant required");
    }

    const participantJids = participants.map(toJid);

    try {
      const result = await sock.groupParticipantsUpdate(
        groupId,
        participantJids,
        "promote"
      );

      logger.info({
        session,
        groupId,
        promoted: participants.length,
        msg: "Participants promoted to admin",
      });

      return {
        ok: true,
        groupId,
        results: result,
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to promote participants",
      });
      throw error;
    }
  }

  static async demoteFromAdmin(
    session: string,
    groupId: string,
    participants: string[]
  ) {
    const sock = await getSockOrThrow(session);

    if (participants.length === 0) {
      throw new ValidationError("At least one participant required");
    }

    const participantJids = participants.map(toJid);

    try {
      const result = await sock.groupParticipantsUpdate(
        groupId,
        participantJids,
        "demote"
      );

      logger.info({
        session,
        groupId,
        demoted: participants.length,
        msg: "Participants demoted from admin",
      });

      return {
        ok: true,
        groupId,
        results: result,
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to demote participants",
      });
      throw error;
    }
  }

  static async updateGroupSettings(
    session: string,
    groupId: string,
    settings: {
      name?: string;
      description?: string;
      announce?: boolean; // true = only admins can send
      restrict?: boolean; // true = only admins can edit info
    }
  ) {
    const sock = await getSockOrThrow(session);

    try {
      if (settings.name !== undefined) {
        await sock.groupUpdateSubject(groupId, settings.name);
      }

      if (settings.description !== undefined) {
        await sock.groupUpdateDescription(groupId, settings.description);
      }

      if (settings.announce !== undefined) {
        await sock.groupSettingUpdate(
          groupId,
          settings.announce ? "announcement" : "not_announcement"
        );
      }

      if (settings.restrict !== undefined) {
        await sock.groupSettingUpdate(
          groupId,
          settings.restrict ? "locked" : "unlocked"
        );
      }

      logger.info({
        session,
        groupId,
        settings,
        msg: "Group settings updated",
      });

      return { ok: true, groupId, updated: settings };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to update group settings",
      });
      throw error;
    }
  }

  static async leaveGroup(session: string, groupId: string) {
    const sock = await getSockOrThrow(session);

    try {
      await sock.groupLeave(groupId);

      logger.info({
        session,
        groupId,
        msg: "Left group",
      });

      return { ok: true, groupId };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to leave group",
      });
      throw error;
    }
  }

  static async getInviteCode(session: string, groupId: string) {
    const sock = await getSockOrThrow(session);

    try {
      const code = await sock.groupInviteCode(groupId);

      return {
        ok: true,
        groupId,
        inviteCode: code,
        inviteLink: \https://chat.whatsapp.com/\\,
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to get invite code",
      });
      throw error;
    }
  }

  static async revokeInviteCode(session: string, groupId: string) {
    const sock = await getSockOrThrow(session);

    try {
      const newCode = await sock.groupRevokeInvite(groupId);

      logger.info({
        session,
        groupId,
        msg: "Invite code revoked",
      });

      return {
        ok: true,
        groupId,
        inviteCode: newCode,
        inviteLink: \https://chat.whatsapp.com/\\,
      };
    } catch (error) {
      logger.error({
        session,
        groupId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to revoke invite code",
      });
      throw error;
    }
  }

  static async joinViaInviteCode(session: string, inviteCode: string) {
    const sock = await getSockOrThrow(session);

    try {
      const result = await sock.groupAcceptInvite(inviteCode);

      logger.info({
        session,
        inviteCode,
        groupId: result,
        msg: "Joined group via invite",
      });

      return {
        ok: true,
        groupId: result,
        inviteCode,
      };
    } catch (error) {
      logger.error({
        session,
        inviteCode,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to join group",
      });
      throw error;
    }
  }
}
\\\

src/controllers/GroupController.ts:
\\\	ypescript
import { GroupService } from "../services/GroupService";

export class GroupController {
  static async createGroup({ params, body, set }: any) {
    try {
      const session = params.session;
      const { name, participants } = body;

      if (!name || !participants) {
        set.status = 400;
        return { status: "error", message: "name & participants required" };
      }

      return {
        status: "success",
        message: "Group created successfully",
        data: await GroupService.createGroup(session, name, participants),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to create group",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getGroupInfo({ params }: any) {
    try {
      const { session, groupId } = params;

      return {
        status: "success",
        data: await GroupService.getGroupInfo(session, groupId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get group info",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async addParticipants({ params, body, set }: any) {
    try {
      const { session, groupId } = params;
      const { participants } = body;

      if (!participants) {
        set.status = 400;
        return { status: "error", message: "participants required" };
      }

      return {
        status: "success",
        message: "Participants added",
        data: await GroupService.addParticipants(session, groupId, participants),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to add participants",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async removeParticipants({ params, body, set }: any) {
    try {
      const { session, groupId } = params;
      const { participants } = body;

      if (!participants) {
        set.status = 400;
        return { status: "error", message: "participants required" };
      }

      return {
        status: "success",
        message: "Participants removed",
        data: await GroupService.removeParticipants(session, groupId, participants),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to remove participants",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async promoteToAdmin({ params, body, set }: any) {
    try {
      const { session, groupId } = params;
      const { participants } = body;

      if (!participants) {
        set.status = 400;
        return { status: "error", message: "participants required" };
      }

      return {
        status: "success",
        message: "Participants promoted to admin",
        data: await GroupService.promoteToAdmin(session, groupId, participants),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to promote participants",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async updateSettings({ params, body }: any) {
    try {
      const { session, groupId } = params;

      return {
        status: "success",
        message: "Group settings updated",
        data: await GroupService.updateGroupSettings(session, groupId, body),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to update settings",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async leaveGroup({ params }: any) {
    try {
      const { session, groupId } = params;

      return {
        status: "success",
        message: "Left group successfully",
        data: await GroupService.leaveGroup(session, groupId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to leave group",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getInviteLink({ params }: any) {
    try {
      const { session, groupId } = params;

      return {
        status: "success",
        data: await GroupService.getInviteCode(session, groupId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get invite link",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async joinViaInvite({ params, body, set }: any) {
    try {
      const session = params.session;
      const { inviteCode } = body;

      if (!inviteCode) {
        set.status = 400;
        return { status: "error", message: "inviteCode required" };
      }

      return {
        status: "success",
        message: "Joined group successfully",
        data: await GroupService.joinViaInviteCode(session, inviteCode),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to join group",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
\\\

src/routes/group.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { GroupController } from "../controllers/GroupController";

export const groupRoutes = new Elysia({ prefix: "/:session/group" })
  .post("/create", (ctx) => GroupController.createGroup(ctx))
  .get("/:groupId", (ctx) => GroupController.getGroupInfo(ctx))
  .post("/:groupId/participants/add", (ctx) => GroupController.addParticipants(ctx))
  .post("/:groupId/participants/remove", (ctx) => GroupController.removeParticipants(ctx))
  .post("/:groupId/admins/promote", (ctx) => GroupController.promoteToAdmin(ctx))
  .post("/:groupId/admins/demote", (ctx) => GroupController.demoteFromAdmin(ctx))
  .patch("/:groupId/settings", (ctx) => GroupController.updateSettings(ctx))
  .post("/:groupId/leave", (ctx) => GroupController.leaveGroup(ctx))
  .get("/:groupId/invite", (ctx) => GroupController.getInviteLink(ctx))
  .post("/:groupId/invite/revoke", (ctx) => GroupController.revokeInviteLink(ctx))
  .post("/join", (ctx) => GroupController.joinViaInvite(ctx));
\\\

**API Examples:**
\\\ash
# Create group
curl -X POST http://localhost:3000/test1/group/create \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "name": "My Group",
    "participants": ["628123456789", "628987654321"]
  }'

# Get group info
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/group/120363025783457581@g.us

# Add participants
curl -X POST http://localhost:3000/test1/group/120363025783457581@g.us/participants/add \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{"participants": ["628111222333"]}'

# Promote to admin
curl -X POST http://localhost:3000/test1/group/120363025783457581@g.us/admins/promote \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{"participants": ["628123456789"]}'

# Update group settings
curl -X PATCH http://localhost:3000/test1/group/120363025783457581@g.us/settings \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{
    "name": "Updated Group Name",
    "description": "New description",
    "announce": true
  }'

# Get invite link
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/group/120363025783457581@g.us/invite

# Join via invite
curl -X POST http://localhost:3000/test1/group/join \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{"inviteCode": "ABC123XYZ"}'
\\\

**Acceptance Criteria:**
1. ✅ Create group working
2. ✅ Get group info working
3. ✅ Add/remove participants working
4. ✅ Promote/demote admin working
5. ✅ Update group settings working
6. ✅ Leave group working
7. ✅ Get/revoke invite link working
8. ✅ Join via invite link working
9. ✅ Permission validation working
10. ✅ All endpoints documented

---

## **TASK 5: Contact Management & Sync**

### **MODEL**
Kamu adalah Senior Backend Engineer dengan expertise di contact synchronization, vCard handling, dan data privacy.

### **ROLE**
Bertindak sebagai Feature Engineer yang bertanggung jawab untuk implementing contact management dan synchronization features.

### **CONTEXT**

**Current State:**
- Tidak ada contact list API
- Tidak bisa get contact details
- Tidak bisa sync contacts dari WhatsApp
- Tidak ada contact search
- Tidak ada contact profile picture retrieval

**Missing Features:**
- Get contact list (synced contacts)
- Get contact details (name, status, profile picture)
- Search contacts
- Check if number is on WhatsApp
- Get contact profile picture
- Block/unblock contacts
- Contact presence (online/offline)

**Requirements:**
1. Implement get contact list endpoint
2. Add get contact details endpoint
3. Implement contact search
4. Add "check on WhatsApp" endpoint
5. Implement get profile picture
6. Add block/unblock contact
7. Add contact presence subscription
8. Create contact privacy documentation

**Technical Specs:**

**Contact Data Structure:**
`	ypescript
type Contact = {
  id: string; // JID
  name?: string;
  pushName?: string;
  isOnWhatsApp: boolean;
  status?: string;
  profilePictureUrl?: string;
  isBlocked: boolean;
  lastSeen?: number;
  isOnline?: boolean;
};
`

**Files to Create/Modify:**
- src/services/ContactService.ts - Contact management logic
- src/controllers/ContactController.ts - Contact endpoints
- src/routes/contact.ts - Contact routes
- docs/CONTACT_PRIVACY.md - Contact privacy guide

**Implementation Example:**

src/services/ContactService.ts:
\\\	ypescript
import { getSockOrThrow, toJid } from "../wa-manager";
import { logger } from "../config/logger";
import { NotFoundError } from "../errors/AppError";

export class ContactService {
  static async getContactList(session: string) {
    const sock = await getSockOrThrow(session);

    try {
      const contacts = await sock.store?.contacts;

      if (!contacts) {
        return { ok: true, contacts: [] };
      }

      const contactList = Object.entries(contacts).map(([jid, contact]) => ({
        id: jid,
        name: (contact as any).name,
        notify: (contact as any).notify,
      }));

      return {
        ok: true,
        contacts: contactList,
        count: contactList.length,
      };
    } catch (error) {
      logger.error({
        session,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to get contact list",
      });
      throw error;
    }
  }

  static async getContactDetails(session: string, contactId: string) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(contactId);

    try {
      // Get contact info
      const [status, profilePicture] = await Promise.allSettled([
        sock.fetchStatus(jid),
        sock.profilePictureUrl(jid, "image"),
      ]);

      const contact: any = {
        id: jid,
        isOnWhatsApp: true,
      };

      if (status.status === "fulfilled") {
        contact.status = status.value?.status;
        contact.setAt = status.value?.setAt;
      }

      if (profilePicture.status === "fulfilled") {
        contact.profilePictureUrl = profilePicture.value;
      }

      return { ok: true, contact };
    } catch (error) {
      logger.error({
        session,
        contactId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to get contact details",
      });
      throw error;
    }
  }

  static async checkOnWhatsApp(session: string, phoneNumbers: string[]) {
    const sock = await getSockOrThrow(session);

    try {
      const jids = phoneNumbers.map(toJid);
      const results = await sock.onWhatsApp(...jids);

      return {
        ok: true,
        results: results.map((r) => ({
          phoneNumber: r.jid.replace(/@.*/, ""),
          jid: r.jid,
          exists: r.exists,
        })),
      };
    } catch (error) {
      logger.error({
        session,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to check WhatsApp presence",
      });
      throw error;
    }
  }

  static async getProfilePicture(
    session: string,
    contactId: string,
    highQuality: boolean = false
  ) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(contactId);

    try {
      const url = await sock.profilePictureUrl(
        jid,
        highQuality ? "image" : "preview"
      );

      if (!url) {
        throw new NotFoundError("Profile picture");
      }

      return {
        ok: true,
        contactId,
        profilePictureUrl: url,
      };
    } catch (error) {
      logger.error({
        session,
        contactId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to get profile picture",
      });
      throw error;
    }
  }

  static async blockContact(session: string, contactId: string) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(contactId);

    try {
      await sock.updateBlockStatus(jid, "block");

      logger.info({
        session,
        contactId,
        msg: "Contact blocked",
      });

      return { ok: true, contactId, blocked: true };
    } catch (error) {
      logger.error({
        session,
        contactId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to block contact",
      });
      throw error;
    }
  }

  static async unblockContact(session: string, contactId: string) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(contactId);

    try {
      await sock.updateBlockStatus(jid, "unblock");

      logger.info({
        session,
        contactId,
        msg: "Contact unblocked",
      });

      return { ok: true, contactId, blocked: false };
    } catch (error) {
      logger.error({
        session,
        contactId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to unblock contact",
      });
      throw error;
    }
  }

  static async getPresence(session: string, contactId: string) {
    const sock = await getSockOrThrow(session);
    const jid = toJid(contactId);

    try {
      // Subscribe to presence updates
      await sock.presenceSubscribe(jid);

      // Wait a bit for presence update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get presence from store (if available)
      const presences = await sock.store?.presences?.[jid];

      return {
        ok: true,
        contactId,
        presence: presences || { available: false },
      };
    } catch (error) {
      logger.error({
        session,
        contactId,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to get presence",
      });
      throw error;
    }
  }

  static async updateProfileName(session: string, name: string) {
    const sock = await getSockOrThrow(session);

    try {
      await sock.updateProfileName(name);

      logger.info({
        session,
        name,
        msg: "Profile name updated",
      });

      return { ok: true, name };
    } catch (error) {
      logger.error({
        session,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to update profile name",
      });
      throw error;
    }
  }

  static async updateProfileStatus(session: string, status: string) {
    const sock = await getSockOrThrow(session);

    try {
      await sock.updateProfileStatus(status);

      logger.info({
        session,
        status,
        msg: "Profile status updated",
      });

      return { ok: true, status };
    } catch (error) {
      logger.error({
        session,
        error: error instanceof Error ? error.message : String(error),
        msg: "Failed to update profile status",
      });
      throw error;
    }
  }
}
\\\

src/controllers/ContactController.ts:
\\\	ypescript
import { ContactService } from "../services/ContactService";

export class ContactController {
  static async getContactList({ params }: any) {
    try {
      const session = params.session;

      return {
        status: "success",
        data: await ContactService.getContactList(session),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get contact list",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getContactDetails({ params }: any) {
    try {
      const { session, contactId } = params;

      return {
        status: "success",
        data: await ContactService.getContactDetails(session, contactId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get contact details",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async checkOnWhatsApp({ params, body, set }: any) {
    try {
      const session = params.session;
      const { phoneNumbers } = body;

      if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
        set.status = 400;
        return { status: "error", message: "phoneNumbers array required" };
      }

      return {
        status: "success",
        data: await ContactService.checkOnWhatsApp(session, phoneNumbers),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to check WhatsApp",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getProfilePicture({ params, query }: any) {
    try {
      const { session, contactId } = params;
      const highQuality = query.highQuality === "true";

      return {
        status: "success",
        data: await ContactService.getProfilePicture(session, contactId, highQuality),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get profile picture",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async blockContact({ params }: any) {
    try {
      const { session, contactId } = params;

      return {
        status: "success",
        message: "Contact blocked",
        data: await ContactService.blockContact(session, contactId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to block contact",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async unblockContact({ params }: any) {
    try {
      const { session, contactId } = params;

      return {
        status: "success",
        message: "Contact unblocked",
        data: await ContactService.unblockContact(session, contactId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to unblock contact",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async getPresence({ params }: any) {
    try {
      const { session, contactId } = params;

      return {
        status: "success",
        data: await ContactService.getPresence(session, contactId),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to get presence",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async updateProfileName({ params, body, set }: any) {
    try {
      const session = params.session;
      const { name } = body;

      if (!name) {
        set.status = 400;
        return { status: "error", message: "name required" };
      }

      return {
        status: "success",
        message: "Profile name updated",
        data: await ContactService.updateProfileName(session, name),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to update profile name",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async updateProfileStatus({ params, body, set }: any) {
    try {
      const session = params.session;
      const { status: statusText } = body;

      if (!statusText) {
        set.status = 400;
        return { status: "error", message: "status required" };
      }

      return {
        status: "success",
        message: "Profile status updated",
        data: await ContactService.updateProfileStatus(session, statusText),
      };
    } catch (error) {
      return {
        status: "error",
        message: "Failed to update profile status",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
\\\

src/routes/contact.ts:
\\\	ypescript
import { Elysia } from "elysia";
import { ContactController } from "../controllers/ContactController";

export const contactRoutes = new Elysia({ prefix: "/:session/contact" })
  .get("/list", (ctx) => ContactController.getContactList(ctx))
  .get("/:contactId", (ctx) => ContactController.getContactDetails(ctx))
  .post("/check", (ctx) => ContactController.checkOnWhatsApp(ctx))
  .get("/:contactId/picture", (ctx) => ContactController.getProfilePicture(ctx))
  .post("/:contactId/block", (ctx) => ContactController.blockContact(ctx))
  .post("/:contactId/unblock", (ctx) => ContactController.unblockContact(ctx))
  .get("/:contactId/presence", (ctx) => ContactController.getPresence(ctx))
  .patch("/profile/name", (ctx) => ContactController.updateProfileName(ctx))
  .patch("/profile/status", (ctx) => ContactController.updateProfileStatus(ctx));
\\\

**API Examples:**
\\\ash
# Get contact list
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/contact/list

# Get contact details
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/contact/628123456789

# Check if numbers on WhatsApp
curl -X POST http://localhost:3000/test1/contact/check \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{"phoneNumbers": ["628123456789", "628987654321"]}'

# Get profile picture (high quality)
curl -H "X-API-Key: sk_live_xxx" \\
  "http://localhost:3000/test1/contact/628123456789/picture?highQuality=true"

# Block contact
curl -X POST http://localhost:3000/test1/contact/628123456789/block \\
  -H "X-API-Key: sk_live_xxx"

# Get presence (online/offline)
curl -H "X-API-Key: sk_live_xxx" \\
  http://localhost:3000/test1/contact/628123456789/presence

# Update own profile name
curl -X PATCH http://localhost:3000/test1/contact/profile/name \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{"name": "My Bot Name"}'

# Update own profile status
curl -X PATCH http://localhost:3000/test1/contact/profile/status \\
  -H "X-API-Key: sk_live_xxx" \\
  -d '{"status": "Available 24/7"}'
\\\

**Acceptance Criteria:**
1. ✅ Get contact list working
2. ✅ Get contact details working
3. ✅ Check on WhatsApp working
4. ✅ Get profile picture working (low & high quality)
5. ✅ Block/unblock contact working
6. ✅ Get presence working
7. ✅ Update own profile working
8. ✅ Privacy considerations documented

---

## **TASK 6: Admin Dashboard (Optional)**

### **MODEL**
Kamu adalah Full-Stack Engineer dengan expertise di React, dashboard design, dan real-time data visualization.

### **ROLE**
Bertindak sebagai Frontend Engineer yang bertanggung jawab untuk building admin dashboard untuk monitoring dan management.

### **CONTEXT**

**Current State:**
- Tidak ada visual interface
- Semua management via API calls
- Tidak ada real-time monitoring
- Tidak ada analytics visualization

**Requirements:**
1. Create React-based admin dashboard
2. Add session management UI
3. Add message history viewer
4. Add bulk job monitor
5. Add metrics visualization
6. Add webhook management UI
7. Add real-time updates (WebSocket/SSE)

**Note:** Task ini optional dan bisa dikerjakan parallel atau setelah API features selesai.

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- UI Library: Shadcn/ui + Tailwind CSS
- Charts: Recharts
- Real-time: Server-Sent Events (SSE)

**Acceptance Criteria:**
1. ✅ Dashboard shows session status real-time
2. ✅ Message history viewable
3. ✅ Bulk job progress visible
4. ✅ Metrics charts working
5. ✅ Webhook CRUD interface
6. ✅ Responsive design

---

## **INTEGRATION TASK: Combine All Phase 3 Changes**

### **MODEL**
Kamu adalah Lead Backend Engineer dengan expertise di system integration dan API design.

### **ROLE**
Bertindak sebagai Technical Lead yang bertanggung jawab untuk integrating all feature improvements.

### **CONTEXT**

**Goal:**
Integrate semua 5-6 tasks di atas menjadi comprehensive feature set.

**Integration Checklist:**
1. ✅ All message types supported
2. ✅ Message status tracking working
3. ✅ Bulk messaging working dengan anti-spam
4. ✅ Group management complete
5. ✅ Contact management complete
6. ✅ All routes registered
7. ✅ All endpoints documented
8. ✅ Rate limiting tuned for new features

**Final Route Structure:**
\\\
/:session/message/*          # Message operations
/:session/bulk/*              # Bulk messaging
/:session/group/*             # Group management
/:session/contact/*           # Contact management
/:session/webhook/*           # Webhook config
/:session/session/*           # Session management
/admin/*                      # Admin operations
/health                       # Health checks
/metrics                      # Prometheus metrics
\\\

**Update src/routes/index.ts:**
\\\	ypescript
import { Elysia } from "elysia";
import { sessionRoutes } from "./session";
import { messageRoutes } from "./message";
import { bulkRoutes } from "./bulk";
import { groupRoutes } from "./group";
import { contactRoutes } from "./contact";
import { webhookRoutes } from "./webhook";
import { adminRoutes } from "./admin";

export const routes = new Elysia()
  .use(sessionRoutes)
  .use(messageRoutes)
  .use(bulkRoutes)
  .use(groupRoutes)
  .use(contactRoutes)
  .use(webhookRoutes)
  .use(adminRoutes);
\\\

**Documentation Structure:**
\\\
docs/
├── API.md                    # Complete API reference
├── MESSAGE_TYPES.md          # All message types guide
├── BULK_MESSAGING.md         # Bulk send guide
├── GROUP_MANAGEMENT.md       # Group operations guide
├── CONTACT_PRIVACY.md        # Contact & privacy guide
├── WEBHOOK_SECURITY.md       # Webhook security (Phase 1)
├── ERROR_HANDLING.md         # Error handling (Phase 2)
└── EXAMPLES.md               # Code examples
\\\

**Testing Scenarios:**
1. Send all message types
2. Track message delivery status
3. Send bulk messages to 100 recipients
4. Create and manage group
5. Sync and query contacts
6. Monitor metrics and health

**Success Metrics:**
- ✅ All 5 message types supported
- ✅ Message delivery rate >99%
- ✅ Bulk send: 20 msg/min maintained
- ✅ Group operations <2s response time
- ✅ Contact sync <5s for 1000 contacts
- ✅ API documentation 100% complete

**Estimated Timeline:**
- Task 1 (Message Types): 3 days
- Task 2 (Status Tracking): 2 days
- Task 3 (Bulk Messaging): 3 days
- Task 4 (Group Management): 2.5 days
- Task 5 (Contact Management): 2 days
- Task 6 (Dashboard - Optional): 3-5 days
- Integration & Testing: 2 days
- **Total: 14-18 days** (1 developer, full-time, excluding dashboard)

---

**Generated:** 2026-07-22T02:05:30Z  
**Status:** ✅ Ready to execute
