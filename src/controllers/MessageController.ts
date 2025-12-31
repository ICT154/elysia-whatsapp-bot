import { MessageService } from "../services/MessageService";

export class MessageController {
    static async sendText({ params, body, set }: any) {
        const session = params.session;
        const { to, text } = body as { to: string; text: string };

        if (!to || !text) {
            set.status = 400;
            return { ok: false, error: "to & text wajib" };
        }

        return await MessageService.sendText(session, to, text);
    }

    static async sendImageUrl({ params, body, set }: any) {
        const session = params.session;
        const { to, imageUrl, caption } = body as { to: string; imageUrl: string; caption?: string };

        if (!to || !imageUrl) {
            set.status = 400;
            return { ok: false, error: "to & imageUrl wajib" };
        }

        return await MessageService.sendImageFromUrl(session, to, imageUrl, caption);
    }

    static async sendDocumentFile({ params, body, set }: any) {
        const session = params.session;
        const { to, filePath, fileName, mimetype, caption } = body as {
            to: string;
            filePath: string;
            fileName?: string;
            mimetype?: string;
            caption?: string;
        };

        if (!to || !filePath) {
            set.status = 400;
            return { ok: false, error: "to & filePath wajib" };
        }

        return await MessageService.sendDocumentFromFile(session, to, filePath, fileName, mimetype, caption);
    }
}
