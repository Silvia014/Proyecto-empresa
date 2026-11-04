const { createAdminClient } = require("../lib/api-supabase");

const COUNTRY_CITY = { colombia: "Bogotá", usa: "Orlando" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const required = ["nombre", "apellidos", "email", "telefono", "dia", "hora"];
  if (required.some((field) => typeof body[field] !== "string" || !body[field].trim())) {
    return res.status(400).json({ error: "Completa todos los campos obligatorios." });
  }
  if (!emailPattern.test(body.email.trim())) return res.status(400).json({ error: "Introduce un email válido." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dia) || !/^\d{2}:\d{2}$/.test(body.hora)) {
    return res.status(400).json({ error: "Selecciona una fecha y hora válidas." });
  }
  const reservationDate = new Date(`${body.dia}T00:00:00`);
  if (Number.isNaN(reservationDate.getTime()) || reservationDate.toISOString().slice(0, 10) !== body.dia) {
    return res.status(400).json({ error: "Selecciona una fecha válida." });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latestDate = new Date(today);
  latestDate.setMonth(latestDate.getMonth() + 3);
  if (reservationDate < today || reservationDate > latestDate || reservationDate.getDay() === 1) {
    return res.status(400).json({ error: "La fecha de reserva no está disponible." });
  }
  const closingTime = [5, 6].includes(reservationDate.getDay()) ? "23:59" : "23:00";
  if (body.hora < "13:00" || body.hora > closingTime) {
    return res.status(400).json({ error: "La hora seleccionada no está dentro del horario de servicio." });
  }
  if (body.nombre.trim().length > 100 || body.apellidos.trim().length > 120 || body.telefono.trim().length > 40) {
    return res.status(400).json({ error: "Uno de los datos supera la longitud permitida." });
  }
  const partySize = Number(body.personas);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return res.status(400).json({ error: "El número de personas debe estar entre 1 y 20." });
  }
  const country = String(body.pais || "colombia").toLowerCase();
  const city = COUNTRY_CITY[country];
  if (!city) return res.status(400).json({ error: "Selecciona una ubicación válida." });

  try {
    const supabase = createAdminClient();
    const firstName = body.nombre.trim();
    const lastName = body.apellidos.trim();
    const email = body.email.trim().toLowerCase();
    const { data: customerId, error: customerError } = await supabase.rpc("ensure_brasaland_customer", {
      p_user_id: null,
      p_name: `${firstName} ${lastName}`,
      p_email: email,
      p_phone: body.telefono.trim(),
      p_country: country,
      p_city: city,
      p_create_membership: false,
    });
    if (customerError) throw customerError;

    const { data, error } = await supabase.from("reservations").insert({
      customer_id: customerId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: body.telefono.trim(),
      country,
      city,
      party_size: partySize,
      reservation_date: body.dia,
      reservation_time: body.hora,
      location_preference: String(body.ubicacion || "sin_preferencia"),
      notes: String(body.notas || "").trim().slice(0, 2000),
      referral_source: String(body.comoNosConociste || "").trim().slice(0, 100),
    }).select("id").single();
    if (error) throw error;
    return res.status(201).json({ ok: true, reservationId: data.id });
  } catch (error) {
    console.error("Reservation intake failed:", error.message);
    if (error.code === "SUPABASE_CONFIG_MISSING") {
      return res.status(503).json({ error: error.message });
    }
    if (["PGRST202", "PGRST205", "42P01"].includes(error.code) || /schema cache|could not find (the )?(table|function)|relation .* does not exist/i.test(error.message || "")) {
      return res.status(503).json({ error: "The intake tables or RPC are missing from the configured Supabase database. Apply the branch migration to the intended development database, then refresh its API schema cache." });
    }
    return res.status(500).json({ error: "No se pudo guardar la reserva. Inténtalo de nuevo." });
  }
};
