import { setWebhook, getWebhook, deleteWebhook } from "../webhook/WebhookManager";

export class WebhookController {
    static async set({ params, body, set: httpSet }: any) {
        try {
            const session = params.session;
            const { url, secret } = body as { url: string; secret?: string };

            if (!url) {
                httpSet.status = 400;
                return { status: 'error', message: "URL is required" };
            }

            return {
                status: 'success',
                message: 'Webhook set successfully',
                data: await setWebhook(session, url, secret)
            }

        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to set webhook',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async get({ params }: any) {
        try {
            return {
                status: 'success',
                message: 'Webhook retrieved successfully',
                data: await getWebhook(params.session)
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to get webhook',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async remove({ params }: any) {
        try {
            return {
                status: 'success',
                message: 'Webhook removed successfully',
                data: await deleteWebhook(params.session)
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to remove webhook',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
