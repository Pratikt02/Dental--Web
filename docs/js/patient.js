const authView = document.getElementById("authView");
const portalView = document.getElementById("portalView");
const authForm = document.getElementById("patientAuthForm");
const authStatus = document.getElementById("authStatus");
const portalStatus = document.getElementById("portalStatus");
const appointmentList = document.getElementById("appointmentList");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const authTitle = document.getElementById("authTitle");
const authEyebrow = document.getElementById("authEyebrow");
const authLead = document.getElementById("authLead");
const authTabs = document.querySelector(".auth-tabs");
const profileForm = document.getElementById("profileForm");
const profileStatus = document.getElementById("profileStatus");
const profileDialog = document.getElementById("profileDialog");
const accountMenuButton = document.getElementById("accountMenuButton");
const accountMenu = document.getElementById("accountMenu");
const patientTokenKey = "sakthiDentalPatientSession";
let patientToken = sessionStorage.getItem(patientTokenKey) || "";
let authMode = "login";
let patientProfile = { name: "", email: "", phone: "" };

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatAppointmentDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { weekday: "", day: "", month: value };
  return {
    weekday: date.toLocaleDateString([], { weekday: "short" }),
    day: date.toLocaleDateString([], { day: "2-digit" }),
    month: date.toLocaleDateString([], { month: "short" })
  };
}

function formatAppointmentTime(item) {
  const date = new Date(`${item.appointmentDate}T${item.appointmentTime}`);
  return Number.isNaN(date.getTime())
    ? item.appointmentTime
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderProfileIdentity(profile) {
  patientProfile = {
    name: String(profile.name || "Patient").trim(),
    email: String(profile.email || ""),
    phone: String(profile.phone || "")
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
  document.getElementById("greetingTitle").textContent = greeting;
  document.getElementById("welcomeTitle").textContent = patientProfile.name;
  document.getElementById("portalPatientMeta").textContent = [patientProfile.email, patientProfile.phone]
    .filter(Boolean).join("  ·  ") || "Manage your visits and keep your care details up to date.";
  document.getElementById("accountMenuName").textContent = patientProfile.name;
  document.getElementById("accountMenuEmail").textContent = patientProfile.email;
  document.getElementById("accountMenuPhone").textContent = patientProfile.phone;
  accountMenuButton.setAttribute("aria-label", `Open account options for ${patientProfile.name}`);
}

function renderAppointmentSummary(items) {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  document.getElementById("upcomingVisitCount").textContent = items.filter(item =>
    item.appointmentDate >= todayString && !["cancelled", "completed"].includes(item.status)
  ).length;
  document.getElementById("pendingVisitCount").textContent = items.filter(item => item.status === "pending").length;
  document.getElementById("completedVisitCount").textContent = items.filter(item => item.status === "completed").length;
}

function showMode(mode) {
  authMode = mode;
  authForm.hidden = false;
  authTabs.hidden = false;
  forgotPasswordForm.hidden = true;
  resetPasswordForm.hidden = true;
  authEyebrow.textContent = "PATIENT PORTAL";
  authTitle.textContent = mode === "login" ? "Welcome back" : "Create your account";
  authLead.textContent = mode === "login"
    ? "Sign in to view your appointments and manage your care."
    : "Create an account to keep your appointments and care details together.";
  document.querySelectorAll(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  document.querySelectorAll(".auth-tab").forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.mode === mode)));
  document.getElementById("nameField").hidden = mode === "login";
  document.getElementById("phoneField").hidden = mode === "login";
  document.getElementById("patientName").required = mode === "register";
  document.getElementById("patientPhone").required = mode === "register";
  document.getElementById("authSubmitText").textContent = mode === "login" ? "Sign in" : "Create account";
}

function showRecovery(step) {
  authForm.hidden = true;
  authTabs.hidden = true;
  forgotPasswordForm.hidden = step !== "request";
  resetPasswordForm.hidden = step !== "reset";
  authEyebrow.textContent = "ACCOUNT RECOVERY";
  authTitle.textContent = step === "request" ? "Forgot your password?" : "Set a new password";
  authLead.textContent = step === "request"
    ? "Enter the email address associated with your account to get started."
    : "Enter the six-digit code we emailed you, then choose a new password.";
  (step === "request" ? document.getElementById("forgotEmail") : document.getElementById("resetOtp")).focus();
}

