const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  console.log("SUPABASE URL EXISTS:", !!process.env.SUPABASE_URL);
  console.log(
    "SERVICE ROLE EXISTS:",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { action, name, email, password } = req.body;

    // REGISTER
    if (action === "register") {
  // 1. Create user in Supabase Authentication
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
    },
  });

  if (error) throw error;

  // 2. Create Brasapoints profile
  const { error: profileError } = await supabase
    .from("profiles")
    .insert([
      {
        id: data.user.id,
        full_name: name,
        email: email,
        brasapoints: 0,
      },
    ]);

  if (profileError) throw profileError;

  return res.status(200).json({
    ok: true,
    user: data.user,
  });
}

    // LOGIN
    if (action === "login") {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        user: data.user,
        session: data.session,
      });
    }

    return res.status(400).json({
      error: "Invalid action",
    });

  } catch (err) {
    console.error("ACCOUNT ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};