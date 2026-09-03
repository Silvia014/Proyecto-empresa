// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

// Use your Supabase project URL
const SUPABASE_URL = "https://dhpbvpqhofuenlrhyxei.supabase.co";

// Use your PUBLIC anon key — NEVER the service_role key
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocGJ2cHFob2Z1ZW5scmh5eGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTUyNTQsImV4cCI6MjA5OTUzMTI1NH0.kcA1qD7t5BNiweWzZIejoYAB9GQUpecp31hHFcuP8_Y";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// ==========================================
// GET RECOVERY SESSION
// ==========================================

const resetPasswordForm = document.getElementById(
  "reset-password-form"
);

resetPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.getElementById("new-password").value;

  const confirmPassword =
    document.getElementById("confirm-password").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      throw error;
    }

    alert("Password updated successfully!");

    window.location.href = "account.html";

  } catch (error) {
    console.error("Password update error:", error);
    alert(error.message);
  }
});