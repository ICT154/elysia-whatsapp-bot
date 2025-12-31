import fs from "fs";
import path from "path";
import mime from "mime-types";
import { getSockOrThrow, toJid } from "../wa-manager";

export class MessageService {
    static async sendText(session: string, to: string, text: string) {
        const sock = await getSockOrThrow(session);
        const jid = toJid(to);
        await sock.sendMessage(jid, { text }); // text message :contentReference[oaicite:1]{index=1}
        return { ok: true };
    }

    static async sendImageFromUrl(session: string, to: string, imageUrl: string, caption?: string) {
        const sock = await getSockOrThrow(session);
        const jid = toJid(to);

        // Baileys bisa kirim media dari URL (dia handle download/encrypt stream) :contentReference[oaicite:2]{index=2}
        await sock.sendMessage(jid, { image: { url: imageUrl }, caption });
        return { ok: true };
    }

    static async sendImageFromFile(session: string, to: string, filePath: string, caption?: string) {
        const sock = await getSockOrThrow(session);
        const jid = toJid(to);

        const buf = fs.readFileSync(filePath);
        await sock.sendMessage(jid, { image: buf, caption }); // media message :contentReference[oaicite:3]{index=3}
        return { ok: true };
    }

    static async sendDocumentFromFile(
        session: string,
        to: string,
        filePath: string,
        fileName?: string,
        mimetype?: string,
        caption?: string
    ) {
        const sock = await getSockOrThrow(session);
        const jid = toJid(to);

        const buf = fs.readFileSync(filePath);
        const mt = mimetype || mime.lookup(filePath) || "application/octet-stream";
        await sock.sendMessage(jid, {
            document: buf,
            fileName: fileName ?? path.basename(filePath),
            mimetype: mt, // contoh: "application/pdf"
            caption,
        }); // document message :contentReference[oaicite:4]{index=4}

        return { ok: true };
    }
}
