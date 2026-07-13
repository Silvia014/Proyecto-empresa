import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  roleKey: string; // SUPERADMIN, ADMIN, RRHH, JEFE_ECONOMATO, DIRECTOR_COCINA, RESPONSABLE_FORMACION
  locationId: string | null; // null = acceso a todos los locales
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}
