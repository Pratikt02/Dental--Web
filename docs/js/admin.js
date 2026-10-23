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
const scheduleShift = document.getElementById("scheduleShift");
const scheduleSubmitButton = document.getElementById("scheduleSubmitButton");
const cancelScheduleEditButton = document.getElementById("cancelScheduleEdit");
const tokenStorageKey = "sakthiDentalAdminSession";
let appointments = [];
let schedules = [];
let adminToken = sessionStorage.getItem(tokenStorageKey) || "";
let editingScheduleId = "";

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
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
  const monthKey = todayKey.slice(0, 7);
  const activeAppointments = appointments.filter(item => item.status !== "cancelled");
  const todayAppointments = activeAppointments.filter(item => item.appointmentDate === todayKey);
  const monthAppointments = activeAppointments.filter(item => item.appointmentDate?.startsWith(monthKey));
  const completedMonthAppointments = appointments.filter(item =>
    item.status === "completed" && item.appointmentDate?.startsWith(monthKey)
  );

  document.getElementById("totalCount").textContent = appointments.length;
  document.getElementById("pendingCount").textContent = appointments.filter(item => item.status === "pending").length;
  document.getElementById("upcomingCount").textContent = appointments.filter(item => new Date(`${item.appointmentDate}T${item.appointmentTime}`) >= today).length;
  document.getElementById("todayAppointmentsCount").textContent = todayAppointments.length;
  document.getElementById("monthAppointmentsCount").textContent = monthAppointments.length;
  document.getElementById("completedMonthAppointmentsCount").textContent = completedMonthAppointments.length;
  document.getElementById("monthAppointmentsLabel").textContent =
    `Appointments in ${today.toLocaleString([], { month: "long" })}`;

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
      <div class="schedule-item-info">
        <strong>${escapeHtml(item.doctor)}</strong>
        <span>${escapeHtml(item.day)} · ${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}</span>
      </div>
      <div class="schedule-item-actions">
        <button class="schedule-action-button" type="button" data-action="edit" data-id="${escapeHtml(item._id)}" aria-label="Edit ${escapeHtml(item.doctor)} schedule for ${escapeHtml(item.day)}" title="Edit schedule">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>
        </button>
        <button class="schedule-action-button delete" type="button" data-action="delete" data-id="${escapeHtml(item._id)}" aria-label="Delete ${escapeHtml(item.doctor)} schedule for ${escapeHtml(item.day)}" title="Delete schedule">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
        </button>
      </div>
    </div>
  `).join("");
}

function resetScheduleForm() {
  scheduleForm.reset();
  editingScheduleId = "";
  scheduleSubmitButton.textContent = "Save schedule";
  cancelScheduleEditButton.hidden = true;
}

function showScheduleFormError(error) {
  dashboardStatus.textContent = error.message;
  dashboardStatus.className = "status error";
}

async function loadSchedules() {
  try {
    const response = await fetch("/api/schedules", { headers: { Authorization: `Bearer ${adminToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load schedules.");
    schedules = result.schedules || [];
    renderScheduleList();
    renderAppointments();
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
      <td data-label="Patient">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.message || "No additional message")}</small>
      </td>
      <td data-label="Appointment">${escapeHtml(formatDate(item.appointmentDate, item.appointmentTime))}</td>
      <td data-label="Treatment">${escapeHtml(item.treatment)}<br><small>Price: ${escapeHtml(String(item.price || 0))}</small></td>
      <td data-label="Contact"><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a><small>${escapeHtml(item.phone)}</small></td>
      <td data-label="Status & notes">
        <select class="status-select ${escapeHtml(item.status)}" data-id="${escapeHtml(item._id)}" aria-label="Update status for ${escapeHtml(item.name)}">
          ${["pending", "confirmed", "completed", "cancelled"].map(status => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <label class="appointment-notes">
          <span class="appointment-notes-label">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l4 4v12H4V4h4Z"></path><path d="M8 4v5h8V4M8 14h8M8 17h5"></path></svg>
            Internal note
          </span>
          <textarea class="notes-input" data-id="${escapeHtml(item._id)}" aria-label="Internal note for ${escapeHtml(item.name)}" placeholder="Add a note for your team...">${escapeHtml(item.adminNotes || "")}</textarea>
        </label>
        <span class="assigned-doctor-badge" aria-label="Assigned dentist: ${escapeHtml(item.doctor || "Unassigned")}" title="Assigned dentist">
          ${escapeHtml(item.doctor || "Unassigned")}
        </span>
        <button class="delete-appointment-button" data-id="${escapeHtml(item._id)}" type="button" aria-label="Delete appointment for ${escapeHtml(item.name)}" title="Delete appointment">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
        </button>
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
  if (!scheduleShift.value) {
    dashboardStatus.textContent = "Select a doctor shift.";
    dashboardStatus.className = "status error";
    return;
  }
  const [startTime, endTime] = scheduleShift.value.split("|");
  payload.startTime = startTime;
  payload.endTime = endTime;
  try {
    const response = await fetch(editingScheduleId ? `/api/schedules/${editingScheduleId}` : "/api/schedules", {
      method: editingScheduleId ? "PUT" : "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to save schedule.");
    resetScheduleForm();
    dashboardStatus.textContent = result.message;
    dashboardStatus.className = "status success";
    await loadSchedules();
  } catch (error) {
    showScheduleFormError(error);
  }
});

cancelScheduleEditButton.addEventListener("click", resetScheduleForm);

scheduleList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;

  const schedule = schedules.find(item => item._id === button.dataset.id);
  if (!schedule) return;

  if (button.dataset.action === "edit") {
    scheduleForm.elements.doctor.value = schedule.doctor;
    scheduleForm.elements.day.value = schedule.day;
    scheduleShift.value = `${schedule.startTime}|${schedule.endTime}`;
    if (!scheduleShift.value) {
      showScheduleFormError(new Error("This schedule uses a shift that is no longer available in the shift options."));
      return;
    }
    editingScheduleId = schedule._id;
    scheduleSubmitButton.textContent = "Update schedule";
    cancelScheduleEditButton.hidden = false;
    scheduleForm.scrollIntoView({ behavior: "smooth", block: "center" });
    scheduleForm.elements.doctor.focus();
    return;
  }

  if (button.dataset.action !== "delete" ||
      !window.confirm("Delete schedule for " + schedule.doctor + " on " + schedule.day + "?")) return;

  button.disabled = true;
  try {
    const response = await fetch(`/api/schedules/${schedule._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || result.message || "Unable to delete schedule.");
    if (editingScheduleId === schedule._id) resetScheduleForm();
    dashboardStatus.textContent = result.message;
    dashboardStatus.className = "status success";
    await loadSchedules();
  } catch (error) {
    showScheduleFormError(error);
    button.disabled = false;
  }
});

searchInput.addEventListener("input", renderAppointments);

appointmentsBody.addEventListener("click", async event => {
  if (!event.target.matches(".delete-appointment-button")) return;
  const button = event.target;
  const appointment = appointments.find(item => item._id === button.dataset.id);
  if (!appointment || !window.confirm(`Delete the appointment for ${appointment.name}? This cannot be undone.`)) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/appointments/${button.dataset.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || result.message || "Unable to delete appointment.");
    appointments = appointments.filter(item => item._id !== button.dataset.id);
    renderSummary();
    renderAppointments();
    dashboardStatus.textContent = result.message;
    dashboardStatus.className = "status success";
  } catch (error) {
    dashboardStatus.textContent = error.message;
    dashboardStatus.className = "status error";
    button.disabled = false;
  }
});

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
    const appointment = appointments.find(item => item._id === doctorField.dataset.id);
    try {
      const response = await fetch(`/api/appointments/${doctorField.dataset.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ doctor: doctorField.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to assign the doctor.");
      if (appointment) appointment.doctor = doctorField.value;
      dashboardStatus.textContent = "Doctor assignment saved.";
      dashboardStatus.className = "status success";
    } catch (error) {
      doctorField.value = appointment?.doctor || "";
      dashboardStatus.textContent = error.message;
      dashboardStatus.className = "status error";
    }
  }
});

if (adminToken) showDashboard();
