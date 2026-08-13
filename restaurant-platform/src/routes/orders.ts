import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { requirePermission, locationFilter } from "../middleware/permissions";
import { validateOrderLines } from "../lib/shared-utils/validations";

const prisma = new PrismaClient();

export function ordersRouter(io: SocketIOServer) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", requirePermission("ORDERS", "READ"), async (req, res) => {
    const { status } = req.query as { status?: string };
    const orders = await prisma.order.findMany({
      where: {
        ...locationFilter(req),
        ...(status ? { status: status as any } : {}),
      },
      include: { items: true, customer: true, location: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(orders);
  });

  router.patch("/:id/status", requirePermission("ORDERS", "WRITE"), async (req, res) => {
    const { status } = req.body as { status: string };
    const valid = ["RECEIVED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Usa uno de: ${valid.join(", ")}` });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: status as any },
      include: { items: true, customer: true, location: true },
    });

    io.emit("order:updated", order);
    res.json(order);
  });

  // Antes esta ruta no validaba nada de las líneas del pedido creado
  // manualmente desde el POS. Ahora usa `validateOrderLines` (trasladada
  // de brasaland-utils): al menos un artículo, cantidades > 0, precios
  // unitarios no negativos.
  router.post("/", requirePermission("ORDERS", "WRITE"), async (req, res) => {
  try {
    const {
      customerId,
      locationId,
      items,
      fulfillment,
    } = req.body;

    // ---------------------------------------
    // VALIDAR LÍNEAS DEL PEDIDO
    // ---------------------------------------

    const validation = validateOrderLines(items);

    if (!validation.valid) {
      return res.status(400).json({
        error: "Líneas de pedido inválidas",
        details: validation.errors,
      });
    }

    // ---------------------------------------
    // CALCULAR SUBTOTAL EN EL SERVIDOR
    // ---------------------------------------

    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );

    // ---------------------------------------
    // CREAR PEDIDO
    // ---------------------------------------

    const order = await prisma.order.create({
      data: {
        customerId,
        locationId,

        currency: "USD",

        subtotal,
        discount: 0,
        total: subtotal,

        brasapointsDiscount: 0,
        brasapointsUsed: 0,
        brasapointsEarned: 0,

        source: "POS",
        status: "RECEIVED",
        paymentStatus: "NOT_APPLICABLE",

        fulfillment: fulfillment || "pickup",

        items: {
          create: items.map(
            (item: {
              dishName: string;
              quantity: number;
              unitPrice: number;
              menuItemId?: string;
            }) => ({
              dishName: item.dishName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
              menuItemId: item.menuItemId,
            })
          ),
        },
      },

      include: {
        items: true,
        customer: true,
        location: true,
      },
    });

    io.emit("order:created", order);

    return res.status(201).json(order);
  } catch (error) {
    console.error("Error creando pedido:", error);

    return res.status(500).json({
      error: "No se pudo crear el pedido",
    });
  }
});
  return router;
}
