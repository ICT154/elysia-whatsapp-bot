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

    static async viewQr({ params, set }: { params: { name: string }, set: any }) {
        try {
            const name = params.name;
            const result = await getQrDataUrl(name);

            if (result.status === 'qr_ready') {
                set.headers['content-type'] = 'text/html';
                return `
                    <html>
                    <head><title>QR Code for ${name}</title></head>
                    <body style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5;">
                        <div style="text-align: center; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h2>Scan QR Code</h2>
                            <p>Session: <b>${name}</b></p>
                            <img src="${result.qrDataUrl}" alt="QR Code" style="width: 300px; height: 300px; margin-top: 10px;" />
                            <p style="color: #666; font-size: 14px; margin-top: 20px;">Silakan scan menggunakan WhatsApp di HP Anda.</p>
                            <script>
                                // Auto refresh every 5 seconds to check if status changed
                                setTimeout(() => window.location.reload(), 5000);
                            </script>
                        </div>
                    </body>
                    </html>
                `;
            } else {
                set.headers['content-type'] = 'text/html';
                return `
                    <html>
                    <body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
                        <div style="text-align: center;">
                            <h2>Status: ${result.status}</h2>
                            <p>Tunggu sebentar atau coba refresh...</p>
                            <script>setTimeout(() => window.location.reload(), 3000);</script>
                        </div>
                    </body>
                    </html>
                `;
            }
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
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
