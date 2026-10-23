// Scroll animation for cards
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll(".treatment-card").forEach(card => {
  observer.observe(card);
});

// Appointment booking
const appointmentDateInput = document.getElementById("appointmentDate");
const appointmentTimeInput = document.getElementById("appointmentTime");
const doctorInput = document.getElementById("doctor");
let availableTimes = [];

function formatTimeLabel(value) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function renderAvailableTimes() {
  appointmentTimeInput.innerHTML = '<option value="">Choose an available time</option>' + availableTimes
    .map(time => `<option value="${time}">${formatTimeLabel(time)}</option>`)
    .join("");
  appointmentTimeInput.disabled = availableTimes.length === 0;
  if (!availableTimes.length) {
    appointmentTimeInput.innerHTML = '<option value="">No times available for this date and dentist</option>';
  }
}

async function loadDoctors() {
  if (!doctorInput) return;
  try {
    const response = await fetch("/api/doctors");
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load dentists.");
    doctorInput.innerHTML = '<option value="">Any available dentist</option>' + result.doctors
      .map(doctor => `<option value="${doctor.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}">${doctor.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</option>`)
      .join("");
  } catch (error) {
    const status = document.getElementById("appointmentStatus");
    status.textContent = error.message;
    status.className = "form-status error";
  }
}

async function loadAvailability() {
  availableTimes = [];
  renderAvailableTimes();
  if (!appointmentDateInput?.value) return;

  const params = new URLSearchParams({ date: appointmentDateInput.value });
  if (doctorInput?.value) params.set("doctor", doctorInput.value);
  try {
    const response = await fetch(`/api/availability?${params}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.join(" ") || "Unable to load available times.");
    availableTimes = result.availableTimes || [];
    renderAvailableTimes();
  } catch (error) {
    const status = document.getElementById("appointmentStatus");
    status.textContent = error.message;
    status.className = "form-status error";
  }
}

if (appointmentDateInput) {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  const maxDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  appointmentDateInput.min = localDate;
  appointmentDateInput.max = new Date(maxDate.getTime() - maxDate.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  appointmentDateInput.addEventListener("change", loadAvailability);
}

doctorInput?.addEventListener("change", loadAvailability);
loadDoctors();

document.getElementById("appointmentForm")?.addEventListener("submit", async function (event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = document.getElementById("appointmentStatus");
  const submitButton = form.querySelector("button[type='submit']");

  const selectedTime = appointmentTimeInput?.value || "";
  if (selectedTime) {
    const [hourText, minuteText] = selectedTime.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const totalMinutes = (hour * 60) + minute;
    if (totalMinutes < 9 * 60 || totalMinutes > 19 * 60 || (minute !== 0 && minute !== 30)) {
      appointmentTimeInput.setCustomValidity("Please choose a time between 9:00 AM and 7:00 PM in 30-minute slots.");
      appointmentTimeInput.reportValidity();
      return;
    }
  }

  if (appointmentTimeInput && !availableTimes.includes(selectedTime)) {
    appointmentTimeInput.setCustomValidity("Please choose one of the available appointment times.");
    appointmentTimeInput.reportValidity();
    return;
  }
  appointmentTimeInput?.setCustomValidity("");

  status.textContent = "Sending your request...";
  status.className = "form-status";
  submitButton.disabled = true;

  try {
    const patientToken = sessionStorage.getItem("sakthiDentalPatientSession");
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(patientToken ? { Authorization: `Bearer ${patientToken}` } : {})
      },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.errors?.join(" ") || "Unable to submit the request.");
    }

    status.textContent = result.message;
    status.className = "form-status success";
    form.reset();
  } catch (error) {
    status.textContent = error.message || "Unable to submit the request. Please call the clinic.";
    status.className = "form-status error";
  } finally {
    submitButton.disabled = false;
  }
});
