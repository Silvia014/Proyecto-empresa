const { createAdminClient, getUserFromRequest } = require("../lib/api-supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const supabase = createAdminClient();

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, no-store");
      const user = await getUserFromRequest(supabase, req);
      if (!user) return res.status(401).json({ error: "Inicia sesión para ver tu cuenta." });
      const { data: customer, error: customerError } = await supabase
        .from("Customer")
        .select("id, name, email, phone, preferences, BrasapointsAccount(balance, BrasapointsTransaction(id, type, points, description, createdAt, orderId))")
        .eq("authUserId", user.id)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return res.status(404).json({ error: "No encontramos tu cuenta Brasaclub." });
      const { data: reservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("id, reservation_date, reservation_time, party_size, city, country, status, created_at")
        .eq("customer_id", customer.id)
        .order("reservation_date", { ascending: false });
      if (reservationsError) throw reservationsError;
      const { data: orders, error: ordersError } = await supabase
        .from("Order")
        .select("id, createdAt, total, currency, status, paymentStatus, fulfillment, OrderItem(dishName, quantity)")
        .eq("customerId", customer.id)
        .eq("source", "ONLINE")
        .order("createdAt", { ascending: false });
      if (ordersError) throw ordersError;
      const loyaltyAccount = Array.isArray(customer.BrasapointsAccount)
        ? customer.BrasapointsAccount[0]
        : customer.BrasapointsAccount;
      return res.status(200).json({
        member: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone || "",
          preferences: customer.preferences || "",
          brasapoints: loyaltyAccount?.balance ?? 0,
          transactions: loyaltyAccount?.BrasapointsTransaction || [],
        },
        reservations: reservations ?? [],
        orders: (orders ?? []).map((order) => ({ ...order, items: order.OrderItem || [] })),
      });
    }

    const { action, name, email, password, phone, preferences } = req.body;

    if (action === "update-profile") {
      const user = await getUserFromRequest(supabase, req);
      if (!user) return res.status(401).json({ error: "Inicia sesión para actualizar tu perfil." });
      if (typeof name !== "string" || !name.trim() || name.length > 160 || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || typeof phone !== "string" || typeof preferences !== "string" || phone.length > 80 || preferences.length > 1000) {
        return res.status(400).json({ error: "Revisa nombre, correo, teléfono y preferencias." });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== String(user.email || "").toLowerCase()) {
        const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: { ...(user.user_metadata || {}), full_name: name.trim() },
        });
        if (authError) throw authError;
      }
      const { data: customer, error } = await supabase
        .from("Customer")
        .update({ name: name.trim(), email: normalizedEmail, phone: phone.trim() || null, preferences: preferences.trim() || null })
        .eq("authUserId", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!customer) return res.status(404).json({ error: "No encontramos una cuenta Brasaclub asociada a este usuario." });
      return res.status(200).json({ ok: true });
    }

    // ==========================================
    // REGISTER
    // ==========================================
    if (action === "register") {
      if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
        return res.status(400).json({ error: "Completa nombre, email y una contraseña de al menos 6 caracteres." });
      }
      if (phone && (typeof phone !== "string" || phone.length > 80)) {
        return res.status(400).json({ error: "Introduce un teléfono válido de máximo 80 caracteres." });
      }
      const { data, error } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

      if (error) throw error;

      const { error: customerError } = await supabase.rpc("ensure_brasaland_customer", {
        p_user_id: data.user.id,
        p_name: name.trim(),
        p_email: email.trim().toLowerCase(),
        p_phone: phone?.trim() || null,
        p_country: null,
        p_city: null,
        p_create_membership: true,
      });
      if (customerError) {
        await supabase.auth.admin.deleteUser(data.user.id);
        throw customerError;
      }
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (loginError) throw loginError;

      return res.status(200).json({
        ok: true,
        user: loginData.user,
        session: loginData.session,
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
    console.error("Account request failed:", err.message);

    return res.status(err.code === "SUPABASE_CONFIG_MISSING" ? 503 : 500).json({
      error: err.message || "Internal server error",
    });
  }
};
