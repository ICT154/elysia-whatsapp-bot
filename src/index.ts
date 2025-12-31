import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { routes } from "./routes/index";

const app = new Elysia()
  .use(
    cors({
      origin: ["http://ams.test"], // accept requests only from this origin
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .get("/", () => "OK")
  .use(routes)
  .listen(3000);

console.log(`🦊 Elysia running on http://localhost:${app.server?.port}`);
