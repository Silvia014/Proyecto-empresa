
// Este archivo define las rutas de Business Intelligence (BI) para la API central, incluyendo un resumen de ventas por ubicación y rango de fechas.
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

// Define el router de Express para las rutas de BI. Se requiere autenticación y permisos específicos para acceder a estas rutas.

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

  const totalUsd = orders.reduce((sum, o) => sum + o.totalUsd, 0);
  // Si el pedido ya trae totalCop lo usamos, si no lo derivamos con el fx configurado
  const totalCop = orders.reduce((sum, o) => sum + (o.totalCop ?? o.totalUsd * fxRate), 0);

  const byLocation = Object.values(
    orders.reduce((acc: Record<string, any>, o) => {
      const key = o.locationId;
      if (!acc[key]) {
        acc[key] = { locationId: key, locationName: o.location.name, totalUsd: 0, totalCop: 0, orders: 0 };
      }
      acc[key].totalUsd += o.totalUsd;
      acc[key].totalCop += o.totalCop ?? o.totalUsd * fxRate;
      acc[key].orders += 1;
      return acc;
    }, {})
  );

  res.json({
    totalUsd,
    totalCop,
    fxRateUsed: fxRate,
    ordersCount: orders.length,
    byLocation,
  });
});

export default router;
