"use strict";

/* ------------ STORAGE HELPERS ------------ */
function loadUsers() {
  return JSON.parse(localStorage.getItem("budgetUsers") || "[]");
}

function dataKey(email) {
  return "budgetData_" + email;
}

function loadState(email) {
  const raw = localStorage.getItem(dataKey(email));
  if (raw) return JSON.parse(raw);
  return { incomes: [], expenses: [], goals: [], budgetPlan: null };
}

function saveState(email, state) {
  localStorage.setItem(dataKey(email), JSON.stringify(state));
}

/* ------------ AUTH CHECK ------------ */
const currentEmail = localStorage.getItem("currentBudgetUserEmail");
if (!currentEmail) {
  window.location.href = "index.html";
}

const allUsers = loadUsers();
const currentUser = allUsers.find((u) => u.email === currentEmail);
if (!currentUser) {
  window.location.href = "index.html";
}

let state = loadState(currentEmail);
let reportChart = null;

/* ------------ DOM ELEMENTS ------------ */
const userEmailLabel = document.getElementById("user-email-label");
userEmailLabel.textContent = `${currentUser.name} (${currentUser.email})`;

// Logout button
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("currentBudgetUserEmail");
  window.location.href = "index.html";
});

/* ------------ TABS ------------ */
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

/* ------------ COMMON HELPERS ------------ */
function monthFromDateStr(dateStr) {
  return dateStr ? dateStr.substring(0, 7) : "";
}

function getTotals() {
  const totalIncome = state.incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = state.expenses.reduce((sum, t) => sum + t.amount, 0);
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

/* ------------ TRANSACTIONS ------------ */
document.getElementById("income-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const desc = document.getElementById("income-desc").value.trim();
  const amount = parseFloat(document.getElementById("income-amount").value);
  const date = document.getElementById("income-date").value;
  const category = document.getElementById("income-category").value;

  if (!desc || !date || isNaN(amount) || amount <= 0) return;

  state.incomes.push({ desc, amount, date, category });
  saveState(currentEmail, state);
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
  saveState(currentEmail, state);
  document.getElementById("expense-form").reset();
  document.getElementById("transaction-message").textContent = "Expense added.";
  refreshUI();
});

/* ------------ BUDGET PLAN ------------ */
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
  saveState(currentEmail, state);
  const warn = document.getElementById("budget-warning");
  warn.style.color = "#16a34a";
  warn.textContent = "Budget plan saved.";
  renderBudgetStatus();
});

function renderBudgetStatus() {
  const tbody = document.getElementById("budget-body");
  tbody.innerHTML = "";
  const warn = document.getElementById("budget-warning");
  warn.style.color = "#ef4444";
  warn.textContent = "";

  if (!state.budgetPlan) {
    warn.textContent = "No budget plan defined yet.";
    return;
  }

  const month = state.budgetPlan.month;
  const limits = state.budgetPlan.limits;

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
    warn.textContent = "Warning: some categories are near or above the limit.";
  } else {
    warn.style.color = "#3b82f6";
    warn.textContent = "You are within your budget limits.";
  }
}

/* ------------ SAVING GOALS ------------ */
document.getElementById("goal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("goal-name").value.trim();
  const target = parseFloat(document.getElementById("goal-target").value);
  const deadline = document.getElementById("goal-deadline").value || null;

  if (!name || isNaN(target) || target <= 0) return;

  state.goals.push({ name, target, deadline });
  saveState(currentEmail, state);
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
      <div class="goal-target">Target: OMR ${g.target.toFixed(2)}${g.deadline ? " | Deadline: " + g.deadline : ""}</div>
      <div class="goal-progress">Progress: ${pct.toFixed(1)}%</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
    `;
    goalsDiv.appendChild(card);
  });
}

/* ------------ DASHBOARD ------------ */
function renderDashboard() {
  const totals = getTotals();
  document.getElementById("dash-total-income").textContent = totals.totalIncome.toFixed(2);
  document.getElementById("dash-total-expense").textContent = totals.totalExpense.toFixed(2);
  document.getElementById("dash-balance").textContent = totals.balance.toFixed(2);

  const noteEl = document.getElementById("dashboard-note");
  if (totals.balance < 0) {
    noteEl.style.color = "#ef4444";
    noteEl.textContent = "Warning: your balance is negative.";
  } else if (totals.balance < totals.totalIncome * 0.1) {
    noteEl.style.color = "#d97706";
    noteEl.textContent = "Your remaining balance is low. Consider reducing expenses.";
  } else {
    noteEl.style.color = "#16a34a";
    noteEl.textContent = "You are on track. Keep monitoring your spending.";
  }
}

let amount = 1234.5;
let formatted = new Intl.NumberFormat('en-OM', {
  style: 'currency',
  currency: 'OMR'
}).format(amount);

console.log(formatted); // → OMR 1,234.50

/* ------------ REPORTS ------------ */
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
          backgroundColor: ["#22c55e", "#ef4444"]
        }
      ]
    },
    options: {
      responsive: true
    }
  });
}

/* ------------ INIT ------------ */
function refreshUI() {
  renderDashboard();
  renderBudgetStatus();
  renderGoals();

  const start = document.getElementById("report-start").value;
  const end = document.getElementById("report-end").value;
  if (start && end) generateReport();
}

function initializeApp() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const firstDay = `${yyyy}-${mm}-01`;
  const lastDay = `${yyyy}-${mm}-28`;

  document.getElementById("report-start").value = firstDay;
  document.getElementById("report-end").value = lastDay;
  document.getElementById("budget-month").value = `${yyyy}-${mm}`;

  refreshUI();
}

initializeApp();
