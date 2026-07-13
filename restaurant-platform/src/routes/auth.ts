// Este archivo define las rutas de autenticación para la API central, incluyendo login y obtener información del usuario autenticado.

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

// Define el esquema de validación para el login usando Zod. Se espera un email válido y una contraseña no vacía.
const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Define la ruta POST /login para autenticar a un usuario. Valida el cuerpo de la petición, verifica las credenciales y genera un token JWT si son correctas.

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email o contraseña con formato inválido" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.active) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      roleKey: user.role.key,
      locationId: user.locationId,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "12h" }
  );

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

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { role: { include: { permissions: true } } },
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

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

export default router;
