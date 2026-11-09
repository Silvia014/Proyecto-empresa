import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  const { service: supabase, role } = actor;

  const requestedView = new URL(request.url).searchParams.get("view");
  const view = requestedView === "reservations" || requestedView === "orders" || requestedView === "candidates" || requestedView === "members" ? requestedView : "all";
  if (view === "reservations" && !canAccess(role, "reservations")) {
    return NextResponse.json({ error: "You do not have access to online reservations." }, { status: 403 });
  }
  if (view === "candidates" && !canAccess(role, "candidates")) {
    return NextResponse.json({ error: "You do not have access to job applications." }, { status: 403 });
  }
  if (view === "orders" && !canAccess(role, "orders")) {
    return NextResponse.json({ error: "You do not have access to online orders." }, { status: 403 });
  }
  if (view === "members" && !canAccess(role, "brasapuntos")) {
    return NextResponse.json({ error: "You do not have access to Brasapuntos." }, { status: 403 });
  }
  const includeReservations = view === "reservations" || (view === "all" && canAccess(role, "reservations"));
  const includeCandidates = view === "candidates" || (view === "all" && canAccess(role, "candidates"));
  const includeMembers = (view === "all" || view === "members") && canAccess(role, "brasapuntos");
  const includeOrders = view === "orders" || (view === "all" && canAccess(role, "orders"));
  const emptyResult = { data: [], error: null };
  const [reservationResult, candidateResult, memberResult, orderResult] = await Promise.all([
    includeReservations ? supabase.from("reservations")
      .select("id, first_name, last_name, email, phone, country, city, party_size, reservation_date, reservation_time, location_preference, notes, status, created_at")
      .order("created_at", { ascending: false }).limit(50) : Promise.resolve(emptyResult),
    includeCandidates ? supabase.from("candidate_applications")
      .select("id, full_name, email, phone, position, experience_years, cv_path, cv_filename, status, created_at")
      .order("created_at", { ascending: false }).limit(50) : Promise.resolve(emptyResult),
    includeMembers ? supabase.from("BrasapointsAccount")
      .select('balance, createdAt, Customer!inner(id, name, email)')
      .order("createdAt", { ascending: false }).limit(500) : Promise.resolve(emptyResult),
    includeOrders ? supabase.from("Order")
      .select('id, createdAt, total, currency, status, paymentStatus, fulfillment, guestCount, Customer(name, email), Location(name), OrderItem(dishName, quantity)')
      .eq("source", "ONLINE")
      .order("createdAt", { ascending: false }).limit(view === "orders" ? 100 : 8) : Promise.resolve(emptyResult),
  ]);
  const queryError = reservationResult.error || candidateResult.error || memberResult.error || orderResult.error;
  if (queryError) {
    console.error("Staff intake query failed:", queryError.message);
    const source = reservationResult.error ? "reservations" : candidateResult.error ? "candidate_applications" : memberResult.error ? "BrasapointsAccount / Customer" : "Order";
    const label = view === "reservations" ? "online reservation" : view === "orders" ? "online order" : view === "candidates" ? "job application" : view === "members" ? "Brasaclub member" : "staff intake";
    return NextResponse.json({ error: `Unable to load ${label} records. The ${source} query failed; check that the current database migrations are applied and the table grants are in place.` }, { status: 503 });
  }

  const candidates = await Promise.all((candidateResult.data || []).map(async (candidate) => {
    const { data: signed, error } = await supabase.storage.from("candidate-cvs").createSignedUrl(candidate.cv_path, 5 * 60);
    return {
      id: candidate.id, name: candidate.full_name, email: candidate.email, phone: candidate.phone,
      position: candidate.position, experienceYears: candidate.experience_years,
      cvFilename: candidate.cv_filename, cvUrl: error ? null : signed.signedUrl,
      status: candidate.status, createdAt: candidate.created_at,
    };
  }));
  const members = (memberResult.data || []).map((row) => {
    const customer = Array.isArray(row.Customer) ? row.Customer[0] : row.Customer;
    return { id: customer.id, name: customer.name, email: customer.email, balance: row.balance, createdAt: row.createdAt };
  });
  const orders = (orderResult.data || []).map((row) => {
    const customer = Array.isArray(row.Customer) ? row.Customer[0] : row.Customer;
    const location = Array.isArray(row.Location) ? row.Location[0] : row.Location;
    return {
      id: row.id,
      createdAt: row.createdAt,
      total: row.total,
      currency: row.currency,
      status: row.status,
      paymentStatus: row.paymentStatus,
      guestCount: row.guestCount ?? null,
      fulfillment: row.fulfillment,
      customerName: customer?.name || "",
      customerEmail: customer?.email || "",
      locationName: location?.name || "",
      items: row.OrderItem || [],
    };
  });
  return NextResponse.json({
    reservations: includeReservations ? reservationResult.data || [] : [],
    candidates: includeCandidates ? candidates : [],
    members: includeMembers ? members : [],
    orders: includeOrders ? orders : [],
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
