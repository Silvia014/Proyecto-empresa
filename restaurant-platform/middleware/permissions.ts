import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { ModuleName, PermissionAction } from "@prisma/client";

/**
 * Comprueba que el rol del usuario autenticado tenga el permiso
 * (módulo + acción) requerido. SUPERADMIN y ADMIN (CEO/CTO) siempre
 * pasan porque en el seed se les asignan todos los permisos, pero
 * dejamos el chequeo real en base de datos: nada de accesos "hardcoded"
 * en el middleware, todo vive en RolePermission.
 */
export function requirePermission(module: ModuleName, action: PermissionAction = "READ") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const role = await prisma.role.findUnique({
      where: { key: req.user.roleKey },
      include: { permissions: true },
    });

    if (!role) {
      return res.status(403).json({ error: "Rol no reconocido" });
    }

    const hasPermission = role.permissions.some(
      (p) => p.module === module && p.action === action
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: `Tu rol (${role.name}) no tiene permiso de ${action} sobre el módulo ${module}`,
      });
    }

    next();
  };
}

/**
 * Restringe los resultados al local del usuario, salvo que tenga
 * locationId = null (acceso global, típico de superadmin/admin/CEO/CTO).
 * Se usa dentro de las rutas para filtrar las queries a Prisma.
 */
export function locationFilter(req: Request): { locationId?: string } {
  if (!req.user || req.user.locationId === null) return {};
  return { locationId: req.user.locationId };
}
