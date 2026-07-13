import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import authRouter from "./routes/auth";
import inventoryRouter from "./routes/inventory";
import crmRouter from "./routes/crm";
import hrRouter from "./routes/hr";
import biRouter from "./routes/bi";
import { kitchenRouter } from "./routes/kitchen";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  // Cada local/frontend se conecta aquí y recibe recipe:created/updated/deleted
  // en tiempo real, sin polling.
  console.log(`Cliente conectado a sync de cocina: ${socket.id}`);
});

// API central: cada módulo vive bajo su propio prefijo,
// pero todos comparten la misma base de datos (Location, User, etc.)
app.use("/api/auth", authRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/crm", crmRouter);
app.use("/api/hr", hrRouter);
app.use("/api/kitchen", kitchenRouter(io));
app.use("/api/bi", biRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`API central escuchando en http://localhost:${PORT}`);
});
