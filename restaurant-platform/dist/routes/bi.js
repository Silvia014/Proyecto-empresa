"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Este archivo define las rutas de Business Intelligence (BI) para la API central, incluyendo un resumen de ventas por ubicación y rango de fechas.
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
// Define el router de Express para las rutas de BI. Se requiere autenticación y permisos específicos para acceder a estas rutas.
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/sales-summary", (0, permissions_1.requirePermission)("BI", "READ"), async (req, res) => {
    const fxRate = Number(process.env.FX_USD_TO_COP || 4000);
    const { from, to, locationId } = req.query;
    const orders = await prisma_1.prisma.order.findMany({
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
    const byLocation = Object.values(orders.reduce((acc, o) => {
        const key = o.locationId;
        if (!acc[key]) {
            acc[key] = { locationId: key, locationName: o.location.name, totalUsd: 0, totalCop: 0, orders: 0 };
        }
        acc[key].totalUsd += o.totalUsd;
        acc[key].totalCop += o.totalCop ?? o.totalUsd * fxRate;
        acc[key].orders += 1;
        return acc;
    }, {}));
    res.json({
        totalUsd,
        totalCop,
        fxRateUsed: fxRate,
        ordersCount: orders.length,
        byLocation,
    });
});
exports.default = router;
