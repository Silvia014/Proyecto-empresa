import "dotenv/config";
import { PrismaClient, ModuleName, PermissionAction } from "@prisma/client";
import bcrypt from "bcryptjs";

declare const process: {
  env: Record<string, string | undefined>;
  exit: (code?: number) => never;
};

const prisma = new PrismaClient();

const ALL_MODULES: ModuleName[] = ["INVENTORY", "CRM", "HR", "KITCHEN", "BI", "ADMIN", "ORDERS"];
const ALL_ACTIONS: PermissionAction[] = ["READ", "WRITE"];

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
    description: "Acceso total operativo",
    permissions: ALL_MODULES.flatMap((m) => ALL_ACTIONS.map((a) => ({ module: m, action: a }))),
  },
  {
    key: "RRHH",
    name: "RRHH",
    description: "Solo acceso al módulo de RRHH",
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
    description: "Recetas y normas, lectura de inventario, y gestión de pedidos entrantes",
    permissions: [
      { module: "KITCHEN", action: "READ" },
      { module: "KITCHEN", action: "WRITE" },
      { module: "INVENTORY", action: "READ" },
      { module: "ORDERS", action: "READ" },
      { module: "ORDERS", action: "WRITE" },
    ],
  },
  {
    key: "RESPONSABLE_FORMACION",
    name: "Responsable de formación",
    description: "Lectura de recetas/normas y lectura de RRHH",
    permissions: [
      { module: "KITCHEN", action: "READ" },
      { module: "HR", action: "READ" },
    ],
  },
  {
    key: "POS_SALA",
    name: "Personal de sala / POS",
    description: "Ve y gestiona los pedidos entrantes en tiempo real",
    permissions: [
      { module: "ORDERS", action: "READ" },
      { module: "ORDERS", action: "WRITE" },
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

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: roleDef.permissions.map((p) => ({ roleId: role.id, module: p.module, action: p.action })),
    });
  }

  console.log("Creando locales...");
  const locationsSeed = [
    { name: "Brasaland Bogotá", city: "Bogotá", country: "Colombia", currency: "COP" },
    { name: "Brasaland Miami", city: "Miami", country: "Estados Unidos", currency: "USD" },
  ];
  for (const loc of locationsSeed) {
    const existing = await prisma.location.findFirst({ where: { name: loc.name } });
    if (!existing) {
      await prisma.location.create({ data: loc });
    }
  }

  console.log("Creando proveedor y carta de ejemplo...");
  const bogota = await prisma.location.findFirst({ where: { name: "Brasaland Bogotá" } });
  const miami = await prisma.location.findFirst({ where: { name: "Brasaland Miami" } });

  let supplierBogota = bogota ? await prisma.supplier.findFirst({ where: { locationId: bogota.id } }) : null;
  if (bogota && !supplierBogota) {
    supplierBogota = await prisma.supplier.create({ data: { name: "Proveedor Local Bogotá", locationId: bogota.id } });
  }
  let supplierMiami = miami ? await prisma.supplier.findFirst({ where: { locationId: miami.id } }) : null;
  if (miami && !supplierMiami) {
    supplierMiami = await prisma.supplier.create({ data: { name: "Local Supplier Miami", locationId: miami.id } });
  }

  const menuSeed = [
    ...(bogota
      ? [
          { name: "Bandeja Brasaland", category: "Principales", price: 45000, currency: "COP", locationId: bogota.id, description: "Carne asada, arroz, frijoles, aguacate y plátano." },
          { name: "Arepa de choclo", category: "Entrantes", price: 12000, currency: "COP", locationId: bogota.id, description: "Con queso campesino." },
          { name: "Limonada de coco", category: "Bebidas", price: 9000, currency: "COP", locationId: bogota.id, description: null },
        ]
      : []),
    ...(miami
      ? [
          { name: "Brasaland Steak", category: "Principales", price: 28, currency: "USD", locationId: miami.id, description: "Grilled churrasco, chimichurri, yuca fries." },
          { name: "Yuca Fries", category: "Entrantes", price: 9, currency: "USD", locationId: miami.id, description: "With garlic aioli." },
          { name: "Passionfruit Iced Tea", category: "Bebidas", price: 6, currency: "USD", locationId: miami.id, description: null },
        ]
      : []),
  ];

  for (const item of menuSeed) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name, locationId: item.locationId } });
    if (!existing) {
      await prisma.menuItem.create({ data: item });
    }
  }

  const inventorySeed = [
    ...(bogota && supplierBogota
      ? [
          { name: "Carne de res", category: "Carnes", unit: "kg", currentStock: 12, minStock: 15, price: 38000, currency: "COP", locationId: bogota.id, supplierId: supplierBogota.id },
          { name: "Yuca", category: "Verduras", unit: "kg", currentStock: 30, minStock: 10, price: 4500, currency: "COP", locationId: bogota.id, supplierId: supplierBogota.id },
        ]
      : []),
    ...(miami && supplierMiami
      ? [
          { name: "Beef churrasco", category: "Carnes", unit: "kg", currentStock: 8, minStock: 10, price: 22, currency: "USD", locationId: miami.id, supplierId: supplierMiami.id },
          { name: "Sparkling water", category: "Bebidas", unit: "unidad", currentStock: 50, minStock: 20, price: 0.8, currency: "USD", locationId: miami.id, supplierId: supplierMiami.id },
        ]
      : []),
  ];

  for (const item of inventorySeed) {
    const existing = await prisma.inventoryItem.findFirst({ where: { name: item.name, locationId: item.locationId } });
    if (!existing) {
      await prisma.inventoryItem.create({ data: item });
    }
  }

  console.log("Creando usuario superadmin...");
  const superadminRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPERADMIN" } });
  const email = process.env.SUPERADMIN_EMAIL || "superadmin@turestaurante.com";
  const password = process.env.SUPERADMIN_PASSWORD || "cambia-esta-contraseña";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Superadmin", passwordHash, roleId: superadminRole.id, locationId: null },
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
