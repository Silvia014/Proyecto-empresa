"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhooksRouter = webhooksRouter;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const stripe_1 = require("../lib/stripe");
function webhooksRouter(io) {
    const router = (0, express_1.Router)();
    router.post("/stripe", async (req, res) => {
        const signature = req.headers["stripe-signature"];
        if (!process.env.STRIPE_WEBHOOK_SECRET || !signature) {
            return res.status(400).send("Webhook no configurado");
        }
        let event;
        try {
            const stripe = (0, stripe_1.getStripe)();
            event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
        }
        catch (err) {
            console.error("Firma de webhook inválida", err);
            return res.status(400).send("Firma inválida");
        }
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const orderId = session.metadata?.orderId;
            if (orderId) {
                const order = await prisma_1.prisma.order.update({
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
