import { Elysia } from "elysia";
import { sessionRoutes } from "./session";
import { messageRoutes } from "./message";

export const routes = new Elysia()
    .use(sessionRoutes)
    .use(messageRoutes);