const SUPABASE_URL = "https://dhpbvpqhofuenlrhyxei.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocGJ2cHFob2Z1ZW5scmh5eGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTUyNTQsImV4cCI6MjA5OTUzMTI1NH0.kcA1qD7t5BNiweWzZIejoYAB9GQUpecp31hHFcuP8_Y";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const resetPasswordForm = document.getElementById(
  "reset-password-form"
);


// ==========================================
// CHECK RECOVERY SESSION
// ==========================================

async function checkRecoverySession() {
  const { data, error } = await supabase.auth.getSession();

  console.log("Recovery session:", data.session);
  console.log("Session error:", error);

  if (!data.session) {
    console.error("No recovery session found");
  }
}

checkRecoverySession();


// ==========================================
// UPDATE PASSWORD
// ==========================================

resetPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.getElementById("new-password").value;

  const confirmPassword =
    document.getElementById("confirm-password").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {
    // Check that the recovery session exists
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("Session before password update:", session);

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw new Error(
        "No password recovery session found. Please request a new password reset link."
      );
    }

    console.log("Attempting to update password...");

    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    console.log("Update result:", data);
    console.log("Update error:", error);

    if (error) {
      throw error;
    }

    alert(
      "Password updated successfully! You can now sign in with your new password."
    );

    window.location.href = "account.html";

  } catch (error) {
    console.error("Password update error:", error);

    alert("Password was not updated: " + error.message);
  }
});