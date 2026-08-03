const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY no existe");
} else {
  const payload = JSON.parse(
    Buffer.from(
      process.env.SUPABASE_SERVICE_ROLE_KEY.split(".")[1],
      "base64"
    ).toString()
  );

  console.log("JWT ROLE:", payload.role);
}


module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {

console.log("URL:", !!process.env.SUPABASE_URL);
console.log("SERVICE ROLE:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log(
  "KEY PREFIX:",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20)
);

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

const { data, error: selectError } = await supabase
  .from("reservas")
  .select("*")
  .limit(1);

console.log("SELECT ERROR:", selectError);
console.log("SELECT DATA:", data);

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
