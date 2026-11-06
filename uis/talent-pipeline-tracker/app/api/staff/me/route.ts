import { NextResponse } from "next/server";
import { canAccess, type StaffPermission } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  const permissions: StaffPermission[] = ["dashboard", "suppliers", "locations", "customers", "orders", "reservations", "candidates", "inventory", "hr", "brasapuntos", "profile"];
  return NextResponse.json({
    id: actor.user.id,
    email: actor.user.email,
    displayName: actor.displayName,
    role: actor.role,
    permissions: permissions.filter((permission) => canAccess(actor.role, permission)),
  }, { headers: { "Cache-Control": "no-store" } });
}
