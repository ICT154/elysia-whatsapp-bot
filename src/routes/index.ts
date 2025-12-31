import { Elysia } from "elysia";
import { sessionRoutes } from "./session";
import { messageRoutes } from "./message";
import { webhookRoutes } from "./webhook";

export const routes = new Elysia()
    .use(sessionRoutes)
    .use(messageRoutes)
    .use(webhookRoutes);