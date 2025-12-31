import { Elysia } from "elysia";
import { sessionRoutes } from "./session";

export const routes = new Elysia()
    .use(sessionRoutes);
