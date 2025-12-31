import { Elysia } from "elysia";
import {
    getQrDataUrl,
    deleteSession,
    checkSession,
    ensureSession,
} from "./wa-manager";

const app = new Elysia()
    .get("/", () => "OK")

    .get("/session/qr/get/:name", async ({ params }) => {
        const { name } = params;
        const result = await getQrDataUrl(name);

        return {
            ok: true,
            session: name,
            ...result,
            // result.qrDataUrl ini bisa langsung dipakai <img src="...">
        };
    })

    // CHECK
    // http://localhost:3000/session/qr/check/nama_session
    .get("/session/qr/check/:name", async ({ params }) => {
        const { name } = params;
        const status = await checkSession(name);
        return { ok: true, session: name, ...status };
    })

    // DELETE
    // http://localhost:3000/session/qr/delete/nama_session
    .delete("/session/qr/delete/:name", async ({ params }) => {
        const { name } = params;
        return await deleteSession(name);
    })

    // (Opsional) route buat “start” session dulu tanpa ambil QR
    .post("/session/start/:name", async ({ params }) => {
        const { name } = params;
        await ensureSession(name);
        return { ok: true, session: name };
    })

    .listen(3000);

console.log(`🦊 Elysia running on http://localhost:${app.server?.port}`);
