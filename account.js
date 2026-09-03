const registerView = document.getElementById("register-view");
const loginView = document.getElementById("login-view");

const showLogin = document.getElementById("show-login");
const showRegister = document.getElementById("show-register");

const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const forgotPassword = document.getElementById("forgot-password");

// ==========================================
// SWITCH REGISTER / LOGIN
// ==========================================

showLogin?.addEventListener("click", () => {
  registerView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

showRegister?.addEventListener("click", () => {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
});

// ==========================================
// REGISTER
// ==========================================

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

  try {
    const response = await fetch("/api/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "register",
        name,
        email,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Something went wrong");
    }

    console.log("Account created:", result);

    alert("Account created successfully!");

    registerForm.reset();

    // Switch automatically to login
    registerView.classList.add("hidden");
    loginView.classList.remove("hidden");

  } catch (error) {
    console.error("Registration error:", error);
    alert(error.message);
  }
});

// ==========================================
// PASSWORD RESET
// ==========================================

forgotPassword?.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;

  if (!email) {
    alert("Please enter your email address first.");
    return;
  }

  try {
    const response = await fetch("/api/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reset-password",
        email,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Something went wrong");
    }

    alert("Password reset email sent! Please check your inbox.");

  } catch (error) {
    console.error("Password reset error:", error);
    alert(error.message);
  }
});

// ==========================================
// LOGIN
// ==========================================

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const response = await fetch("/api/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "login",
        email,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Incorrect email or password");
    }

      console.log("Login successful:", result);

      // Save the session locally
      localStorage.setItem(
        "brasaland_session",
        JSON.stringify(result.session)
      );

      // Go to dashboard
      window.location.href = "dashboard.html";

    // Next step: redirect to customer dashboard
    // window.location.href = "dashboard.html";

  } catch (error) {
    console.error("Login error:", error);
    alert(error.message);
  }
});