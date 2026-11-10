const { createAdminClient, getUserFromRequest } = require("../lib/api-supabase");

async function findOrLinkCustomer(supabase, user) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return { data: null, error: null };
  let result = await supabase.from("Customer")
    .select("id, name, email, phone, preferences, BrasapointsAccount(balance, BrasapointsTransaction(id, type, points, description, createdAt, orderId))")
    .eq("authUserId", user.id).maybeSingle();
  if (result.error || result.data) return result;

  // Older ERP customers predate account linking. Attach the matching verified
  // Supabase Auth email through the server-only RPC before returning the profile.
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || "";
  const { error: linkError } = await supabase.rpc("ensure_brasaland_customer", {
    p_user_id: user.id,
    p_name: metadataName || email.split("@")[0],
    p_email: email,
    p_phone: null,
    p_country: null,
    p_city: null,
    p_create_membership: true,
  });
  if (linkError) return { data: null, error: linkError };
  result = await supabase.from("Customer")
    .select("id, name, email, phone, preferences, BrasapointsAccount(balance, BrasapointsTransaction(id, type, points, description, createdAt, orderId))")
    .eq("authUserId", user.id).maybeSingle();
  return result;
}

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
      const { data: customer, error: customerError } = await findOrLinkCustomer(supabase, user);
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
        // guestCount is absent in some deployed schemas; avoid making profile
        // sign-in and order history depend on that optional column.
        .select("id, createdAt, total, currency, status, paymentStatus, fulfillment, OrderItem(dishName, quantity)")
        .eq("customerId", customer.id)
        .eq("source", "ONLINE")
        .order("createdAt", { ascending: false });
      if (ordersError) throw ordersError;
      const { data: feedbackRows, error: feedbackError } = await supabase
        .from("customer_feedback")
        .select("order_id, value_for_money_rating, comment, created_at")
        .eq("customer_id", customer.id);
      if (feedbackError) throw feedbackError;
      const feedbackByOrder = new Map((feedbackRows || []).map((row) => [row.order_id, row]));
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
        orders: (orders ?? []).map((order) => ({
          ...order,
          items: order.OrderItem || [],
          feedback: feedbackByOrder.get(order.id) || null,
        })),
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
      const { error: linkError } = await findOrLinkCustomer(supabase, user);
      if (linkError) throw linkError;
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

    if (action === "change-password") {
      const user = await getUserFromRequest(supabase, req);
      if (!user) return res.status(401).json({ error: "Sign in again to change your password." });
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      if (newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({ error: "Use a password between 8 and 128 characters." });
      }
      const { error } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
      if (error) throw error;
      return res.status(200).json({ ok: true, message: "Your password has been changed." });
    }

    if (action === "delete-account") {
      const user = await getUserFromRequest(supabase, req);
      if (!user) return res.status(401).json({ error: "Sign in again before deleting your account." });
      if (req.body?.confirmation !== "DELETE") {
        return res.status(400).json({ error: "Enter DELETE to confirm account removal." });
      }

      const { data: customer, error: customerError } = await supabase.from("Customer")
        .select("id, name, email, phone, preferences, authUserId")
        .eq("authUserId", user.id)
        .maybeSingle();
      if (customerError) throw customerError;

      if (customer) {
        const { data: activeOrders, error: activeOrderError } = await supabase.from("Order")
          .select("id")
          .eq("customerId", customer.id)
          .in("status", ["RECEIVED", "PREPARING", "READY"])
          .limit(1);
        if (activeOrderError) throw activeOrderError;
        if (activeOrders?.length) {
          return res.status(409).json({ error: "Resolve your active order with the restaurant before deleting your account." });
        }
        const today = new Date().toISOString().slice(0, 10);
        const { data: upcomingReservations, error: reservationError } = await supabase.from("reservations")
          .select("id")
          .eq("customer_id", customer.id)
          .gte("reservation_date", today)
          .neq("status", "CANCELLED")
          .limit(1);
        if (reservationError) throw reservationError;
        if (upcomingReservations?.length) {
          return res.status(409).json({ error: "Complete or cancel upcoming reservations with the restaurant before deleting your account." });
        }

        const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        if (accessToken) {
          const { error: signOutError } = await supabase.auth.admin.signOut(accessToken, "global");
          if (signOutError) throw signOutError;
        }
        const reservationEmail = `deleted+${customer.id}@privacy.brasaland.site`;
        const updates = [
          await supabase.from("reservations").update({
            first_name: "Deleted",
            last_name: "Customer",
            email: reservationEmail,
            phone: "REDACTED",
            notes: null,
          }).eq("customer_id", customer.id),
          await supabase.from("Order").update({ deliveryAddress: null, customerNotes: null })
            .eq("customerId", customer.id),
          await supabase.from("customer_feedback").update({ comment: null })
            .eq("customer_id", customer.id),
          await supabase.from("BrasapointsAccount").update({ balance: 0, updatedAt: new Date().toISOString() })
            .eq("customerId", customer.id),
          await supabase.from("Customer").update({
            name: "Deleted customer",
            email: null,
            phone: null,
            preferences: null,
            authUserId: null,
            updatedAt: new Date().toISOString(),
          }).eq("id", customer.id),
        ];
        const updateError = updates.find((result) => result.error)?.error;
        if (updateError) throw updateError;
      }

      if (!customer) {
        const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        if (accessToken) {
          const { error: signOutError } = await supabase.auth.admin.signOut(accessToken, "global");
          if (signOutError) throw signOutError;
        }
      }
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
      return res.status(200).json({ ok: true, message: "Your account was deleted and personal profile data was anonymized. Order records remain for accounting." });
    }

    if (action === "submit-feedback") {
      const user = await getUserFromRequest(supabase, req);
      if (!user) return res.status(401).json({ error: "Inicia sesión para enviar tu valoración." });
      const orderId = typeof req.body?.orderId === "string" ? req.body.orderId.trim() : "";
      const rating = Number(req.body?.rating);
      const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
      if (!orderId || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) {
        return res.status(400).json({ error: "Elige una valoración entre 1 y 5 y limita el comentario a 1.000 caracteres." });
      }
      const { data: customer, error: customerError } = await findOrLinkCustomer(supabase, user);
      if (customerError) throw customerError;
      if (!customer) return res.status(404).json({ error: "No encontramos tu cuenta Brasaclub." });
      const { data: order, error: orderError } = await supabase.from("Order")
        .select("id, status, paymentStatus, source")
        .eq("id", orderId)
        .eq("customerId", customer.id)
        .eq("source", "ONLINE")
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return res.status(404).json({ error: "No encontramos este pedido en tu cuenta." });
      if (order.status !== "COMPLETED" || order.paymentStatus !== "PAID") {
        return res.status(409).json({ error: "Podrás valorar el pedido cuando figure como completado y pagado." });
      }
      const { error: feedbackError } = await supabase.from("customer_feedback").upsert({
        customer_id: customer.id,
        order_id: order.id,
        value_for_money_rating: rating,
        comment,
        updated_at: new Date().toISOString(),
      }, { onConflict: "order_id" });
      if (feedbackError) throw feedbackError;
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
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: "Enter a valid email address." });
      }
      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            "https://brasaland.site/reset-password.html",
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
    console.error("Account request failed:", {
      code: err.code || null,
      status: err.status || null,
      message: err.message || "Unknown account API error",
    });
    const code = String(err.code || "").toLowerCase();
    const message = String(err.message || "");
    if (code === "supabase_config_missing") {
      return res.status(503).json({ error: "Account service is not configured." });
    }
    if (["invalid_credentials", "invalid_login_credentials", "email_not_confirmed"].includes(code)
      || /invalid login credentials|email not confirmed/i.test(message)) {
      return res.status(401).json({ error: "The email or password is incorrect. Check your details and try again." });
    }
    if (["user_already_exists", "email_exists"].includes(code)
      || /already registered|already been registered|user already exists/i.test(message)) {
      return res.status(409).json({ error: "A user with this email address has already been registered." });
    }
    return res.status(500).json({ error: "We could not complete this account request. Please try again." });
  }
};
