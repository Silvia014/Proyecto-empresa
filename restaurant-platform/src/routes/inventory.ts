import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission, locationFilter } from "../middleware/permissions";

const router = Router();
router.use(requireAuth);

// Listado de inventario + flag de alerta cuando currentStock <= minStock
router.get("/", requirePermission("INVENTORY", "READ"), async (req, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: locationFilter(req),
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
router.get("/alerts", requirePermission("INVENTORY", "READ"), async (req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: locationFilter(req) });
  const alerts = items.filter((i) => i.currentStock <= i.minStock);
  res.json(alerts);
});

router.post("/", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { name, unit, currentStock, minStock, price, currency, supplierId, locationId } = req.body;
  const item = await prisma.inventoryItem.create({
    data: { name, unit, currentStock, minStock, price, currency, supplierId, locationId },
  });
  res.status(201).json(item);
});

router.patch("/:id/stock", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { currentStock } = req.body;
  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: { currentStock },
  });
  res.json({ ...item, lowStock: item.currentStock <= item.minStock });
});

// Proveedores
router.get("/suppliers", requirePermission("INVENTORY", "READ"), async (req, res) => {
  const suppliers = await prisma.supplier.findMany({ where: locationFilter(req) });
  res.json(suppliers);
});

router.post("/suppliers", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { name, contact, locationId } = req.body;
  const supplier = await prisma.supplier.create({ data: { name, contact, locationId } });
  res.status(201).json(supplier);
});

// Compras
router.post("/purchases", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { supplierId, locationId, itemName, quantity, unitPrice, currency } = req.body;
  const purchase = await prisma.purchase.create({
    data: { supplierId, locationId, itemName, quantity, unitPrice, currency },
  });
  res.status(201).json(purchase);
});

export default router;
