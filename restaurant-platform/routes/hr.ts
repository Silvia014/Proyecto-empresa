import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission, locationFilter } from "../middleware/permissions";

const router = Router();
router.use(requireAuth);

router.get("/employees", requirePermission("HR", "READ"), async (_req, res) => {
  res.json(await prisma.employee.findMany({ orderBy: { name: "asc" } }));
});

router.post("/employees", requirePermission("HR", "WRITE"), async (req, res) => {
  const { name, position, email } = req.body;
  const employee = await prisma.employee.create({ data: { name, position, email } });
  res.status(201).json(employee);
});

// Portal de vacaciones/ausencias
router.get("/time-off", requirePermission("HR", "READ"), async (req, res) => {
  const timeOffs = await prisma.timeOff.findMany({
    where: locationFilter(req),
    include: { employee: true },
    orderBy: { startDate: "desc" },
  });
  res.json(timeOffs);
});

router.post("/time-off", requirePermission("HR", "WRITE"), async (req, res) => {
  const { employeeId, locationId, type, startDate, endDate } = req.body;
  const timeOff = await prisma.timeOff.create({
    data: { employeeId, locationId, type, startDate: new Date(startDate), endDate: new Date(endDate) },
  });
  res.status(201).json(timeOff);
});

router.patch("/time-off/:id/approve", requirePermission("HR", "WRITE"), async (req, res) => {
  const timeOff = await prisma.timeOff.update({
    where: { id: req.params.id },
    data: { approved: true },
  });
  res.json(timeOff);
});

// KPIs: no-shows, rotación de mesas, tiempos de comida
router.get("/kpis", requirePermission("HR", "READ"), async (req, res) => {
  const stats = await prisma.serviceStat.findMany({
    where: locationFilter(req),
    orderBy: { date: "desc" },
    take: 30,
  });

  const totalReservations = stats.reduce((sum, s) => sum + s.reservations, 0);
  const totalNoShows = stats.reduce((sum, s) => sum + s.noShows, 0);
  const avgTurnover =
    stats.filter((s) => s.tableTurnoverMin != null).reduce((sum, s) => sum + (s.tableTurnoverMin || 0), 0) /
      (stats.filter((s) => s.tableTurnoverMin != null).length || 1);
  const avgMealTime =
    stats.filter((s) => s.avgMealTimeMin != null).reduce((sum, s) => sum + (s.avgMealTimeMin || 0), 0) /
      (stats.filter((s) => s.avgMealTimeMin != null).length || 1);

  res.json({
    noShowRate: totalReservations ? totalNoShows / totalReservations : 0,
    avgTableTurnoverMin: avgTurnover,
    avgMealTimeMin: avgMealTime,
    raw: stats,
  });
});

router.post("/kpis", requirePermission("HR", "WRITE"), async (req, res) => {
  const { locationId, date, noShows, reservations, tableTurnoverMin, avgMealTimeMin } = req.body;
  const stat = await prisma.serviceStat.create({
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

export default router;
