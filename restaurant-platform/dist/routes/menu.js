"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
// Sin auth: la app de pedido del cliente todavía no tiene usuarios logueados,
// es un catálogo público como el de cualquier carta de restaurante.
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    const { locationId } = req.query;
    if (!locationId) {
        return res.status(400).json({ error: "Falta locationId" });
    }
    const items = await prisma_1.prisma.menuItem.findMany({
        where: { locationId, available: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(items);
});
// Local(es) disponibles para pedir online (para el selector inicial de la app)
router.get("/locations", async (_req, res) => {
    const locations = await prisma_1.prisma.location.findMany({
        select: { id: true, name: true, city: true, country: true, currency: true },
    });
    res.json(locations);
});
exports.default = router;
