import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission, locationFilter } from "../middleware/permissions";
import { sumBy, averageBy, countBy } from "../lib/shared-utils/transformations";
import { groupItems } from "../lib/shared-utils/collections";

const router = Router();
router.use(requireAuth);

router.get("/sales-summary", requirePermission("BI", "READ"), async (req, res) => {
  const fxRate = Number(process.env.FX_USD_TO_COP || 4000);

  const { from, to, locationId } = req.query as { from?: string; to?: string; locationId?: string };

  const orders = await prisma.order.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { location: true },
  });

  // Antes esto era un par de reduce() manuales; ahora usa sumBy/averageBy
  // (trasladadas de brasaland-utils), y groupItems para partir por local
  // en vez de un reduce con un objeto acumulador a mano.
  const totalUsd = sumBy(orders, (o) => o.totalUsd);
  const totalCop = sumBy(orders, (o) => o.totalCop ?? o.totalUsd * fxRate);
  const averageOrderUsd = averageBy(orders, (o) => o.totalUsd);

  const byLocationGroups = groupItems(orders, (o) => o.locationId);
  const byLocation = Object.entries(byLocationGroups).map(([locId, locOrders]) => ({
    locationId: locId,
    locationName: locOrders[0]?.location.name ?? "—",
    totalUsd: sumBy(locOrders, (o) => o.totalUsd),
    totalCop: sumBy(locOrders, (o) => o.totalCop ?? o.totalUsd * fxRate),
    orders: locOrders.length,
  }));

  res.json({
    totalUsd,
    totalCop,
    averageOrderUsd,
    fxRateUsed: fxRate,
    ordersCount: orders.length,
    byLocation,
  });
});

// Nuevo: reporte de inventario reutilizando las mismas utilidades de
// agregación que el reporte de ventas, en vez de duplicar lógica.
router.get("/inventory-report", requirePermission("BI", "READ"), async (req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: locationFilter(req) });

  const lowStockItems = items.filter((i) => i.currentStock <= i.minStock);

  res.json({
    totalItems: items.length,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    totalInventoryValue: sumBy(items, (i) => i.currentStock * i.price),
    itemsByCategory: countBy(items, (i) => i.category),
  });
});

export default router;
