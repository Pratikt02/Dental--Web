const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const appointmentsBody = document.getElementById("appointmentsBody");
const searchInput = document.getElementById("searchInput");
const exportButton = document.getElementById("exportButton");
const scheduleForm = document.getElementById("scheduleForm");
const scheduleList = document.getElementById("scheduleList");
const tokenStorageKey = "sakthiDentalAdminSession";
let appointments = [];
let schedules = [];
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

  const counts = [
    { label: "Pending", value: appointments.filter(item => item.status === "pending").length, color: "#f59e0b" },
    { label: "Confirmed", value: appointments.filter(item => item.status === "confirmed").length, color: "#10b981" },
    { label: "Completed", value: appointments.filter(item => item.status === "completed").length, color: "#3b82f6" },
    { label: "Cancelled", value: appointments.filter(item => item.status === "cancelled").length, color: "#ef4444" }
  ];

  const chartContainer = document.getElementById("chartContainer");
  chartContainer.innerHTML = counts.map(item => `
    <div class="chart-bar-item">
      <div class="chart-label-row"><span>${item.label}</span><strong>${item.value}</strong></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${appointments.length ? (item.value / Math.max(appointments.length, 1)) * 100 : 0}%; background:${item.color};"></div></div>
    </div>
  `).join("");
}

function renderScheduleList() {
  if (!schedules.length) {
    scheduleList.innerHTML = '<p class="empty-state">No schedules saved yet.</p>';
    return;
  }
  scheduleList.innerHTML = schedules.map(item => `
    <div class="schedule-item">
      <strong>${escapeHtml(item.doctor)}</strong>
      <span>${escapeHtml(item.day)} · ${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}</span>
    </div>
  `).join("");
}

async function loadSchedules() {
  try {
    const response = await fetch("/api/schedules", { headers: { Authorization: `Bearer ${adminToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load schedules.");
    schedules = result.schedules || [];
    renderScheduleList();
  } catch (error) {
    dashboardStatus.textContent = error.message;
    dashboardStatus.className = "status error";
  }
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
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.message || "No additional message")}</small>
        <small>Doctor: ${escapeHtml(item.doctor || "Unassigned")}</small>
      </td>
      <td>${escapeHtml(formatDate(item.appointmentDate, item.appointmentTime))}</td>
      <td>${escapeHtml(item.treatment)}<br><small>Price: ${escapeHtml(String(item.price || 0))}</small></td>
      <td><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a><small>${escapeHtml(item.phone)}</small></td>
      <td>
        <select class="status-select ${escapeHtml(item.status)}" data-id="${escapeHtml(item._id)}" aria-label="Update status for ${escapeHtml(item.name)}">
          ${["pending", "confirmed", "completed", "cancelled"].map(status => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <textarea class="notes-input" data-id="${escapeHtml(item._id)}" placeholder="Admin notes">${escapeHtml(item.adminNotes || "")}</textarea>
        <input class="doctor-input" data-id="${escapeHtml(item._id)}" value="${escapeHtml(item.doctor || "")}" placeholder="Doctor name">
      </td>
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
  loadSchedules();
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

document.getElementById("refreshButton").addEventListener("click", () => {
  loadAppointments();
  loadSchedules();
});

exportButton.addEventListener("click", async () => {
  if (!adminToken) return;
  const response = await fetch("/api/appointments/export", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sakthi-appointments.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

scheduleForm.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(scheduleForm));
  try {
    const response = await fetch("/api/schedules", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to save schedule.");
    scheduleForm.reset();
    dashboardStatus.textContent = result.message;
    dashboardStatus.className = "status success";
    loadSchedules();
  } catch (error) {
    dashboardStatus.textContent = error.message;
    dashboardStatus.className = "status error";
  }
});

searchInput.addEventListener("input", renderAppointments);

appointmentsBody.addEventListener("change", async event => {
  if (event.target.matches(".status-select")) {
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
    return;
  }

  if (event.target.matches(".notes-input")) {
    const noteField = event.target;
    const response = await fetch(`/api/appointments/${noteField.dataset.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes: noteField.value })
    });
    if (response.ok) {
      const appointment = appointments.find(item => item._id === noteField.dataset.id);
      if (appointment) appointment.adminNotes = noteField.value;
      dashboardStatus.textContent = "Admin notes saved.";
      dashboardStatus.className = "status success";
    }
    return;
  }

  if (event.target.matches(".doctor-input")) {
    const doctorField = event.target;
    const response = await fetch(`/api/appointments/${doctorField.dataset.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ doctor: doctorField.value })
    });
    if (response.ok) {
      const appointment = appointments.find(item => item._id === doctorField.dataset.id);
      if (appointment) appointment.doctor = doctorField.value;
      dashboardStatus.textContent = "Doctor assignment saved.";
      dashboardStatus.className = "status success";
    }
  }
});

if (adminToken) showDashboard();
