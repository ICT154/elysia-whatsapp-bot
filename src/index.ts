import { Elysia } from "elysia";
import { routes } from "./routes/index";

const app = new Elysia()
  .get("/", () => "OK")
  .use(routes)
  .listen(3000);

console.log(`🦊 Elysia running on http://localhost:${app.server?.port}`);
