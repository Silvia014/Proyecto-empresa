const registerView = document.getElementById("register-view");
const loginView = document.getElementById("login-view");

const showLogin = document.getElementById("show-login");
const showRegister = document.getElementById("show-register");

showLogin?.addEventListener("click", () => {
  registerView.classList.add("hidden");
  loginView.classList.remove("hidden");
});

showRegister?.addEventListener("click", () => {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
});