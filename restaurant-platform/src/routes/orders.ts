import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission, locationFilter } from "../middleware/permissions";

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

  router.post("/", requirePermission("ORDERS", "WRITE"), async (req, res) => {
    const { customerId, locationId, items, totalUsd, totalCop, fulfillment } = req.body;
    const order = await prisma.order.create({
      data: {
        customerId,
        locationId,
        totalUsd,
        totalCop,
        source: "POS",
        status: "RECEIVED",
        paymentStatus: "NOT_APPLICABLE",
        fulfillment: fulfillment || "pickup",
        items: { create: items },
      },
      include: { items: true },
    });

    io.emit("order:created", order);
    res.status(201).json(order);
  });

  return router;
}