const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { action, name, email, password } = req.body;

    // ==========================================
    // REGISTER
    // ==========================================
    if (action === "register") {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        user: data.user,
      });
    }

    // ==========================================
    // LOGIN
    // ==========================================
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

    // ==========================================
    // PASSWORD RESET EMAIL
    // ==========================================
    if (action === "reset-password") {
      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            "https://proyecto-empresa-xi.vercel.app/reset-password.html",
        });

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message: "Password reset email sent",
      });
    }

    // ==========================================
    // INVALID ACTION
    // ==========================================
    return res.status(400).json({
      error: "Invalid action",
    });

  } catch (err) {
    console.error("ACCOUNT ERROR:", err);

    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
};