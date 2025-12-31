import { status } from "elysia";
import { MessageService } from "../services/MessageService";

export class MessageController {
    static async sendText({ params, body, set }: any) {
        try {
            const session = params.session;
            const { to, text } = body as { to: string; text: string };

            if (!to || !text) {
                set.status = 400;
                return { status: 'error', message: "To & Text is required" };
            }

            return {
                status: 'success',
                message: 'Text message sent successfully',
                data: await MessageService.sendText(session, to, text)
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to send text message',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async sendImageUrl({ params, body, set }: any) {
        try {
            const session = params.session;
            const { to, imageUrl, text } = body as { to: string; imageUrl: string; text?: string };

            if (!to || !imageUrl) {
                set.status = 400;
                return { status: 'error', message: "To & imageUrl is required" };
            }

            return {
                status: 'success',
                message: 'Image from URL sent successfully',
                data: await MessageService.sendImageFromUrl(session, to, imageUrl, text)
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to send image from URL',
                error: error instanceof Error ? error.message : String(error)
            };
        }

    }

    static async sendDocumentFile({ params, body, set }: any) {
        try {
            const session = params.session;
            const { to, filePath, fileName, mimetype, text } = body as {
                to: string;
                filePath: string;
                fileName?: string;
                mimetype?: string;
                text?: string;
            };

            if (!to || !filePath) {
                set.status = 400;
                return { status: 'error', message: "To & filePath is required" };
            }

            return {
                status: 'success',
                message: 'Document from file sent successfully',
                data: await MessageService.sendDocumentFromFile(session, to, filePath, fileName, mimetype, text)
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to send document from file',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async sendYesNoPoll({ params, body, set }: any) {
        const session = params.session;
        const { to, question } = body as { to: string; question: string };

        if (!to || !question) {
            set.status = 400;
            return { ok: false, error: "to & question wajib" };
        }

        return await MessageService.sendYesNoPoll(session, to, question);
    }

}
