import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const checkoutSchema = z.object({
  locationId: z.string().min(1),
  fulfillment: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().optional(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6),
  }),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1)
    .refine((items) => new Set(items.map((item) => item.menuItemId)).size === items.length, {
      message: "Cada artículo solo puede aparecer una vez",
    }),
  notes: z.string().max(2000).optional(),
});

export function orderingRouter(io: SocketIOServer) {
  const router = Router();

  router.post("/checkout", async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos de pedido inválidos", details: parsed.error.flatten() });
    }
    const { locationId, fulfillment, deliveryAddress, customer, items, notes } = parsed.data;

    try {
    if (fulfillment === "delivery" && !deliveryAddress) {
      return res.status(400).json({ error: "Falta la dirección de entrega" });
    }

    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) return res.status(404).json({ error: "Local no encontrado" });

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, locationId, available: true },
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: "Algún plato ya no está disponible, actualiza el carrito" });
    }

    const lineItemsData = items.map((i) => {
      const menuItem = menuItems.find((m) => m.id === i.menuItemId)!;
      return { menuItem, quantity: i.quantity };
    });

    const subtotal = lineItemsData.reduce((sum, li) => sum + li.menuItem.price * li.quantity, 0);

    let dbCustomer = await prisma.customer.findFirst({ where: { email: customer.email.toLowerCase() } });
    if (!dbCustomer) {
      dbCustomer = await prisma.customer.create({
        data: { name: customer.name, email: customer.email.toLowerCase(), phone: customer.phone },
      });
    } else {
      dbCustomer = await prisma.customer.update({
        where: { id: dbCustomer.id },
        data: { name: customer.name, phone: customer.phone },
      });
    }

    const order = await prisma.order.create({
      data: {
        customerId: dbCustomer.id,
        locationId,
        currency: location.currency,
        subtotal,
        total: subtotal,
        customerNotes: notes?.trim() || null,
        source: "ONLINE",
        status: "RECEIVED",
        paymentStatus: "PENDING",
        fulfillment,
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress : null,
        items: {
          create: lineItemsData.map((li) => ({
            dishName: li.menuItem.name,
            quantity: li.quantity,
            unitPrice: li.menuItem.price,
            subtotal: li.menuItem.price * li.quantity,
            menuItemId: li.menuItem.id,
          })),
        },
      },
      include: { items: true },
    });

    try {
      io.emit("order:created", { ...order, customer: dbCustomer, location });
    } catch (emitError) {
      console.error("Order saved but live notification failed:", emitError);
    }
    return res.status(201).json({
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentOptions: ["PAYMENT_LINK", "CASH"],
      total: order.total,
      currency: order.currency,
      message: "Pedido recibido. El restaurante te contactará para pagar mediante enlace o en efectivo.",
    });
    } catch (error) {
      console.error("Online order persistence failed:", error);
      return res.status(500).json({ error: "No se pudo guardar el pedido en el ERP. Inténtalo de nuevo." });
    }
  });

  router.patch("/:id/payment-preference", async (req, res) => {
    const allowed = ["CASH", "PAYMENT_LINK", "BIZUM"];
    const paymentPreference = req.body?.paymentPreference;
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!allowed.includes(paymentPreference) || !email) {
      return res.status(400).json({ error: "Choose cash, payment link, or Bizum." });
    }
    try {
      const order = await prisma.order.findUnique({ where: { id: req.params.id }, select: { id: true, paymentStatus: true, customer: { select: { email: true } } } });
      if (!order) return res.status(404).json({ error: "Order not found." });
      if (order.customer.email.toLowerCase() !== email) return res.status(403).json({ error: "This order does not match that email address." });
      if (order.paymentStatus !== "PENDING") return res.status(409).json({ error: "Payment preference can only be changed while payment is pending." });
      await prisma.order.update({ where: { id: order.id }, data: { paymentPreference } });
      return res.json({ ok: true, paymentPreference });
    } catch (error) {
      console.error("Payment preference update failed:", error);
      return res.status(500).json({ error: "Could not save the payment preference." });
    }
  });

  router.get("/:id", async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, location: true },
    });
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(order);
  });

  return router;
}
