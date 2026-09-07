const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const appointmentsBody = document.getElementById("appointmentsBody");
const searchInput = document.getElementById("searchInput");
const tokenStorageKey = "sakthiDentalAdminToken";
let appointments = [];
let adminToken = sessionStorage.getItem(tokenStorageKey) || "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date, time) {
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`;
  return parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function renderSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  document.getElementById("totalCount").textContent = appointments.length;
  document.getElementById("pendingCount").textContent = appointments.filter(item => item.status === "pending").length;
  document.getElementById("upcomingCount").textContent = appointments.filter(item => new Date(`${item.appointmentDate}T${item.appointmentTime}`) >= today).length;
}

function renderAppointments() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = appointments.filter(item =>
    [item.name, item.email, item.phone, item.treatment].some(value => String(value).toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    appointmentsBody.innerHTML = '<tr><td colspan="5" class="empty-state">No appointments found.</td></tr>';
    return;
  }

  appointmentsBody.innerHTML = filtered.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.message || "No additional message")}</small></td>
      <td>${escapeHtml(formatDate(item.appointmentDate, item.appointmentTime))}</td>
      <td>${escapeHtml(item.treatment)}</td>
      <td><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a><small>${escapeHtml(item.phone)}</small></td>
      <td><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
    </tr>
  `).join("");
}

async function loadAppointments() {
  dashboardStatus.textContent = "Loading appointments...";
  dashboardStatus.className = "status";

  try {
    const response = await fetch("/api/appointments", {
      headers: { "x-admin-token": adminToken }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load appointments.");

    appointments = result.appointments.sort((first, second) =>
      `${first.appointmentDate}T${first.appointmentTime}`.localeCompare(`${second.appointmentDate}T${second.appointmentTime}`)
    );
    renderSummary();
    renderAppointments();
    document.getElementById("lastUpdated").textContent = `Updated ${new Date().toLocaleString()}`;
    dashboardStatus.textContent = "";
  } catch (error) {
    dashboardStatus.textContent = error.message;
    dashboardStatus.className = "status error";
    if (error.message.includes("authorization")) {
      sessionStorage.removeItem(tokenStorageKey);
      showLogin();
    }
  }
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadAppointments();
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  adminToken = document.getElementById("adminToken").value;
  loginStatus.textContent = "Checking token...";
  loginStatus.className = "status";

  try {
    const response = await fetch("/api/appointments", { headers: { "x-admin-token": adminToken } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Invalid token.");
    sessionStorage.setItem(tokenStorageKey, adminToken);
    appointments = result.appointments;
    showDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
    loginStatus.className = "status error";
  }
});

document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem(tokenStorageKey);
  adminToken = "";
  document.getElementById("adminToken").value = "";
  showLogin();
});
document.getElementById("refreshButton").addEventListener("click", loadAppointments);
searchInput.addEventListener("input", renderAppointments);

if (adminToken) showDashboard();
