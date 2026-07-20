import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma";
import { getStripe } from "../lib/stripe";

export function webhooksRouter(io: SocketIOServer) {
  const router = Router();

  router.post("/stripe", async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!process.env.STRIPE_WEBHOOK_SECRET || !signature) {
      return res.status(400).send("Webhook no configurado");
    }

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Firma de webhook inválida", err);
      return res.status(400).send("Firma inválida");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { id: string; payment_intent?: string; metadata?: { orderId?: string } };
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          },
          include: { items: true },
        });

        io.emit("order:updated", order);
      }
    }

    res.json({ received: true });
  });

  return router;
}