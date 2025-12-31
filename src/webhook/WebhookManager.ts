import { existsSync } from "fs";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

type WebhookConfig = {
    url: string;
    secret?: string;
};

const DATA_DIR = "data";
const FILE_PATH = path.join(DATA_DIR, "webhooks.json");

const webhookBySession = new Map<string, WebhookConfig>();

let writeLock: Promise<void> = Promise.resolve();

async function ensureDataDir() {
    await mkdir(DATA_DIR, { recursive: true });
}

async function loadFromFile() {
    await ensureDataDir();

    if (!existsSync(FILE_PATH)) {
        await writeFile(FILE_PATH, JSON.stringify({}, null, 2), "utf-8");
        return;
    }

    try {
        const raw = await readFile(FILE_PATH, "utf-8");
        const obj = raw ? JSON.parse(raw) : {};

        webhookBySession.clear();
        for (const [session, cfg] of Object.entries(obj as Record<string, WebhookConfig>)) {
            if (cfg?.url) webhookBySession.set(session, cfg);
        }
    } catch (e) {
        const backup = path.join(DATA_DIR, `webhooks.bak.${Date.now()}.json`);
        try {
            await rename(FILE_PATH, backup);
        } catch { }
        webhookBySession.clear();
        await writeFile(FILE_PATH, JSON.stringify({}, null, 2), "utf-8");
    }
}

async function saveToFileAtomic() {
    await ensureDataDir();

    // convert map -> object
    const obj: Record<string, WebhookConfig> = {};
    for (const [k, v] of webhookBySession.entries()) obj[k] = v;

    const tmp = FILE_PATH + ".tmp";
    const data = JSON.stringify(obj, null, 2);

    await writeFile(tmp, data, "utf-8");
    await rename(tmp, FILE_PATH);
}

let loaded = false;
async function ensureLoaded() {
    if (loaded) return;
    await loadFromFile();
    loaded = true;
}

export async function setWebhook(session: string, url: string, secret?: string) {
    await ensureLoaded();

    webhookBySession.set(session, { url, secret });

    writeLock = writeLock.then(() => saveToFileAtomic());
    await writeLock;

    return { ok: true, session, url };
}

export async function getWebhook(session: string) {
    await ensureLoaded();

    const cfg = webhookBySession.get(session);
    return cfg ? { ok: true, session, ...cfg } : { ok: false, error: "webhook_not_set" };
}

export async function deleteWebhook(session: string) {
    await ensureLoaded();

    webhookBySession.delete(session);

    writeLock = writeLock.then(() => saveToFileAtomic());
    await writeLock;

    return { ok: true, session };
}

export async function resolveWebhook(session: string) {
    await ensureLoaded();
    return webhookBySession.get(session);
}
