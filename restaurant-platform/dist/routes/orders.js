"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = ordersRouter;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
function ordersRouter(io) {
    const router = (0, express_1.Router)();
    router.use(auth_1.requireAuth);
    router.get("/", (0, permissions_1.requirePermission)("ORDERS", "READ"), async (req, res) => {
        const { status } = req.query;
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                ...(0, permissions_1.locationFilter)(req),
                ...(status ? { status: status } : {}),
            },
            include: { items: true, customer: true, location: true },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        res.json(orders);
    });
    router.patch("/:id/status", (0, permissions_1.requirePermission)("ORDERS", "WRITE"), async (req, res) => {
        const { status } = req.body;
        const valid = ["RECEIVED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];
        if (!valid.includes(status)) {
            return res.status(400).json({ error: `Estado inválido. Usa uno de: ${valid.join(", ")}` });
        }
        const order = await prisma_1.prisma.order.update({
            where: { id: req.params.id },
            data: { status: status },
            include: { items: true, customer: true, location: true },
        });
        io.emit("order:updated", order);
        res.json(order);
    });
    router.post("/", (0, permissions_1.requirePermission)("ORDERS", "WRITE"), async (req, res) => {
        const { customerId, locationId, items, totalUsd, totalCop, fulfillment } = req.body;
        const order = await prisma_1.prisma.order.create({
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
