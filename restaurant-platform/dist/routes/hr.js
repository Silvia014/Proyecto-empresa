"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/employees", (0, permissions_1.requirePermission)("HR", "READ"), async (_req, res) => {
    res.json(await prisma_1.prisma.employee.findMany({ orderBy: { name: "asc" } }));
});
router.post("/employees", (0, permissions_1.requirePermission)("HR", "WRITE"), async (req, res) => {
    const { name, position, email } = req.body;
    const employee = await prisma_1.prisma.employee.create({ data: { name, position, email } });
    res.status(201).json(employee);
});
// Portal de vacaciones/ausencias
router.get("/time-off", (0, permissions_1.requirePermission)("HR", "READ"), async (req, res) => {
    const timeOffs = await prisma_1.prisma.timeOff.findMany({
        where: (0, permissions_1.locationFilter)(req),
        include: { employee: true },
        orderBy: { startDate: "desc" },
    });
    res.json(timeOffs);
});
router.post("/time-off", (0, permissions_1.requirePermission)("HR", "WRITE"), async (req, res) => {
    const { employeeId, locationId, type, startDate, endDate } = req.body;
    const timeOff = await prisma_1.prisma.timeOff.create({
        data: { employeeId, locationId, type, startDate: new Date(startDate), endDate: new Date(endDate) },
    });
    res.status(201).json(timeOff);
});
router.patch("/time-off/:id/approve", (0, permissions_1.requirePermission)("HR", "WRITE"), async (req, res) => {
    const timeOff = await prisma_1.prisma.timeOff.update({
        where: { id: req.params.id },
        data: { approved: true },
    });
    res.json(timeOff);
});
// KPIs: no-shows, rotación de mesas, tiempos de comida
router.get("/kpis", (0, permissions_1.requirePermission)("HR", "READ"), async (req, res) => {
    const stats = await prisma_1.prisma.serviceStat.findMany({
        where: (0, permissions_1.locationFilter)(req),
        orderBy: { date: "desc" },
        take: 30,
    });
    const totalReservations = stats.reduce((sum, s) => sum + s.reservations, 0);
    const totalNoShows = stats.reduce((sum, s) => sum + s.noShows, 0);
    const avgTurnover = stats.filter((s) => s.tableTurnoverMin != null).reduce((sum, s) => sum + (s.tableTurnoverMin || 0), 0) /
        (stats.filter((s) => s.tableTurnoverMin != null).length || 1);
    const avgMealTime = stats.filter((s) => s.avgMealTimeMin != null).reduce((sum, s) => sum + (s.avgMealTimeMin || 0), 0) /
        (stats.filter((s) => s.avgMealTimeMin != null).length || 1);
    res.json({
        noShowRate: totalReservations ? totalNoShows / totalReservations : 0,
        avgTableTurnoverMin: avgTurnover,
        avgMealTimeMin: avgMealTime,
        raw: stats,
    });
});
router.post("/kpis", (0, permissions_1.requirePermission)("HR", "WRITE"), async (req, res) => {
    const { locationId, date, noShows, reservations, tableTurnoverMin, avgMealTimeMin } = req.body;
    const stat = await prisma_1.prisma.serviceStat.create({
        data: {
            locationId,
            date: new Date(date),
            noShows,
            reservations,
            tableTurnoverMin,
            avgMealTimeMin,
        },
    });
    res.status(201).json(stat);
});
exports.default = router;
