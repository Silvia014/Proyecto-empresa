import { Router } from "express";
import { prisma } from "../lib/prisma";

// Sin auth: la app de pedido del cliente todavía no tiene usuarios logueados,
// es un catálogo público como el de cualquier carta de restaurante.
const router = Router();

router.get("/", async (req, res) => {
  const { locationId } = req.query as { locationId?: string };
  if (!locationId) {
    return res.status(400).json({ error: "Falta locationId" });
  }

  const items = await prisma.menuItem.findMany({
    where: { locationId, available: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  res.json(items);
});

// Local(es) disponibles para pedir online (para el selector inicial de la app)
router.get("/locations", async (_req, res) => {
  const locations = await prisma.location.findMany({
    select: { id: true, name: true, city: true, country: true, currency: true },
  });
  res.json(locations);
});

export default router;