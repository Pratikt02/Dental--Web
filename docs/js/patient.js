const authView = document.getElementById("authView");
const portalView = document.getElementById("portalView");
const authForm = document.getElementById("patientAuthForm");
const authStatus = document.getElementById("authStatus");
const portalStatus = document.getElementById("portalStatus");
const appointmentList = document.getElementById("appointmentList");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const profileForm = document.getElementById("profileForm");
const profileStatus = document.getElementById("profileStatus");
const patientTokenKey = "sakthiDentalPatientSession";
let patientToken = sessionStorage.getItem(patientTokenKey) || "";
let authMode = "login";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatAppointment(item) {
  const date = new Date(`${item.appointmentDate}T${item.appointmentTime}`);
  return Number.isNaN(date.getTime()) ? `${item.appointmentDate} at ${item.appointmentTime}` : date.toLocaleString([], { dateStyle: "long", timeStyle: "short" });
}

function showMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  document.getElementById("nameField").hidden = mode === "login";
  document.getElementById("phoneField").hidden = mode === "login";
  document.getElementById("patientName").required = mode === "register";
  document.getElementById("patientPhone").required = mode === "register";
  document.getElementById("authSubmitText").textContent = mode === "login" ? "Sign in" : "Create account";
}

async function loadAppointments() {
  portalStatus.textContent = "Loading your appointments...";
  try {
    const response = await fetch("/api/my-appointments", { headers: { Authorization: `Bearer ${patientToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load appointments.");
    appointmentList.innerHTML = result.appointments.length ? result.appointments.map(item => `
      <article class="appointment-card">
        <div><span class="appointment-label">${escapeHtml(item.treatment)}</span><h2>${escapeHtml(formatAppointment(item))}</h2><p>${escapeHtml(item.message || "No additional information")}</p></div>
        <div class="appointment-meta"><span class="appointment-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.status === "pending" ? `<button class="cancel-button" data-id="${escapeHtml(item._id)}" type="button">Cancel request</button>` : ""}</div>
      </article>
    `).join("") : '<p class="empty-state">You have no appointment requests yet.</p>';
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
    document.getElementById("profilePhone").value = result.user?.phone || "";
  } catch (error) {
    portalStatus.textContent = error.message;
    portalStatus.className = "status error";
  }
}

function showPortal(name) {
  authView.hidden = true;
  portalView.hidden = false;
  document.getElementById("welcomeTitle").textContent = `${name ? `Welcome, ${name}` : "Your appointments"}`;
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
  forgotPasswordForm.hidden = false;
  resetPasswordForm.hidden = false;
  authStatus.textContent = "Enter your email to receive a reset link.";
  authStatus.className = "status";
});

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
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to send reset link.");
    document.getElementById("forgotStatus").textContent = result.message;
    document.getElementById("forgotStatus").className = "status success";
    if (result.resetToken) document.getElementById("resetToken").value = result.resetToken;
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
    document.getElementById("resetStatus").textContent = result.message;
    document.getElementById("resetStatus").className = "status success";
    resetPasswordForm.reset();
  } catch (error) {
    document.getElementById("resetStatus").textContent = error.message;
    document.getElementById("resetStatus").className = "status error";
  }
});

document.querySelectorAll(".auth-tab").forEach(tab => tab.addEventListener("click", () => showMode(tab.dataset.mode)));
document.getElementById("patientLogout").addEventListener("click", () => {
  sessionStorage.removeItem(patientTokenKey);
  patientToken = "";
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
    showPortal(document.getElementById("profileName").value || "Your account");
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
