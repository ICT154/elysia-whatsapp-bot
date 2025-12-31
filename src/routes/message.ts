import { Elysia } from "elysia";
import { MessageController } from "../controllers/MessageController";

export const messageRoutes = new Elysia({ prefix: "/:session/message" })
    .post("/text", (ctx) => MessageController.sendText(ctx))
    .post("/image/url", (ctx) => MessageController.sendImageUrl(ctx))
    .post("/document/file", (ctx) => MessageController.sendDocumentFile(ctx));
