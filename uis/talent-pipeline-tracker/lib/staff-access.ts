export const SUPERADMIN_EMAIL = "roldansilvi@gmail.com";

export const STAFF_ROLES = [
  "superadmin",
  "admin",
  "manager_hr",
  "marketing",
  "economato",
  "chef",
  "staff",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffPermission =
  | "dashboard"
  | "suppliers"
  | "locations"
  | "customers"
  | "orders"
  | "reservations"
  | "candidates"
  | "inventory"
  | "brasapuntos"
  | "profile";

const rolePermissions: Record<StaffRole, StaffPermission[]> = {
  superadmin: ["dashboard", "suppliers", "locations", "customers", "orders", "reservations", "candidates", "inventory", "brasapuntos", "profile"],
  admin: ["dashboard", "suppliers", "locations", "customers", "orders", "reservations", "candidates", "inventory", "brasapuntos", "profile"],
  manager_hr: ["locations", "customers", "candidates", "inventory", "profile"],
  marketing: ["locations", "customers", "suppliers", "profile"],
  economato: ["locations", "suppliers", "orders", "inventory", "profile"],
  chef: ["suppliers", "locations", "customers", "orders", "reservations", "inventory", "brasapuntos", "profile"],
  staff: ["locations", "customers", "orders", "reservations", "brasapuntos", "profile"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole);
}

export function canAccess(role: StaffRole, permission: StaffPermission) {
  return rolePermissions[role].includes(permission);
}

export function creatableRoles(role: StaffRole): StaffRole[] {
  return role === "superadmin"
    ? STAFF_ROLES.filter((item) => item !== "superadmin")
    : role === "admin"
      ? STAFF_ROLES.filter((item) => item !== "superadmin")
      : [];
}

export const roleLabels: Record<StaffRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin (CEO / CTO)",
  manager_hr: "Manager HR",
  marketing: "Marketing",
  economato: "Economato",
  chef: "Chef",
  staff: "Staff",
};
