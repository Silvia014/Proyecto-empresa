import "dotenv/config";
import { PrismaClient, ModuleName, PermissionAction } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ALL_MODULES: ModuleName[] = ["INVENTORY", "CRM", "HR", "KITCHEN", "BI", "ADMIN"];
const ALL_ACTIONS: PermissionAction[] = ["READ", "WRITE"];

// Matriz de permisos por rol: qué módulos + qué acciones.
// Esto es lo único que hay que tocar para cambiar quién ve qué.
const ROLE_DEFINITIONS: {
  key: string;
  name: string;
  description: string;
  permissions: { module: ModuleName; action: PermissionAction }[];
}[] = [
  {
    key: "SUPERADMIN",
    name: "Superadmin",
    description: "Acceso total a todos los módulos y a la gestión de usuarios/roles",
    permissions: ALL_MODULES.flatMap((m) => ALL_ACTIONS.map((a) => ({ module: m, action: a }))),
  },
  {
    key: "ADMIN",
    name: "Admin (CEO / CTO)",
    description: "Acceso total operativo, igual que superadmin salvo matices que se definan más adelante",
    permissions: ALL_MODULES.flatMap((m) => ALL_ACTIONS.map((a) => ({ module: m, action: a }))),
  },
  {
    key: "RRHH",
    name: "RRHH",
    description: "Solo acceso al módulo de RRHH (vacaciones, ausencias, KPIs)",
    permissions: [
      { module: "HR", action: "READ" },
      { module: "HR", action: "WRITE" },
    ],
  },
  {
    key: "JEFE_ECONOMATO",
    name: "Jefe de economato",
    description: "Inventario, compras y proveedores",
    permissions: [
      { module: "INVENTORY", action: "READ" },
      { module: "INVENTORY", action: "WRITE" },
    ],
  },
  {
    key: "DIRECTOR_COCINA",
    name: "Director de cocina",
    description: "Recetas y normas del restaurante, lectura de inventario para consulta",
    permissions: [
      { module: "KITCHEN", action: "READ" },
      { module: "KITCHEN", action: "WRITE" },
      { module: "INVENTORY", action: "READ" },
    ],
  },
  {
    key: "RESPONSABLE_FORMACION",
    name: "Responsable de formación",
    description: "Lectura de recetas/normas (para formar al equipo) y lectura de RRHH",
    permissions: [
      { module: "KITCHEN", action: "READ" },
      { module: "HR", action: "READ" },
    ],
  },
];

async function main() {
  console.log("Creando roles y permisos...");
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { key: roleDef.key },
      update: { name: roleDef.name, description: roleDef.description },
      create: { key: roleDef.key, name: roleDef.name, description: roleDef.description },
    });

    // Reset de permisos para que el seed sea idempotente
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: roleDef.permissions.map((p) => ({ roleId: role.id, module: p.module, action: p.action })),
    });
  }

  console.log("Creando locales de ejemplo...");
  const existingLoc = await prisma.location.findFirst({ where: { name: "Restaurante Sevilla" } });
  if (!existingLoc) {
    await prisma.location.create({
      data: { name: "Restaurante Sevilla", city: "Sevilla", country: "España", currency: "USD" },
    });
  }

  console.log("Creando usuario superadmin...");
  const superadminRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPERADMIN" } });
  const email = process.env.SUPERADMIN_EMAIL || "superadmin@turestaurante.com";
  const password = process.env.SUPERADMIN_PASSWORD || "cambia-esta-contraseña";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Superadmin",
      passwordHash,
      roleId: superadminRole.id,
      locationId: null, // acceso global
    },
  });

  console.log("Seed completado.");
  console.log(`Superadmin -> email: ${email} / password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
