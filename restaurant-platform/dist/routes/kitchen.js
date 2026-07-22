"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kitchenRouter = kitchenRouter;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
/**
 * Este router recibe la instancia de socket.io para poder emitir
 * "recipe:updated" a todos los locales conectados en tiempo real
 * cuando el director de cocina publica un cambio.
 */
function kitchenRouter(io) {
    const router = (0, express_1.Router)();
    router.use(auth_1.requireAuth);
    // Recetas/normas globales + las específicas del local del usuario
    router.get("/recipes", (0, permissions_1.requirePermission)("KITCHEN", "READ"), async (req, res) => {
        const recipes = await prisma_1.prisma.recipe.findMany({
            where: {
                OR: [{ locationId: null }, { locationId: req.user.locationId ?? undefined }],
            },
            orderBy: { nameEs: "asc" },
        });
        res.json(recipes);
    });
    router.post("/recipes", (0, permissions_1.requirePermission)("KITCHEN", "WRITE"), async (req, res) => {
        const { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn, locationId } = req.body;
        const recipe = await prisma_1.prisma.recipe.create({
            data: { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn, locationId },
        });
        // Broadcast inmediato a todos los locales conectados (global si locationId es null)
        io.emit("recipe:created", recipe);
        res.status(201).json(recipe);
    });
    router.put("/recipes/:id", (0, permissions_1.requirePermission)("KITCHEN", "WRITE"), async (req, res) => {
        const { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn } = req.body;
        const recipe = await prisma_1.prisma.recipe.update({
            where: { id: req.params.id },
            data: { nameEs, nameEn, instructionsEs, instructionsEn, rulesEs, rulesEn },
        });
        // Esto es lo que hace que, al actualizar una norma o receta,
        // se propague al instante a ambos restaurantes (o a todos los que
        // haya) sin necesidad de refrescar la página.
        io.emit("recipe:updated", recipe);
        res.json(recipe);
    });
    router.delete("/recipes/:id", (0, permissions_1.requirePermission)("KITCHEN", "WRITE"), async (req, res) => {
        await prisma_1.prisma.recipe.delete({ where: { id: req.params.id } });
        io.emit("recipe:deleted", { id: req.params.id });
        res.status(204).send();
    });
    return router;
}
