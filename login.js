"use strict";

// Load & save users in localStorage
function loadUsers() {
  return JSON.parse(localStorage.getItem("budgetUsers") || "[]");
}

function saveUsers(users) {
  localStorage.setItem("budgetUsers", JSON.stringify(users));
}

const authMessage = document.getElementById("auth-message");

// REGISTER
document.getElementById("register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;

  const users = loadUsers();

  if (users.find((u) => u.email === email)) {
    authMessage.style.color = "#c53030";
    authMessage.textContent = "This email is already registered.";
    return;
  }
  if (password.length < 4) {
    authMessage.style.color = "#c53030";
    authMessage.textContent = "Password must be at least 4 characters.";
    return;
  }

  users.push({ name, email, password });
  saveUsers(users);

  authMessage.style.color = "#16a34a";
  authMessage.textContent = "Account created. You can now log in.";
  document.getElementById("register-form").reset();
});

// LOGIN
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  const users = loadUsers();
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    authMessage.style.color = "#c53030";
    authMessage.textContent = "Invalid email or password.";
    return;
  }

  // Remember who is logged in
  localStorage.setItem("currentBudgetUserEmail", user.email);

  // Go to the Personal Budget App page
  window.location.href = "app.html";
});
