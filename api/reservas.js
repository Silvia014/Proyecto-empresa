import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log("URL:", process.env.SUPABASE_URL);
console.log(
  "KEY empieza por:",
  process.env.SUPABASE_SECRET_KEY?.substring(0, 12)
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {

console.log("URL:", !!process.env.SUPABASE_URL);
console.log("KEY:", !!process.env.SUPABASE_SECRET_KEY);

    const {
  nombre,
  apellidos,
  email,
  telefono,
  personas,
  dia,
  hora,
  notas,
} = req.body;

const { error } = await supabase
  .from("reservas")
  .insert([
    {
      nombre,
      apellidos,
      email,
      telefono,
      personas,
      fecha: dia,
      hora,
      notas,
    },
  ]);

    if (error) throw error;

    res.status(200).json({
      ok: true,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message,
    });

  }
}
