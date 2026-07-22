"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// Listado de inventario + flag de alerta cuando currentStock <= minStock
router.get("/", (0, permissions_1.requirePermission)("INVENTORY", "READ"), async (req, res) => {
    const items = await prisma_1.prisma.inventoryItem.findMany({
        where: (0, permissions_1.locationFilter)(req),
        include: { supplier: true },
        orderBy: { name: "asc" },
    });
    const withAlerts = items.map((item) => ({
        ...item,
        lowStock: item.currentStock <= item.minStock,
    }));
    res.json(withAlerts);
});
// Endpoint dedicado solo a los ítems en alerta (para badges/notificaciones)
router.get("/alerts", (0, permissions_1.requirePermission)("INVENTORY", "READ"), async (req, res) => {
    const items = await prisma_1.prisma.inventoryItem.findMany({ where: (0, permissions_1.locationFilter)(req) });
    const alerts = items.filter((i) => i.currentStock <= i.minStock);
    res.json(alerts);
});
router.post("/", (0, permissions_1.requirePermission)("INVENTORY", "WRITE"), async (req, res) => {
    const { name, unit, currentStock, minStock, price, currency, supplierId, locationId } = req.body;
    const item = await prisma_1.prisma.inventoryItem.create({
        data: { name, unit, currentStock, minStock, price, currency, supplierId, locationId },
    });
    res.status(201).json(item);
});
router.patch("/:id/stock", (0, permissions_1.requirePermission)("INVENTORY", "WRITE"), async (req, res) => {
    const { currentStock } = req.body;
    const item = await prisma_1.prisma.inventoryItem.update({
        where: { id: req.params.id },
        data: { currentStock },
    });
    res.json({ ...item, lowStock: item.currentStock <= item.minStock });
});
// Proveedores
router.get("/suppliers", (0, permissions_1.requirePermission)("INVENTORY", "READ"), async (req, res) => {
    const suppliers = await prisma_1.prisma.supplier.findMany({ where: (0, permissions_1.locationFilter)(req) });
    res.json(suppliers);
});
router.post("/suppliers", (0, permissions_1.requirePermission)("INVENTORY", "WRITE"), async (req, res) => {
    const { name, contact, locationId } = req.body;
    const supplier = await prisma_1.prisma.supplier.create({ data: { name, contact, locationId } });
    res.status(201).json(supplier);
});
// Compras
router.post("/purchases", (0, permissions_1.requirePermission)("INVENTORY", "WRITE"), async (req, res) => {
    const { supplierId, locationId, itemName, quantity, unitPrice, currency } = req.body;
    const purchase = await prisma_1.prisma.purchase.create({
        data: { supplierId, locationId, itemName, quantity, unitPrice, currency },
    });
    res.status(201).json(purchase);
});
exports.default = router;
