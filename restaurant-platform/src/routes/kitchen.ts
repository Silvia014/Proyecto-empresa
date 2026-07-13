import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

/**
 * Este router recibe la instancia de socket.io para poder emitir
 * "recipe:updated" a todos los locales conectados en tiempo real
 * cuando el director de cocina publica un cambio.
 */
export function kitchenRouter(io: SocketIOServer) {
  const router = Router();
  router.use(requireAuth);

  // Recetas/normas globales + las específicas del local del usuario
  router.get("/recipes", requirePermission("KITCHEN", "READ"), async (req, res) => {
    const recipes = await prisma.recipe.findMany({
      where: {
        OR: [{ locationId: null }, { locationId: req.user!.locationId ?? undefined }],
      },
      orderBy: { nameEs: "asc" },
    });
    res.json(recipes);
  });

  router.post("/recipes", requirePermission("KITCHEN", "WRITE"), async (req, res) => {
    const { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn, locationId } = req.body;
    const recipe = await prisma.recipe.create({
      data: { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn, locationId },
    });

    // Broadcast inmediato a todos los locales conectados (global si locationId es null)
    io.emit("recipe:created", recipe);
    res.status(201).json(recipe);
  });

  router.put("/recipes/:id", requirePermission("KITCHEN", "WRITE"), async (req, res) => {
    const { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn } = req.body;
    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn },
    });

    // Esto es lo que hace que, al actualizar una norma o receta,
    // se propague al instante a ambos restaurantes (o a todos los que
    // haya) sin necesidad de refrescar la página.
    io.emit("recipe:updated", recipe);
    res.json(recipe);
  });

  router.delete("/recipes/:id", requirePermission("KITCHEN", "WRITE"), async (req, res) => {
    await prisma.recipe.delete({ where: { id: req.params.id } });
    io.emit("recipe:deleted", { id: req.params.id });
    res.status(204).send();
  });

  return router;
}
