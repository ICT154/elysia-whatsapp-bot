import {
    getQrDataUrl,
    deleteSession,
    checkSession,
    ensureSession,
} from "../wa-manager";

export class SessionController {
    static async getQr({ params }: { params: { name: string } }) {
        const name = params.name;
        const result = await getQrDataUrl(name);

        return {
            ok: true,
            session: name,
            ...result,
            // result.qrDataUrl bisa dipakai langsung di <img src="...">
        };
    }

    static async checkQr({ params }: { params: { name: string } }) {
        const name = params.name;
        const status = await checkSession(name);

        return {
            ok: true,
            session: name,
            ...status,
        };
    }

    static async deleteQr({ params }: { params: { name: string } }) {
        const name = params.name;
        return await deleteSession(name);
    }

    static async startSession({ params }: { params: { name: string } }) {
        const name = params.name;
        await ensureSession(name);
        return { ok: true, session: name };
    }
}
