"use strict";

// ----------------- BASIC STORAGE HELPERS -----------------
function loadUsers() {
  return JSON.parse(localStorage.getItem("budgetUsers") || "[]");
}

function saveUsers(users) {
  localStorage.setItem("budgetUsers", JSON.stringify(users));
}

function dataKey(email) {
  return "budgetData_" + email;
}

function loadState(email) {
  const raw = localStorage.getItem(dataKey(email));
  if (raw) return JSON.parse(raw);
  return {
    incomes: [],
    expenses: [],
    goals: [],
    budgetPlan: null
  };
}

function saveState(email, state) {
  localStorage.setItem(dataKey(email), JSON.stringify(state));
}

// ----------------- GLOBAL VARIABLES -----------------
let currentUser = null;
let state = null;
let reportChart = null;

// ----------------- AUTH HANDLING -----------------
const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");
const authMessage = document.getElementById("auth-message");
const userEmailLabel = document.getElementById("user-email-label");

document.getElementById("register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;

  let users = loadUsers();
  if (users.find((u) => u.email === email)) {
    authMessage.textContent = "This email is already registered.";
    return;
  }
  if (password.length < 4) {
    authMessage.textContent = "Password must be at least 4 characters.";
    return;
  }

  users.push({ name, email, password });
  saveUsers(users);
  authMessage.style.color = "#38a169";
  authMessage.textContent = "Account created. You can now log in.";
  (document.getElementById("register-form")).reset();
});

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

  currentUser = user;
  state = loadState(user.email);
  authMessage.textContent = "";
  userEmailLabel.textContent = user.name + " (" + user.email + ")";
  authSection.classList.add("hidden");
  mainSection.classList.remove("hidden");
  initializeAfterLogin();
});

document.getElementById("logout-btn").addEventListener("click", () => {
  currentUser = null;
  state = null;
  mainSection.classList.add("hidden");
  authSection.classList.remove("hidden");
});

// ----------------- TABS -----------------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabSections = document.querySelectorAll(".tab-section");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabSections.forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.target).classList.add("active");
  });
});

// ----------------- COMMON HELPERS -----------------
function monthFromDateStr(dateStr) {
  // "YYYY-MM-DD" -> "YYYY-MM"
  return dateStr ? dateStr.substring(0, 7) : "";
}

function getTotals() {
  const totalIncome = state.incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = state.expenses.reduce((sum, t) => sum + t.amount, 0);
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

// ----------------- TRANSACTIONS -----------------
document.getElementById("income-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const desc = document.getElementById("income-desc").value.trim();
  const amount = parseFloat(document.getElementById("income-amount").value);
  const date = document.getElementById("income-date").value;
  const category = document.getElementById("income-category").value;

  if (!desc || !date || isNaN(amount) || amount <= 0) return;

  state.incomes.push({ desc, amount, date, category });
  saveState(currentUser.email, state);
  document.getElementById("income-form").reset();
  document.getElementById("transaction-message").textContent = "Income added.";
  refreshUI();
});

document.getElementById("expense-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const desc = document.getElementById("expense-desc").value.trim();
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const date = document.getElementById("expense-date").value;
  const category = document.getElementById("expense-category").value;

  if (!desc || !date || isNaN(amount) || amount <= 0) return;

  state.expenses.push({ desc, amount, date, category });
  saveState(currentUser.email, state);
  document.getElementById("expense-form").reset();
  document.getElementById("transaction-message").textContent = "Expense added.";
  refreshUI();
});

// ----------------- BUDGET PLAN -----------------
document.getElementById("budget-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const month = document.getElementById("budget-month").value;
  if (!month) return;

  const plan = {
    month,
    limits: {
      Food: parseFloat(document.getElementById("limit-food").value) || 0,
      Transport: parseFloat(document.getElementById("limit-transport").value) || 0,
      Rent: parseFloat(document.getElementById("limit-rent").value) || 0,
      Other: parseFloat(document.getElementById("limit-other").value) || 0
    }
  };

  state.budgetPlan = plan;
  saveState(currentUser.email, state);
  document.getElementById("budget-warning").style.color = "#38a169";
  document.getElementById("budget-warning").textContent = "Budget plan saved.";
  renderBudgetStatus();
});

