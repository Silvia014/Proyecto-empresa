import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const validTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function todayAtTimezone(timezone?: string | null) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
function locationTimezone(location: { timezone?: string | null; city?: string | null; country?: string | null }) {
  if (location.timezone) return location.timezone;
  if (/colombia|^co$/i.test(location.country || "")) return "America/Bogota";
  if (/orlando|miami/i.test(location.city || "") || /united states|^usa$|^us$/i.test(location.country || "")) return "America/New_York";
  return "UTC";
}
const normalizePlace = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "orders")) return jsonError("You do not have access to orders.", 403);

  const params = new URL(request.url).searchParams;
  const { service } = actor;
  let locationsResult = await service.from("Location").select("id, name, city, country, currency, timezone").order("name");
  let locationRows = locationsResult.data;
  let locationLoadError = locationsResult.error;
  if (locationsResult.error && /timezone/i.test(locationsResult.error.message)) {
    // Keep the Orders workspace available until the BI migration adds timezone.
    const fallback = await service.from("Location").select("id, name, city, country, currency").order("name");
    if (fallback.error) return jsonError("Unable to load restaurant locations. Check the Location table and its currency field.", 503);
    locationRows = (fallback.data || []).map((item) => ({ ...item, timezone: null }));
    locationLoadError = null;
  }
  if (locationLoadError) return jsonError("Unable to load restaurant locations. Check the Location table and its currency field.", 503);
  const locations = (locationRows || []).map((item) => ({ ...item, timezone: locationTimezone(item) }));
  const requestedLocation = params.get("locationId");
  const location = locations.find((item) => item.id === requestedLocation) || locations[0];
  if (!location) return jsonError("Create a restaurant location before entering orders.", 503);
  if (requestedLocation && !locations.some((item) => item.id === requestedLocation)) return jsonError("Restaurant location not found.", 404);
  const locationId = location.id;
  const requestedDate = params.get("date");
  if (requestedDate && !validDate(requestedDate)) return jsonError("Choose a valid restaurant date.");
  const date = requestedDate || todayAtTimezone(location.timezone);

  let [reservationsResult, menuResult] = await Promise.all([
    service.from("reservations")
      .select("id, customer_id, first_name, last_name, email, phone, party_size, reservation_date, reservation_time, location_preference, location_id, source, status, notes")
      .eq("reservation_date", date)
      .eq("location_id", locationId)
      .order("reservation_time", { ascending: true }),
    service.from("MenuItem")
      .select("id, name, category, price, currency, locationId, available")
      .eq("available", true)
      .eq("locationId", locationId)
      .order("category")
      .order("name"),
  ]);
  if (reservationsResult.error && /location_id|source/i.test(reservationsResult.error.message)) {
    // Older production schema: still show website reservations by the selected
    // location preference while the source/location migration is pending.
    const fallback = await service.from("reservations")
      .select("id, customer_id, first_name, last_name, email, phone, party_size, reservation_date, reservation_time, location_preference, status, notes")
      .eq("reservation_date", date)
      .order("reservation_time", { ascending: true });
    reservationsResult = {
      ...fallback,
      data: fallback.data?.filter((item) => {
        if (!item.location_preference) return true;
        const preference = normalizePlace(item.location_preference);
        return [location.name, location.city, location.country].filter(Boolean).some((label) => preference.includes(normalizePlace(label)) || normalizePlace(label).includes(preference));
      })
        .map((item) => ({ ...item, location_id: null, source: "ONLINE" })) || null,
    } as typeof reservationsResult;
  }
  if (!menuResult.error && !(menuResult.data || []).length) {
    // The public menu is shared across restaurants; locations with no duplicated
    // MenuItem rows reuse the matching country/currency menu.
    const allMenu = await service.from("MenuItem")
      .select("id, name, category, price, currency, locationId, available")
      .eq("available", true).order("category").order("name");
    if (!allMenu.error) {
      const sameCurrency = allMenu.data.filter((item) => item.currency === location.currency);
      menuResult = { ...menuResult, data: sameCurrency.length ? sameCurrency : allMenu.data };
    }
  }
  const error = reservationsResult.error || menuResult.error;
  if (error) {
    console.error("Staff order workspace query failed:", error.message);
    return jsonError("Unable to load today's reservations and menu.", 503);
  }
  const reservations = reservationsResult.data ?? [];
  const reservationIds = reservations.map((item) => item.id);
  const recordedOrderIds = new Set<string>();
  if (reservationIds.length) {
    const { data: recorded, error: recordedError } = await service.from("Order")
      .select("reservationId")
      .in("reservationId", reservationIds);
    if (recordedError && !/reservationId/i.test(recordedError.message)) return jsonError("Unable to check recorded restaurant orders.", 503);
    for (const row of recorded ?? []) if (row.reservationId) recordedOrderIds.add(row.reservationId);
  }
  return NextResponse.json({
    locations,
    locationId,
    reservations: reservations.map((item) => ({ ...item, consumptionRecorded: recordedOrderIds.has(item.id) })),
    menu: menuResult.data ?? [],
    date,
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "orders")) return jsonError("You do not have access to orders.", 403);

  const { service, user } = actor;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid request body.");

  if (body.action === "update-online-covers") {
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const guestCount = Number(body.guestCount);
    if (!orderId || !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 50) {
      return jsonError("Enter between 1 and 50 guests.");
    }
    const { data: order, error: orderError } = await service.from("Order")
      .select("id, source")
      .eq("id", orderId)
      .eq("source", "ONLINE")
      .maybeSingle();
    if (orderError) return jsonError("Unable to verify this online order.", 503);
    if (!order) return jsonError("Online order not found.", 404);
    const { error } = await service.from("Order").update({ guestCount, updatedAt: new Date().toISOString() }).eq("id", orderId);
    if (error) return jsonError("Could not save the guest count.", 503);
    return NextResponse.json({ ok: true, orderId, guestCount });
  }

  if (body.action === "create-reservation") {
    const locationId = typeof body.locationId === "string" ? body.locationId : "";
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const date = body.date;
    const time = body.time;
    const partySize = Number(body.partySize);
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
    if (!locationId || !name || name.length > 160 || !validDate(date) || !validTime(time)
      || !Number.isInteger(partySize) || partySize < 1 || partySize > 20
      || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || email.length > 254 || phone.length > 80) {
      return jsonError("Complete the name, location, date, time, and a guest count from 1 to 20. Email and phone are optional.");
    }

    const { data: location, error: locationError } = await service.from("Location")
      .select("id, name, city, country")
      .eq("id", locationId)
      .maybeSingle();
    if (locationError) return jsonError("Unable to verify the restaurant location.", 503);
    if (!location) return jsonError("Restaurant location not found.", 404);

    let customerId: string | null = null;
    let createdCustomerId: string | null = null;
    if (email) {
      const { data: existing, error } = await service.from("Customer").select("id").ilike("email", email).limit(1).maybeSingle();
      if (error) return jsonError("Unable to find the customer record.", 503);
      customerId = existing?.id ?? null;
    }
    if (!customerId) {
      createdCustomerId = crypto.randomUUID();
      const customerTimestamp = new Date().toISOString();
      const { error } = await service.from("Customer").insert({
        id: createdCustomerId,
        name,
        email: email || null,
        phone: phone || null,
        city: location.city,
        country: location.country,
        createdAt: customerTimestamp,
        updatedAt: customerTimestamp,
      });
      if (error) return jsonError("Could not create the customer record.", 503);
      customerId = createdCustomerId;
    }

    const nameParts = name.split(" ");
    const firstName = nameParts.shift() || name;
    const lastName = nameParts.join(" ");
    const reservationId = crypto.randomUUID();
    const fullInsert = await service.from("reservations").insert({
      id: reservationId,
      customer_id: customerId,
      first_name: firstName,
      last_name: lastName,
      email: email || "",
      phone,
      country: location.country,
      city: location.city,
      party_size: partySize,
      reservation_date: date,
      reservation_time: time,
      location_preference: location.name,
      location_id: locationId,
      source: "STAFF",
      status: "CONFIRMED",
      notes: notes || null,
      created_by: user.id,
    }).select("id, first_name, last_name, email, phone, party_size, reservation_date, reservation_time, location_id, source, status, notes").single();
    let reservation = fullInsert.data;
    let error = fullInsert.error;
    if (error && /location_id|source|created_by/i.test(error.message)) {
      const legacyInsert = await service.from("reservations").insert({
        id: reservationId, customer_id: customerId, first_name: firstName, last_name: lastName,
        email: email || "", phone, country: location.country, city: location.city,
        party_size: partySize, reservation_date: date, reservation_time: time,
        location_preference: location.name, status: "CONFIRMED", notes: notes || null,
      }).select("id, first_name, last_name, email, phone, party_size, reservation_date, reservation_time, status, notes").single();
      reservation = legacyInsert.data ? { ...legacyInsert.data, location_id: locationId, source: "STAFF" } : null;
      error = legacyInsert.error;
    }
    if (error) {
      if (createdCustomerId) await service.from("Customer").delete().eq("id", createdCustomerId);
      console.error("Manual reservation creation failed:", error.message);
      return jsonError("Could not save the restaurant reservation.", 503);
    }
    return NextResponse.json({ reservation }, { status: 201 });
  }

  if (body.action === "record-consumption") {
    const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
    const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
    const paymentStatus = body.paymentStatus === "PAID" ? "PAID" : body.paymentStatus === "PENDING" ? "PENDING" : "";
    const discountAmount = Number(body.discountAmount || 0);
    const items = Array.isArray(body.items) ? body.items as Array<{ menuItemId?: unknown; quantity?: unknown }> : [];
    if (!reservationId || !locationId || !paymentStatus || !Number.isFinite(discountAmount) || discountAmount < 0 || !items.length || items.length > 30) {
      return jsonError("Select a reservation, restaurant, payment status, and at least one consumed item.");
    }
    const normalizedItems = items.map((item) => ({ menuItemId: String(item.menuItemId || ""), quantity: Number(item.quantity) }));
    if (normalizedItems.some((item) => !item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50)
      || new Set(normalizedItems.map((item) => item.menuItemId)).size !== normalizedItems.length) {
      return jsonError("Check the consumed items and quantities.");
    }

    const { data: reservation, error: reservationError } = await service.from("reservations")
      .select("id, customer_id, party_size, location_id, reservation_date, status")
      .eq("id", reservationId)
      .maybeSingle();
    if (reservationError) return jsonError("Unable to load this reservation.", 503);
    if (!reservation) return jsonError("Reservation not found.", 404);
    const effectiveLocationId = reservation.location_id || locationId;
    if (!effectiveLocationId) return jsonError("Choose which restaurant served this reservation.");

    const { data: existingOrder, error: existingError } = await service.from("Order")
      .select("id")
      .eq("reservationId", reservationId)
      .maybeSingle();
    if (existingError) return jsonError("Unable to check whether consumption is already recorded.", 503);
    if (existingOrder) return jsonError("Consumption has already been recorded for this reservation.", 409);

    const menuIds = normalizedItems.map((item) => item.menuItemId);
    const [{ data: location, error: locationError }, { data: menuRows, error: menuError }] = await Promise.all([
      service.from("Location").select("id, currency").eq("id", effectiveLocationId).maybeSingle(),
      service.from("MenuItem").select("id, name, price, currency, locationId, available").in("id", menuIds).eq("available", true),
    ]);
    if (locationError || menuError) return jsonError("Unable to verify the restaurant menu.", 503);
    if (!location) return jsonError("Restaurant location not found.", 404);
    const menuItems = (menuRows || []).filter((candidate) => !location.currency || candidate.currency === location.currency);
    if (!menuItems || menuItems.length !== normalizedItems.length) return jsonError("One or more menu items are unavailable for this location.");

    const itemData = normalizedItems.map((input) => {
      const menu = menuItems.find((candidate) => candidate.id === input.menuItemId)!;
      return { id: crypto.randomUUID(), dishName: menu.name, menuItemId: menu.id, quantity: input.quantity,
        unitPrice: Number(menu.price), subtotal: Number(menu.price) * input.quantity };
    });
    const subtotal = itemData.reduce((sum, item) => sum + item.subtotal, 0);
    if (discountAmount > subtotal) return jsonError("The discount cannot be greater than the order subtotal.");
    const total = subtotal - discountAmount;
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: orderInsertError } = await service.from("Order").insert({
      id: orderId,
      customerId: reservation.customer_id,
      locationId: effectiveLocationId,
      currency: location.currency,
      subtotal,
      discount: discountAmount,
      brasapointsDiscount: 0,
      total,
      status: "COMPLETED",
      source: "COUNTER",
      fulfillment: "dine-in",
      guestCount: reservation.party_size,
      reservationId,
      paymentStatus,
      createdAt: now,
      updatedAt: now,
    });
    if (orderInsertError) {
      console.error("Manual restaurant order failed:", orderInsertError.message);
      return jsonError("Could not save the restaurant order.", 503);
    }
    const { error: itemInsertError } = await service.from("OrderItem").insert(itemData.map((item) => ({ ...item, orderId })));
    if (itemInsertError) {
      await service.from("Order").delete().eq("id", orderId);
      console.error("Manual restaurant order items failed:", itemInsertError.message);
      return jsonError("Could not save the consumed items.", 503);
    }
    const { error: updateReservationError } = await service.from("reservations").update({
      status: "COMPLETED",
      location_id: effectiveLocationId,
    }).eq("id", reservationId);
    if (updateReservationError) {
      await service.from("Order").delete().eq("id", orderId);
      console.error("Reservation completion update failed:", updateReservationError.message);
      return jsonError("Could not complete the reservation record.", 503);
    }
    return NextResponse.json({ ok: true, orderId, total, currency: location.currency }, { status: 201 });
  }

  return jsonError("Invalid order action.");
}
