import { setWebhook, getWebhook, deleteWebhook } from "../webhook/WebhookManager";

export class WebhookController {
    static async set({ params, body, set: httpSet }: any) {
        const session = params.session;
        const { url, secret } = body as { url: string; secret?: string };

        if (!url) {
            httpSet.status = 400;
            return { ok: false, error: "url wajib" };
        }

        return await setWebhook(session, url, secret);
    }

    static async get({ params }: any) {
        return await getWebhook(params.session);
    }

    static async remove({ params }: any) {
        return await deleteWebhook(params.session);
    }
}
