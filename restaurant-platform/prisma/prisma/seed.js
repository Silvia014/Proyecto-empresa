"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const ALL_MODULES = ["INVENTORY", "CRM", "HR", "KITCHEN", "BI", "ADMIN", "ORDERS"];
const ALL_ACTIONS = ["READ", "WRITE"];
// Matriz de permisos por rol: qué módulos + qué acciones.
// Esto es lo único que hay que tocar para cambiar quién ve qué.
const ROLE_DEFINITIONS = [
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
        description: "Recetas y normas del restaurante, lectura de inventario, y gestión de pedidos entrantes (cambia el estado a en preparación/listo)",
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
        description: "Lectura de recetas/normas (para formar al equipo) y lectura de RRHH",
        permissions: [
            { module: "KITCHEN", action: "READ" },
            { module: "HR", action: "READ" },
        ],
    },
    {
        key: "POS_SALA",
        name: "Personal de sala / POS",
        description: "Ve y gestiona los pedidos entrantes (online y de mostrador) en tiempo real",
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
        // Reset de permisos para que el seed sea idempotente
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
    console.log("Creando carta de ejemplo...");
    const bogota = await prisma.location.findFirst({ where: { name: "Brasaland Bogotá" } });
    const miami = await prisma.location.findFirst({ where: { name: "Brasaland Miami" } });
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
    console.log("Creando usuario superadmin...");
    const superadminRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPERADMIN" } });
    const email = process.env.SUPERADMIN_EMAIL || "superadmin@turestaurante.com";
    const password = process.env.SUPERADMIN_PASSWORD || "cambia-esta-contraseña";
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
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
