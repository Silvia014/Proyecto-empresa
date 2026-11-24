import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

type Context = { params: Promise<{ id: string }> };
const statuses = ["NEW", "CONFIRMED", "CANCELLED", "COMPLETED"];

async function authorize(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  return canAccess(actor.role, "reservations")
    ? actor
    : NextResponse.json({ error: "Reservation access required." }, { status: 403 });
}

export async function PATCH(request: Request, { params }: Context) {
  const actor = await authorize(request);
  if (isDenied(actor)) return actor;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const date = body?.reservation_date;
  const time = body?.reservation_time;
  const size = body?.party_size;
  const status = body?.status;
  const notes = body?.notes;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isInteger(size) || size < 1 || size > 100 ||
      !statuses.includes(status) || typeof notes !== "string" || notes.length > 1000) {
    return NextResponse.json({ error: "Enter a valid date, time, guest count, status and notes." }, { status: 400 });
  }
  const { data, error } = await actor.service.from("reservations").update({
    reservation_date: date, reservation_time: time, party_size: size, status, notes: notes.trim() || null,
  }).eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("Reservation update failed:", error.code);
    return NextResponse.json({ error: "Could not update this reservation." }, { status: 503 });
  }
  return data
    ? NextResponse.json({ updated: true })
    : NextResponse.json({ error: "Reservation not found." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: Context) {
  const actor = await authorize(request);
  if (isDenied(actor)) return actor;
  const { id } = await params;
  const { data, error } = await actor.service.from("reservations").delete()
    .eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("Reservation deletion failed:", error.code);
    return NextResponse.json({ error: "Could not delete this reservation." }, { status: 503 });
  }
  return data
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "Reservation not found." }, { status: 404 });
}
