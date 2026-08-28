# WhatsApp Bot API

REST API untuk mengelola WhatsApp bot multi-session menggunakan [Baileys](https://github.com/WhiskeySockets/Baileys) library. Dibangun dengan runtime [Bun](https://bun.sh) dan framework [Elysia](https://elysiajs.com).

## Fitur

- **Multi-Session** - Jalankan beberapa akun WhatsApp secara bersamaan
- **QR Code Authentication** - Login melalui QR code
- **Webhook System** - Terima notifikasi pesan masuk secara otomatis
- **Kirim Pesan** - Text, gambar (URL), dokumen (file lokal), dan poll
- **Poll Vote Tracking** - Pantau vote dan kirim hasil ke webhook
- **Auto-Reconnect** - Koneksi otomatis reconnect saat terputus

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Bun |
| Framework | Elysia |
| WhatsApp Client | Baileys v7 |
| Language | TypeScript |

## Struktur Projek

```
whatsapp-bot-api/
├── src/
│   ├── index.ts                    # Entry point, setup CORS & routes
│   ├── wa.ts                       # Legacy routes (unused)
│   ├── wa-manager.ts               # Core: session management & message handling
│   ├── controllers/
│   │   ├── MessageController.ts    # Handler untuk kirim pesan
│   │   ├── SessionController.ts    # Handler untuk session management
│   │   └── WebhookController.ts    # Handler untuk webhook management
│   ├── routes/
│   │   ├── index.ts                # Route aggregator
│   │   ├── message.ts              # Message routes
│   │   ├── session.ts              # Session routes
│   │   └── webhook.ts              # Webhook routes
│   ├── services/
│   │   └── MessageService.ts       # Service untuk mengirim pesan via Baileys
│   ├── webhook/
│   │   └── WebhookManager.ts       # Webhook CRUD & persistence
│   └── poll/
│       └── PollStore.ts            # In-memory poll message storage
├── auth_info/                      # Session credentials (auto-generated)
├── data/                           # Webhook config storage
├── package.json
└── tsconfig.json
```

## Persiapan

### Prasyarat

- [Bun](https://bun.sh) >= 1.0

### Instalasi

```bash
# Clone repository
git clone <url>
cd whatsapp-bot-api

# Install dependencies
bun install
```

## Menjalankan

```bash
# Development (auto-reload)
bun run dev

# Production
bun run start
```

Server akan berjalan di `http://localhost:3000`.

## API Reference

### Base URL

```
http://localhost:3000
```

### Session Management

#### Start Session

Memulai session WhatsApp baru dan menunggu QR code.

```
POST /session/start/:name
```

**Parameter:**
- `name` (path) - Nama identifier session

**Response:**
```json
{
  "status": "success",
  "message": "Session started successfully",
  "data": { "session": "mybot" }
}
```

#### Get QR Code

Mengambil QR code untuk authentication. QR berupa data URL yang bisa langsung digunakan di `<img>` tag.

```
GET /session/qr/get/:name
```

**Response:**
```json
{
  "status": "success",
  "message": "QR retrieved successfully",
  "data": {
    "session": "mybot",
    "status": "qr_ready",
    "qr": "1@abc...",
    "qrDataUrl": "data:image/png;base64,..."
  }
}
```

**Status values:**
- `connected` - Session sudah terhubung, tidak perlu QR
- `qr_ready` - QR code tersedia, scan menggunakan WhatsApp
- `waiting_qr` - Session belum siap, coba lagi beberapa saat

#### Check Session Status

```
GET /session/qr/check/:name
```

**Response:**
```json
{
  "status": "success",
  "data": { "session": "mybot", "status": "connected" }
}
```

#### Delete Session

Menghapus session dan credentials yang tersimpan.

```
DELETE /session/qr/delete/:name
```

---

### Mengirim Pesan

Semua endpoint pesan menggunakan prefix `/:session/message` dimana `:session` adalah nama session yang sudah connected.

#### Send Text

```
POST /:session/message/text
```

**Body:**
```json
{
  "to": "62812xxxx",
  "text": "Halo, ini pesan dari bot!"
}
```

#### Send Image (URL)

```
POST /:session/message/image/url
```

**Body:**
```json
{
  "to": "62812xxxx",
  "imageUrl": "https://example.com/image.jpg",
  "text": "Caption gambar (opsional)"
}
```

#### Send Document (File Lokal)

```
POST /:session/message/document/file
```

**Body:**
```json
{
  "to": "62812xxxx",
  "filePath": "/absolute/path/to/file.pdf",
  "fileName": "dokumen.pdf",
  "mimetype": "application/pdf",
  "text": "Caption dokumen (opsional)"
}
```

**Catatan:**
- `mimetype` opsional, otomatis dideteksi dari ekstensi file
- `fileName` opsional, default menggunakan nama file dari path

#### Send Yes/No Poll

```
POST /:session/message/poll/yesno
```

**Body:**
```json
{
  "to": "62812xxxx",
  "question": "Apakah Anda setuju?",
  "yesValue": "Ya",
  "noValue": "Tidak"
}
```

**Catatan:**
- `yesValue` dan `noValue` opsional, default "Yes" dan "No"

---

### Webhook Management

Webhook digunakan untuk menerima notifikasi pesan masuk dari WhatsApp. Ketika ada pesan masuk, sistem akan otomatis forward ke URL webhook.

#### Set Webhook

```
POST /:session/webhook/set
```

**Body:**
```json
{
  "url": "https://your-app.com/webhook/whatsapp",
  "secret": "optional-secret-key"
}
```

#### Get Webhook Config

```
GET /:session/webhook/
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ok": true,
    "session": "mybot",
    "url": "https://your-app.com/webhook/whatsapp",
    "secret": "optional-secret-key"
  }
}
```

#### Delete Webhook

```
DELETE /:session/webhook/delete
```

---

### Webhook Payload

Saat ada pesan masuk, sistem akan mengirim POST request ke webhook URL dengan payload berikut:

#### Text Message

```json
{
  "session": "mybot",
  "from": "62812xxxx@s.whatsapp.net",
  "clearFrom": "62812xxxx",
  "isGroup": false,
  "messageId": "ABCD1234",
  "timestamp": 1690000000,
  "text": "Isi pesan",
  "raw": { }
}
```

#### Poll Vote

```json
{
  "session": "mybot",
  "type": "poll_vote",
  "from": "62812xxxx@s.whatsapp.net",
  "isGroup": false,
  "messageId": "ABCD1234",
  "poll": {
    "pollId": "poll-message-id",
    "selectedOption": "Ya",
    "answer": "YA"
  },
  "timestamp": 1690000000
}
```

**Catatan `poll.answer`:**
- `"YA"` - Jika opsi yang dipilih mengandung kata "ya"
- `"TIDAK"` - Jika opsi yang dipilih mengandung kata "tidak"
- `"UNKNOWN"` - Opsi lainnya

---

## Contoh Penggunaan

### 1. Login & Kirim Pesan

```bash
# Mulai session
curl -X POST http://localhost:3000/session/start/mybot

# Ambil QR code (buka WhatsApp > Linked Devices > Link a Device)
curl http://localhost:3000/session/qr/get/mybot

# Cek status (tunggu sampai "connected")
curl http://localhost:3000/session/qr/check/mybot

# Kirim pesan
curl -X POST http://localhost:3000/mybot/message/text \
  -H "Content-Type: application/json" \
  -d '{"to": "62812xxxx", "text": "Hello from bot!"}'
```

### 2. Setup Webhook

```bash
# Set webhook
curl -X POST http://localhost:3000/mybot/webhook/set \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.com/webhook"}'

# Kirim poll
curl -X POST http://localhost:3000/mybot/message/poll/yesno \
  -H "Content-Type: application/json" \
  -d '{"to": "62812xxxx", "question": "Setuju?"}'
```

---

## Format Nomor Telepon

Nomor telepon harus dalam format internasional tanpa tanda `+`. Contoh:
- `62812xxxx` (Indonesia)
- `1xxxxxxxxxx` (Amerika)

Sistem otomatis menambahkan suffix `@s.whatsapp.net` untuk mengubah ke JID format.

## Penyimpanan Data

| Direktori | Isi |
|-----------|-----|
| `auth_info/` | Credentials WhatsApp per session (auto-generated) |
| `data/webhooks.json` | Konfigurasi webhook per session |

**Penting:** Jangan commit direktori `auth_info/` dan `data/` ke version control.

## License

MIT
