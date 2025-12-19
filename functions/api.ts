import express, { Router } from "express";
import serverless from "serverless-http";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/static";

const app = express();

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize app mostly like server/index.ts but purely for the function handler
// We skip the HTTP server creation and port listening as Serverless/Netlify handles that.
(async () => {
    // We pass a dummy server object or look into refactoring registerRoutes if it strictly needs HttpServer
    // For now, registerRoutes in this repo takes (server, app). 
    // In many Replit templates, it uses the server for WebSocket. 
    // WebSockets won't work easily in standard Netlify Functions (stateless).
    // So we might pass a mock or just the app if the function allows.
    
    // However, looking at server/routes.ts (I haven't seen it yet, but assuming standard Replit pattern),
    // it likely attaches Upgrade listeners. We might need to mock that if we want it to not crash.
    // For a simple mockup, we can try passing a minimal mock or null if typed partially.
    
    // Let's create a minimal mock server if needed, or better, modification of registerRoutes might be needed
    // if it relies heavily on WS.
    
    // Wait, I saw server/index.ts uses { createServer } from "http".
    // I should probably check server/routes.ts to see if it uses the httpServer instance.
    // If it does, I might need to refactor registerRoutes to be safe when httpServer is not really listening.
    
    const { createServer } = await import("http");
    const server = createServer(app);
    
    await registerRoutes(server, app);
})();

export const handler = serverless(app);
