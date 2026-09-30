import { Elysia } from "elysia";
import { SessionController } from "../controllers/SessionController";

export const sessionRoutes = new Elysia({ prefix: "/session" })
    // /session/qr/get/:name
    .get("/qr/get/:name", (ctx) => SessionController.getQr(ctx))

    // /session/qr/check/:name
    .get("/qr/check/:name", (ctx) => SessionController.checkQr(ctx))

    // /session/qr/delete/:name  (REST)
    .delete("/qr/delete/:name", (ctx) => SessionController.deleteQr(ctx))

    // optional: /session/start/:name
    .post("/start/:name", (ctx) => SessionController.startSession(ctx));
