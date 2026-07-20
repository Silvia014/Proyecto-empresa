import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getStripe, toStripeAmount } from "../lib/stripe";

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
    .min(1),
});

export function orderingRouter(io: SocketIOServer) {
  const router = Router();

  router.post("/checkout", async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos de pedido inválidos", details: parsed.error.flatten() });
    }
    const { locationId, fulfillment, deliveryAddress, customer, items } = parsed.data;

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

    const total = lineItemsData.reduce((sum, li) => sum + li.menuItem.price * li.quantity, 0);
    const fxRate = Number(process.env.FX_USD_TO_COP || 4000);
    const totalUsd = location.currency === "USD" ? total : total / fxRate;
    const totalCop = location.currency === "COP" ? total : total * fxRate;

    let dbCustomer = await prisma.customer.findFirst({ where: { email: customer.email } });
    if (!dbCustomer) {
      dbCustomer = await prisma.customer.create({
        data: { name: customer.name, email: customer.email, phone: customer.phone },
      });
    }

    const order = await prisma.order.create({
      data: {
        customerId: dbCustomer.id,
        locationId,
        totalUsd,
        totalCop,
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
            menuItemId: li.menuItem.id,
          })),
        },
      },
      include: { items: true },
    });

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error: "STRIPE_SECRET_KEY no configurada. Añádela al .env del backend para aceptar pagos.",
        orderId: order.id,
      });
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customer.email,
        line_items: lineItemsData.map((li) => ({
          quantity: li.quantity,
          price_data: {
            currency: location.currency,
            unit_amount: toStripeAmount(li.menuItem.price, location.currency),
            product_data: { name: li.menuItem.name },
          },
        })),
        success_url: `${process.env.ORDERING_APP_URL}/success?order=${order.id}`,
        cancel_url: `${process.env.ORDERING_APP_URL}/cancel?order=${order.id}`,
        metadata: { orderId: order.id },
      });

      await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });

      io.emit("order:created", { ...order, paymentStatus: "PENDING" });

      res.status(201).json({ orderId: order.id, checkoutUrl: session.url });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "No se pudo crear la sesión de pago con Stripe" });
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