// Create table of spent vs limits
function renderBudgetStatus() {
  const tbody = document.getElementById("budget-body");
  tbody.innerHTML = "";

  const warningEl = document.getElementById("budget-warning");
  warningEl.style.color = "#c53030";
  warningEl.textContent = "";

  if (!state.budgetPlan) {
    warningEl.textContent = "No budget plan defined yet.";
    return;
  }

  const month = state.budgetPlan.month;
  const limits = state.budgetPlan.limits;

  // Calculate amount spent in that month per category
  const spent = {};
  state.expenses.forEach((e) => {
    if (monthFromDateStr(e.date) === month) {
      spent[e.category] = (spent[e.category] || 0) + e.amount;
    }
  });

  let anyWarning = false;

  ["Food", "Transport", "Rent", "Other"].forEach((cat) => {
    const s = spent[cat] || 0;
    const limit = limits[cat] || 0;
    let status = "-";
    if (limit > 0) {
      const ratio = s / limit;
      if (ratio >= 1) {
        status = "OVER limit";
        anyWarning = true;
      } else if (ratio >= 0.9) {
        status = "NEAR limit";
        anyWarning = true;
      } else {
        status = "OK";
      }
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cat}</td>
      <td>${s.toFixed(2)}</td>
      <td>${limit.toFixed(2)}</td>
      <td>${status}</td>
    `;
    tbody.appendChild(tr);
  });

  if (anyWarning) {
    warningEl.textContent = "Warning: some categories are near or above the limit.";
  } else if (state.budgetPlan) {
    warningEl.style.color = "#3182ce";
    warningEl.textContent = "You are within your budget limits.";
  }
}

// ----------------- SAVING GOALS -----------------
document.getElementById("goal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("goal-name").value.trim();
  const target = parseFloat(document.getElementById("goal-target").value);
  const deadline = document.getElementById("goal-deadline").value || null;
  if (!name || isNaN(target) || target <= 0) return;

  state.goals.push({ name, target, deadline });
  saveState(currentUser.email, state);
  document.getElementById("goal-form").reset();
  renderGoals();
});

function renderGoals() {
  const goalsDiv = document.getElementById("goals-list");
  goalsDiv.innerHTML = "";

  if (!state.goals.length) {
    goalsDiv.innerHTML = "<p>No saving goals yet.</p>";
    return;
  }

  const totals = getTotals();
  const available = Math.max(0, totals.balance);
  const perGoal = state.goals.length ? available / state.goals.length : 0;

  state.goals.forEach((g) => {
    const savedForGoal = Math.min(g.target, perGoal);
    const pct = g.target > 0 ? (savedForGoal / g.target) * 100 : 0;

    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <div class="goal-title">${g.name}</div>
      <div class="goal-target">Target: $${g.target.toFixed(2)}${g.deadline ? " | Deadline: " + g.deadline : ""}</div>
      <div class="goal-progress">Progress: ${pct.toFixed(1)}%</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
    `;
    goalsDiv.appendChild(card);
  });
}

// ----------------- DASHBOARD -----------------
function renderDashboard() {
  const totals = getTotals();
  document.getElementById("dash-total-income").textContent = totals.totalIncome.toFixed(2);
  document.getElementById("dash-total-expense").textContent = totals.totalExpense.toFixed(2);
  document.getElementById("dash-balance").textContent = totals.balance.toFixed(2);

  const noteEl = document.getElementById("dashboard-note");
  if (totals.balance < 0) {
    noteEl.style.color = "#c53030";
    noteEl.textContent = "Warning: your balance is negative.";
  } else if (totals.balance < totals.totalIncome * 0.1) {
    noteEl.style.color = "#d69e2e";
    noteEl.textContent = "Your remaining balance is low. Consider reducing expenses.";
  } else {
    noteEl.style.color = "#38a169";
    noteEl.textContent = "You are on track. Keep monitoring your spending.";
  }
}

// ----------------- REPORTS -----------------
document.getElementById("report-form").addEventListener("submit", (e) => {
  e.preventDefault();
  generateReport();
});

function generateReport() {
  const start = document.getElementById("report-start").value;
  const end = document.getElementById("report-end").value;
  if (!start || !end) return;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const incomes = state.incomes.filter((t) => new Date(t.date) >= startDate && new Date(t.date) <= endDate);
  const expenses = state.expenses.filter((t) => new Date(t.date) >= startDate && new Date(t.date) <= endDate);

  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const remaining = totalIncome - totalExpense;

  document.getElementById("rep-income").textContent = totalIncome.toFixed(2);
  document.getElementById("rep-expense").textContent = totalExpense.toFixed(2);
  document.getElementById("rep-remaining").textContent = remaining.toFixed(2);

  const tbody = document.getElementById("report-body");
  tbody.innerHTML = "";
  incomes.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>Income</td><td>${t.date}</td><td>${t.category}</td><td>${t.desc}</td><td>${t.amount.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
  expenses.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>Expense</td><td>${t.date}</td><td>${t.category}</td><td>${t.desc}</td><td>${t.amount.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });

  updateReportChart(totalIncome, totalExpense);
}

function updateReportChart(totalIncome, totalExpense) {
  const ctx = document.getElementById("report-chart");
  if (!ctx) return;

  if (reportChart) {
    reportChart.destroy();
  }

  reportChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Income", "Expense"],
      datasets: [
        {
          data: [totalIncome, totalExpense],
          backgroundColor: ["#48bb78", "#e53e3e"]
        }
      ]
    },
    options: {
      responsive: true
    }
  });
}

// ----------------- INIT & REFRESH -----------------
function refreshUI() {
  renderDashboard();
  renderBudgetStatus();
  renderGoals();
  // update current report if dates already selected
  const start = document.getElementById("report-start").value;
  const end = document.getElementById("report-end").value;
  if (start && end) generateReport();
}

function initializeAfterLogin() {
  // default report period = this month
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const firstDay = `${yyyy}-${mm}-01`;
  const lastDay = `${yyyy}-${mm}-28`; // good enough for simple demo

  document.getElementById("report-start").value = firstDay;
  document.getElementById("report-end").value = lastDay;
  document.getElementById("budget-month").value = `${yyyy}-${mm}`;

  refreshUI();
}