async function loadAppointments() {
  portalStatus.textContent = "Loading your appointments...";
  try {
    const response = await fetch("/api/my-appointments", { headers: { Authorization: `Bearer ${patientToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load appointments.");
    renderAppointmentSummary(result.appointments);
    appointmentList.innerHTML = result.appointments.length ? result.appointments.map(item => {
      const date = formatAppointmentDate(item.appointmentDate);
      return `
      <article class="appointment-card">
        <div class="appointment-date"><span>${escapeHtml(date.weekday)}</span><strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)}</span></div>
        <div class="appointment-details">
          <span class="appointment-label">${escapeHtml(item.treatment)}</span>
          <h3>${escapeHtml(formatAppointmentTime(item))}</h3>
          <p class="appointment-doctor">${escapeHtml(item.doctor ? item.doctor : "Dentist to be assigned")}</p>
          ${item.message ? `<p class="appointment-note">${escapeHtml(item.message)}</p>` : ""}
        </div>
        <div class="appointment-meta"><span class="appointment-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.status === "pending" ? `<button class="cancel-button" data-id="${escapeHtml(item._id)}" type="button">Cancel request</button>` : ""}</div>
      </article>
    `;
    }).join("") : '<div class="empty-state"><h3>No appointments yet</h3><p>Your booked visits will appear here. Ready to schedule your next check-up?</p><a href="contact.html">Book an appointment</a></div>';
    portalStatus.textContent = "";
  } catch (error) {
    portalStatus.textContent = error.message;
    portalStatus.className = "status error";
  }
}

async function loadProfile() {
  if (!patientToken) return;
  try {
    const response = await fetch("/api/my-profile", { headers: { Authorization: `Bearer ${patientToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load profile.");
    document.getElementById("profileName").value = result.user?.name || "";
    document.getElementById("profileEmail").value = result.user?.email || "";
    document.getElementById("profilePhone").value = result.user?.phone || "";
    renderProfileIdentity(result.user || {});
  } catch (error) {
    portalStatus.textContent = error.message;
    portalStatus.className = "status error";
  }
}

function showPortal(name) {
  authView.hidden = true;
  portalView.hidden = false;
  if (name && !patientProfile.name) renderProfileIdentity({ name });
  loadProfile();
  loadAppointments();
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(authForm));
  authStatus.textContent = authMode === "login" ? "Signing in..." : "Creating your account...";
  authStatus.className = "status";
  try {
    const endpoint = authMode === "login" ? "/api/auth/patient-login" : "/api/auth/register";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to continue.");
    if (authMode === "register") {
      authStatus.textContent = result.message;
      showMode("login");
      return;
    }
    patientToken = result.token;
    sessionStorage.setItem(patientTokenKey, patientToken);
    showPortal(result.name);
  } catch (error) {
    authStatus.textContent = error.message;
    authStatus.className = "status error";
  }
});

forgotPasswordButton.addEventListener("click", () => {
  showRecovery("request");
});

document.querySelectorAll(".back-to-signin").forEach(button => button.addEventListener("click", () => showMode("login")));

forgotPasswordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = new FormData(forgotPasswordForm).get("email");
  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to send the verification code.");
    document.getElementById("forgotStatus").textContent = result.message;
    document.getElementById("forgotStatus").className = "status success";
    document.getElementById("resetEmail").value = String(email);
    document.getElementById("resetOtp").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("resetStatus").textContent = result.message;
    document.getElementById("resetStatus").className = "status success";
    showRecovery("reset");
  } catch (error) {
    document.getElementById("forgotStatus").textContent = error.message;
    document.getElementById("forgotStatus").className = "status error";
  }
});

resetPasswordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(resetPasswordForm));
  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to reset password.");
    resetPasswordForm.reset();
    document.getElementById("resetStatus").textContent = `${result.message} You can now sign in with your new password.`;
    document.getElementById("resetStatus").className = "status success";
  } catch (error) {
    document.getElementById("resetStatus").textContent = error.message;
    document.getElementById("resetStatus").className = "status error";
    document.getElementById("resetOtp").focus();
  }
});

document.querySelectorAll(".auth-tab").forEach(tab => tab.addEventListener("click", () => showMode(tab.dataset.mode)));

accountMenuButton.addEventListener("click", () => {
  const isOpen = !accountMenu.hidden;
  accountMenu.hidden = isOpen;
  accountMenuButton.setAttribute("aria-expanded", String(!isOpen));
});

document.getElementById("editProfileButton").addEventListener("click", () => {
  accountMenu.hidden = true;
  accountMenuButton.setAttribute("aria-expanded", "false");
  profileStatus.textContent = "";
  profileStatus.className = "status";
  document.getElementById("profileName").value = patientProfile.name;
  document.getElementById("profileEmail").value = patientProfile.email;
  document.getElementById("profilePhone").value = patientProfile.phone;
  profileDialog.showModal();
  document.getElementById("profileName").focus();
});

function closeProfileDialog() {
  profileDialog.close();
}

document.getElementById("closeProfileDialog").addEventListener("click", closeProfileDialog);
document.getElementById("cancelProfileEdit").addEventListener("click", closeProfileDialog);
profileDialog.addEventListener("click", event => {
  if (event.target === profileDialog) closeProfileDialog();
});
document.addEventListener("click", event => {
  if (!accountMenu.hidden && !event.target.closest(".account-menu")) {
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
  }
});

document.getElementById("patientLogout").addEventListener("click", () => {
  sessionStorage.removeItem(patientTokenKey);
  patientToken = "";
  patientProfile = { name: "", email: "", phone: "" };
  accountMenu.hidden = true;
  accountMenuButton.setAttribute("aria-expanded", "false");
  if (profileDialog.open) profileDialog.close();
  portalView.hidden = true;
  authView.hidden = false;
  authForm.reset();
  showMode("login");
});

profileForm.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(profileForm));
  try {
    const response = await fetch("/api/my-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${patientToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to update profile.");
    profileStatus.textContent = result.message;
    profileStatus.className = "status success";
    renderProfileIdentity({
      name: document.getElementById("profileName").value,
      email: document.getElementById("profileEmail").value,
      phone: document.getElementById("profilePhone").value
    });
  } catch (error) {
    profileStatus.textContent = error.message;
    profileStatus.className = "status error";
  }
});

appointmentList.addEventListener("click", async event => {
  if (!event.target.matches(".cancel-button")) return;
  const response = await fetch(`/api/my-appointments/${event.target.dataset.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${patientToken}` } });
  const result = await response.json();
  portalStatus.textContent = response.ok ? result.message : result.errors?.join(" ") || "Unable to cancel appointment.";
  portalStatus.className = response.ok ? "status success" : "status error";
  if (response.ok) loadAppointments();
});

if (patientToken) showPortal();
