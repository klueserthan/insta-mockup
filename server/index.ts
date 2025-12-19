import { app, httpServer, setupApp } from "./app";
import { serveStatic } from "./static";

// Move log function to a shared place or redefine it here if needed, 
// for minimal changes I will redefine it or import if I can find where it was defined.
// It was defined in index.ts.

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

import { dbReady } from "./db";

(async () => {
  console.log("Waiting for database initialization...");
  await dbReady;
  console.log("Database initialized.");

  await setupApp();

  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // We need to import setupVite dynamically 
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5001", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
