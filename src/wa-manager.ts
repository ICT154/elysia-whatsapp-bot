import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "baileys";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import QRCode from "qrcode";

type SessionState = {
    name: string;
    sock?: ReturnType<typeof makeWASocket>;
    qr?: string;
    connected: boolean;
    lastUpdateAt: number;
};

const sessions = new Map<string, SessionState>();

function getAuthDir(name: string) {
    return `auth_info/${name}`;
}

export async function ensureSession(name: string) {

    const existing = sessions.get(name);
    if (existing?.sock) return existing;

    const authDir = getAuthDir(name);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const s: SessionState = existing ?? {
        name,
        connected: false,
        lastUpdateAt: Date.now(),
    };
    sessions.set(name, s);

    const sock = makeWASocket({ auth: state });
    s.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        s.lastUpdateAt = Date.now();

        if (qr) {
            s.qr = qr;
            s.connected = false;
        }

        if (connection === "open") {
            s.connected = true;
            s.qr = undefined;
        }

        if (connection === "close") {
            s.connected = false;

            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                sessions.set(name, { ...s, sock: undefined });
                ensureSession(name).catch(() => { });
            } else {
                s.sock = undefined;
            }
        }
    });

    return s;
}

export function getSessionInfo(name: string) {
    return sessions.get(name);
}

export async function getQrDataUrl(name: string) {
    const s = await ensureSession(name);

    if (s.connected) {
        return { status: "connected" as const, qr: null, qrDataUrl: null };
    }

    if (!s.qr) {
        return { status: "waiting_qr" as const, qr: null, qrDataUrl: null };
    }

    const qrDataUrl = await QRCode.toDataURL(s.qr);
    return { status: "qr_ready" as const, qr: s.qr, qrDataUrl };
}

export async function deleteSession(name: string) {
    const s = sessions.get(name);

    try {
        s?.sock?.end?.(new Error("session deleted"));
    } catch { }

    sessions.delete(name);

    const authDir = getAuthDir(name);
    if (existsSync(authDir)) {
        await rm(authDir, { recursive: true, force: true });
    }

    return { ok: true };
}

export async function checkSession(name: string) {
    const s = sessions.get(name);
    if (!s) return { status: "not_started" as const };

    if (s.connected) return { status: "connected" as const };

    if (s.qr) return { status: "qr_ready" as const };

    return { status: "waiting_qr" as const };
}

export async function getSockOrThrow(name: string) {
    const s = await ensureSession(name);

    if (!s.sock) throw new Error("socket_not_ready");

    if (!s.connected) {
        throw new Error("session_not_connected");
    }

    return s.sock;
}

export function toJid(phone: string) {
    // 62812xxxx -> 62812xxxx@s.whatsapp.net
    const digits = phone.replace(/\D/g, "");
    return `${digits}@s.whatsapp.net`;
}

