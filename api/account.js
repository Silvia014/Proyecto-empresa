const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
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
      // your existing register code
    }

    // LOGIN
    if (action === "login") {
      // your existing login code
    }

    // PASSWORD RESET
    if (action === "reset-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            "https://proyecto-empresa-ljizxm9vy-silvia014.vercel.app/reset-password.html",
        }
      );

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message: "Password reset email sent",
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