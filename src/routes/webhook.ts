import { Elysia } from "elysia";
import { WebhookController } from "../controllers/WebhookController";

export const webhookRoutes = new Elysia({ prefix: "/:session/webhook" })
    .get("/", (ctx) => WebhookController.get(ctx))
    .post("/set", (ctx) => WebhookController.set(ctx))
    .delete("/delete", (ctx) => WebhookController.remove(ctx));
