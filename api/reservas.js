const { createAdminClient } = require("../lib/api-supabase");
const { escapeHtml, sendResendEmail } = require("../lib/resend-email");

const COUNTRY_CITY = { colombia: "Bogotá", usa: "Orlando" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function timeToMinutes(value) {
  if (typeof value !== "string") return Number.NaN;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}
function buildReservationEmail(reservation, language) {
  const english = language === "en";
  const seatingChoices = {
    sin_preferencia: english ? "No preference" : "Sin preferencia",
    terraza: english ? "Terrace" : "Terraza",
    interior: english ? "Indoor" : "Interior",
    patio: "Patio",
  };
  const date = new Date(`${reservation.date}T12:00:00Z`).toLocaleDateString(
    english ? "en-US" : "es-CO",
    { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );
  const name = escapeHtml(reservation.name);
  const city = escapeHtml(reservation.city);
  const safeDate = escapeHtml(date);
  const time = escapeHtml(reservation.time);
  const guests = escapeHtml(reservation.guests);
  const seatingLabel = seatingChoices[reservation.seating] || seatingChoices.sin_preferencia;
  const seating = escapeHtml(seatingLabel);
  const subject = english
    ? "We received your reservation request at Brasaland"
    : "Hemos recibido tu solicitud de reserva en Brasaland";
  const intro = english
    ? `Hello ${name}, we received your reservation request. Our team will review availability and contact you if anything changes.`
    : `Hola ${name}, hemos recibido tu solicitud de reserva. Nuestro equipo revisará la disponibilidad y te contactará si hay algún cambio.`;
  const note = english
    ? "This email confirms that we received your request; the restaurant will contact you if the requested time is unavailable."
    : "Este correo confirma que recibimos tu solicitud; el restaurante te contactará si el horario solicitado no está disponible.";
  const labels = english
    ? { date: "Date", time: "Time", guests: "Guests", location: "Restaurant", seating: "Seating preference" }
    : { date: "Fecha", time: "Hora", guests: "Personas", location: "Restaurante", seating: "Preferencia de ubicación" };
  const html = `<!doctype html><html lang="${english ? "en" : "es"}"><body style="margin:0;background:#f7f1e7;color:#382b24;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fffdf9;border-radius:16px"><p style="margin:0;color:#762b3e;font-weight:bold;letter-spacing:.12em">BRASALAND</p><h1 style="color:#762b3e;font-size:26px">${subject}</h1><p>${intro}</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;color:#776c64">${labels.date}</td><td style="padding:10px 0;font-weight:bold">${safeDate}</td></tr><tr><td style="padding:10px 0;color:#776c64">${labels.time}</td><td style="padding:10px 0;font-weight:bold">${time}</td></tr><tr><td style="padding:10px 0;color:#776c64">${labels.guests}</td><td style="padding:10px 0;font-weight:bold">${guests}</td></tr><tr><td style="padding:10px 0;color:#776c64">${labels.location}</td><td style="padding:10px 0;font-weight:bold">${city}</td></tr><tr><td style="padding:10px 0;color:#776c64">${labels.seating}</td><td style="padding:10px 0;font-weight:bold">${seating}</td></tr></table><p style="font-size:14px;line-height:1.6">${note}</p><p style="margin-top:28px;color:#776c64;font-size:13px">Brasaland</p></main></body></html>`;
  const text = `${subject}\n\n${intro}\n\n${labels.date}: ${date}\n${labels.time}: ${reservation.time}\n${labels.guests}: ${reservation.guests}\n${labels.location}: ${reservation.city}\n${labels.seating}: ${seatingLabel}\n\n${note}`;
  return { subject, html, text };
}

async function sendReservationConfirmation(reservation, language) {
  return sendResendEmail({ to: reservation.email, ...buildReservationEmail(reservation, language) });
}

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
  if (reservationDate < today || reservationDate > latestDate) {
    return res.status(400).json({ error: "La fecha de reserva no está disponible." });
  }

  const openMinutes = timeToMinutes("11:00");
  const closeMinutes = timeToMinutes("22:00");
  const selectedMinutes = timeToMinutes(body.hora);

  if (!Number.isFinite(selectedMinutes) || selectedMinutes < openMinutes || selectedMinutes > closeMinutes) {
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
    const confirmationEmailSent = await sendReservationConfirmation({
      email,
      name: `${firstName} ${lastName}`,
      city,
      date: body.dia,
      time: body.hora,
      guests: partySize,
      seating: String(body.ubicacion || "sin_preferencia"),
    }, body.idioma === "en" ? "en" : "es");
    return res.status(201).json({ ok: true, reservationId: data.id, confirmationEmailSent });
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
