import {
    getQrDataUrl,
    deleteSession,
    checkSession,
    ensureSession,
} from "../wa-manager";

export class SessionController {
    static async getQr({ params }: { params: { name: string } }) {
        try {
            const name = params.name;
            const result = await getQrDataUrl(name);

            return {
                status: 'success',
                message: 'QR retrieved successfully',
                data: {
                    session: name,
                    ...result
                }
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to retrieve QR',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async checkQr({ params }: { params: { name: string } }) {
        try {
            const name = params.name;
            const status = await checkSession(name);

            return {
                status: 'success',
                message: 'Session status retrieved successfully',
                data: {
                    session: name,
                    ...status
                }
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check session',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async deleteQr({ params }: { params: { name: string } }) {
        try {
            const name = params.name;
            return await deleteSession(name)
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to delete session',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    static async startSession({ params }: { params: { name: string } }) {
        try {
            const name = params.name;
            await ensureSession(name);
            return {
                status: 'success',
                message: 'Session started successfully',
                data: {
                    session: name
                }
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to start session',
                error: error instanceof Error ? error.message : String(error)
            };
        }

    }
}
