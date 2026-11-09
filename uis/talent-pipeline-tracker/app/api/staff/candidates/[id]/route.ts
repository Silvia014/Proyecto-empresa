import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";
const statuses = new Set(["RECEIVED", "IN_PROGRESS", "SELECTED", "DISCARDED"]);

async function authorize(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "candidates")) return NextResponse.json({ error: "You do not have access to job applications." }, { status: 403 });
  return actor;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await authorize(request);
  if (actor instanceof NextResponse) return actor;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  const status = typeof body?.status === "string" ? body.status.toUpperCase() : "";
  if (!id || !statuses.has(status)) return NextResponse.json({ error: "Choose a valid application status." }, { status: 400 });
  const { data, error } = await actor.service.from("candidate_applications").update({ status }).eq("id", id).select("id, status").maybeSingle();
  if (error) {
    console.error("Candidate status update failed:", error.message);
    return NextResponse.json({ error: "Could not update the application status. Check the current candidate_applications schema." }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  return NextResponse.json({ candidate: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await authorize(request);
  if (actor instanceof NextResponse) return actor;
  const { id } = await context.params;
  const { data: candidate, error: readError } = await actor.service.from("candidate_applications").select("id, cv_path").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Could not load this application." }, { status: 503 });
  if (!candidate) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  const { error: fileError } = await actor.service.storage.from("candidate-cvs").remove([candidate.cv_path]);
  if (fileError) {
    console.error("Candidate CV deletion failed:", fileError.message);
    return NextResponse.json({ error: "The CV could not be deleted from private storage. The application was left unchanged." }, { status: 503 });
  }
  const { error: deleteError } = await actor.service.from("candidate_applications").delete().eq("id", id);
  if (deleteError) {
    console.error("Candidate record deletion failed after CV removal:", deleteError.message);
    return NextResponse.json({ error: "The CV was deleted, but the application record could not be removed. Refresh the list and contact an administrator if it remains." }, { status: 503 });
  }
  return NextResponse.json({ deleted: true });
}
