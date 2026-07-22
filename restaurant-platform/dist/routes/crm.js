"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/customers", (0, permissions_1.requirePermission)("CRM", "READ"), async (_req, res) => {
    const customers = await prisma_1.prisma.customer.findMany({
        orderBy: { name: "asc" },
    });
    res.json(customers);
});
router.get("/customers/:id/orders", (0, permissions_1.requirePermission)("CRM", "READ"), async (req, res) => {
    const orders = await prisma_1.prisma.order.findMany({
        where: { customerId: req.params.id, ...(0, permissions_1.locationFilter)(req) },
        include: { items: true },
        orderBy: { createdAt: "desc" },
    });
    res.json(orders);
});
router.post("/orders", (0, permissions_1.requirePermission)("CRM", "WRITE"), async (req, res) => {
    const { customerId, locationId, items, totalUsd, totalCop } = req.body;
    const order = await prisma_1.prisma.order.create({
        data: {
            customerId,
            locationId,
            totalUsd,
            totalCop,
            items: { create: items },
        },
        include: { items: true },
    });
    res.status(201).json(order);
});
/**
 * Sugerencias de pedido para un cliente, basadas en su historial.
 * Usa la API de Claude (Anthropic) pasando el historial de platos
 * pedidos como contexto. Requiere ANTHROPIC_API_KEY en el entorno.
 */
router.get("/customers/:id/suggestions", (0, permissions_1.requirePermission)("CRM", "READ"), async (req, res) => {
    const orders = await prisma_1.prisma.order.findMany({
        where: { customerId: req.params.id },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 15,
    });
    if (orders.length === 0) {
        return res.json({ suggestions: [], note: "Cliente sin historial todavía" });
    }
    const history = orders
        .flatMap((o) => o.items.map((i) => i.dishName))
        .join(", ");
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({
            error: "ANTHROPIC_API_KEY no configurada. Añádela al .env para activar las sugerencias.",
        });
    }
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 300,
                messages: [
                    {
                        role: "user",
                        content: `Este cliente de un restaurante ha pedido históricamente estos platos: ${history}.
Sugiere 3 platos que probablemente le gusten, basándote en patrones (tipo de cocina, ingredientes recurrentes, dulce/salado, etc).
Responde SOLO con un JSON de la forma: {"suggestions": [{"dish": "...", "reason": "..."}]}, sin texto adicional.`,
                    },
                ],
            }),
        });
        const data = (await response.json());
        const text = data.content?.[0]?.text ?? "{}";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        res.json(parsed);
    }
    catch (err) {
        res.status(502).json({ error: "Fallo al generar sugerencias con IA" });
    }
});
exports.default = router;
