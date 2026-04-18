import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import sessionRouter from "./routes/session.js";
import healthRouter from "./routes/health.js";
import { handleClientConnection } from "./websocket/handler.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = express();
app.use(express.json());

app.use("/health", healthRouter);
app.use("/sessions", sessionRouter);

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  handleClientConnection(ws).catch((err) => {
    console.error("Unhandled error in WebSocket handler:", err);
    ws.close();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
});
