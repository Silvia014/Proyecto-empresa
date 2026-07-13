//Este es el punto de entrada de la aplicación. Aquí se inicializa el servidor Express y se configuran las rutas de la API central.

import "dotenv/config"; //carga las variables de entorno desde el archivo .env
import express from "express"; //framework web para crear la API central
import cors from "cors";  //permite que otros programas hagan peticiones al backend
import http from "http"; //crea servidor http de express para poder usar socket.io
import { Server as SocketIOServer } from "socket.io";

import authRouter from "./routes/auth"; //importa el router de autenticación y el resto de routes importan las rutas de cada módulo (inventory, crm, hr, bi, kitchen)
import inventoryRouter from "./routes/inventory";
import crmRouter from "./routes/crm";
import hrRouter from "./routes/hr";
import biRouter from "./routes/bi";
import { kitchenRouter } from "./routes/kitchen";

const app = express(); // crea la aplicación express
app.use(cors()); // permite que otros programas hagan peticiones al backend
app.use(express.json()); // permite que express entienda JSON en el body de las peticiones

const server = http.createServer(app); // crea un servidor http de express para poder usar socket.io
const io = new SocketIOServer(server, { cors: { origin: "*" } }); // permite que otros programas hagan peticiones al backend

io.on("connection", (socket) => {
  // Cada local/frontend se conecta aquí y recibe recipe:created/updated/deleted
  console.log(`Cliente conectado a sync de cocina: ${socket.id}`); // loguea el id del socket que se conectó
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

// Inicia el servidor en el puerto definido en las variables de entorno o en el puerto 4000 por defecto

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`API central escuchando en http://localhost:${PORT}`);
});
