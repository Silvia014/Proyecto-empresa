"use strict";
// Este archivo define las rutas de autenticación para la API central, incluyendo login y obtener información del usuario autenticado.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
// Define el esquema de validación para el login usando Zod. Se espera un email válido y una contraseña no vacía.
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
// Define la ruta POST /login para autenticar a un usuario. Valida el cuerpo de la petición, verifica las credenciales y genera un token JWT si son correctas.
router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Email o contraseña con formato inválido" });
    }
    const { email, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        include: { role: true },
    });
    if (!user || !user.active) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        roleKey: user.role.key,
        locationId: user.locationId,
    }, process.env.JWT_SECRET, { expiresIn: "12h" });
    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.key,
            locationId: user.locationId,
        },
    });
});
router.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { role: { include: { permissions: true } } },
    });
    if (!user)
        return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.key,
        locationId: user.locationId,
        permissions: user.role.permissions.map((p) => `${p.module}:${p.action}`),
    });
});
// Exporta el router para que pueda ser usado en el archivo principal de la aplicación (index.ts) y así integrar las rutas de autenticación en la API central.
exports.default = router;
