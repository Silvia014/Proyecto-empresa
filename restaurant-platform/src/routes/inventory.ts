import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission, locationFilter } from "../middleware/permissions";
import { validateInventoryItemInput } from "../lib/shared-utils/validations";

const router = Router();
router.use(requireAuth);

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

router.get("/alerts", requirePermission("INVENTORY", "READ"), async (req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: locationFilter(req) });
  const alerts = items.filter((i) => i.currentStock <= i.minStock);
  res.json(alerts);
});

// Antes esta ruta aceptaba cualquier body sin comprobar nada más que los
// tipos de Prisma. Ahora se valida con la misma utilidad reutilizable
// (`validateInventoryItemInput`) trasladada del proyecto brasaland-utils:
// campos obligatorios, stock no negativo, precio > 0.
router.post("/", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { name, category, unit, currentStock, minStock, price, currency, supplierId, locationId } = req.body;

  const validation = validateInventoryItemInput({
    name,
    unit,
    currentStock,
    minStock,
    price,
    supplierId,
    locationId,
  });

  if (!validation.valid) {
    return res.status(400).json({ error: "Datos de inventario inválidos", details: validation.errors });
  }

  const item = await prisma.inventoryItem.create({
    data: {
      name,
      category: category || "Otros",
      unit,
      currentStock,
      minStock,
      price,
      currency,
      supplierId,
      locationId,
    },
  });
  res.status(201).json(item);
});

router.patch("/:id/stock", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { currentStock } = req.body;

  if (typeof currentStock !== "number" || currentStock < 0) {
    return res.status(400).json({ error: "currentStock debe ser un número mayor o igual a 0" });
  }

  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: { currentStock },
  });
  res.json({ ...item, lowStock: item.currentStock <= item.minStock });
});

router.get("/suppliers", requirePermission("INVENTORY", "READ"), async (req, res) => {
  const suppliers = await prisma.supplier.findMany({ where: locationFilter(req) });
  res.json(suppliers);
});

router.post("/suppliers", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { name, contact, locationId } = req.body;
  const supplier = await prisma.supplier.create({ data: { name, contact, locationId } });
  res.status(201).json(supplier);
});

router.post("/purchases", requirePermission("INVENTORY", "WRITE"), async (req, res) => {
  const { supplierId, locationId, itemName, quantity, unitPrice, currency } = req.body;
  const purchase = await prisma.purchase.create({
    data: { supplierId, locationId, itemName, quantity, unitPrice, currency },
  });
  res.status(201).json(purchase);
});

export default router;
