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
import menuRouter from "./routes/menu";
import { kitchenRouter } from "./routes/kitchen";
import { orderingRouter } from "./routes/ordering";
import { ordersRouter } from "./routes/orders";
import { webhooksRouter } from "./routes/webhooks";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log(`Cliente conectado al canal en tiempo real: ${socket.id}`);
});

app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRouter(io));

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/crm", crmRouter);
app.use("/api/hr", hrRouter);
app.use("/api/kitchen", kitchenRouter(io));
app.use("/api/bi", biRouter);

app.use("/api/menu", menuRouter);
app.use("/api/ordering", orderingRouter(io));

app.use("/api/orders", ordersRouter(io));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`API central escuchando en http://localhost:${PORT}`);
});