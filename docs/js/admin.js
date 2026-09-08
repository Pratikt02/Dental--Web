const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const appointmentsBody = document.getElementById("appointmentsBody");
const searchInput = document.getElementById("searchInput");
const tokenStorageKey = "sakthiDentalAdminSession";
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
      <td><select class="status-select ${escapeHtml(item.status)}" data-id="${escapeHtml(item._id)}" aria-label="Update status for ${escapeHtml(item.name)}">
        ${["pending", "confirmed", "completed", "cancelled"].map(status => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select></td>
    </tr>
  `).join("");
}

async function loadAppointments() {
  dashboardStatus.textContent = "Loading appointments...";
  dashboardStatus.className = "status";

  try {
    const response = await fetch("/api/appointments", { headers: { Authorization: `Bearer ${adminToken}` } });
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
    if (error.message.includes("login")) {
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
  const username = document.getElementById("adminUsername").value;
  const password = document.getElementById("adminPassword").value;
  loginStatus.textContent = "Signing in...";
  loginStatus.className = "status";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Invalid username or password.");
    adminToken = result.token;
    sessionStorage.setItem(tokenStorageKey, adminToken);
    showDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
    loginStatus.className = "status error";
  }
});

document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem(tokenStorageKey);
  adminToken = "";
  document.getElementById("adminUsername").value = "";
  document.getElementById("adminPassword").value = "";
  showLogin();
});

document.getElementById("refreshButton").addEventListener("click", loadAppointments);
searchInput.addEventListener("input", renderAppointments);

appointmentsBody.addEventListener("change", async event => {
  if (!event.target.matches(".status-select")) return;
  const select = event.target;
  const response = await fetch(`/api/appointments/${select.dataset.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: select.value })
  });
  if (!response.ok) {
    dashboardStatus.textContent = "Unable to update appointment status.";
    dashboardStatus.className = "status error";
    return;
  }
  const appointment = appointments.find(item => item._id === select.dataset.id);
  if (appointment) appointment.status = select.value;
  renderSummary();
  dashboardStatus.textContent = "Appointment status updated.";
  dashboardStatus.className = "status success";
});

if (adminToken) showDashboard();
