import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const allowedStaff = new Set((process.env.CRM_STAFF_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!serviceKey || !supabaseUrl || !allowedStaff.size) {
    return NextResponse.json({ error: "Staff intake access is not configured." }, { status: 503 });
  }
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user || !allowedStaff.has(authData.user.id)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const requestedView = new URL(request.url).searchParams.get("view");
  const view = requestedView === "reservations" || requestedView === "candidates" ? requestedView : "all";
  const emptyResult = { data: [], error: null };
  const [reservationResult, candidateResult, memberResult, orderResult] = await Promise.all([
    view !== "candidates" ? supabase.from("reservations")
      .select("id, first_name, last_name, email, phone, country, city, party_size, reservation_date, reservation_time, location_preference, notes, status, created_at")
      .order("created_at", { ascending: false }).limit(50) : Promise.resolve(emptyResult),
    view !== "reservations" ? supabase.from("candidate_applications")
      .select("id, full_name, email, phone, position, experience_years, cv_path, cv_filename, status, created_at")
      .order("created_at", { ascending: false }).limit(50) : Promise.resolve(emptyResult),
    view === "all" ? supabase.from("BrasapointsAccount")
      .select('balance, createdAt, Customer!inner(id, name, email)')
      .order("createdAt", { ascending: false }).limit(8) : Promise.resolve(emptyResult),
    view === "all" ? supabase.from("Order")
      .select('id, createdAt, total, currency, status, paymentStatus, fulfillment, Customer(name, email), Location(name), OrderItem(dishName, quantity)')
      .eq("source", "ONLINE")
      .order("createdAt", { ascending: false }).limit(8) : Promise.resolve(emptyResult),
  ]);
  const queryError = reservationResult.error || candidateResult.error || memberResult.error || orderResult.error;
  if (queryError) {
    console.error("Staff intake query failed:", queryError.message);
    return NextResponse.json({ error: "Unable to load intake records." }, { status: 500 });
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
      fulfillment: row.fulfillment,
      customerName: customer?.name || "",
      customerEmail: customer?.email || "",
      locationName: location?.name || "",
      items: row.OrderItem || [],
    };
  });
  return NextResponse.json({
    reservations: reservationResult.data || [], candidates, members, orders, updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
