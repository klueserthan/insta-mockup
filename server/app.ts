import express from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import "dotenv/config";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export async function setupApp() {
  await registerRoutes(httpServer, app);
  return app;
}

export { app, httpServer };
