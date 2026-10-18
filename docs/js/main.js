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
let bookedTimes = [];

function buildAppointmentTimeOptions() {
  const slots = [];
  const startMinutes = 9 * 60;
  const endMinutes = 19 * 60;

  for (let totalMinutes = startMinutes; totalMinutes <= endMinutes; totalMinutes += 30) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const isPm = hour >= 12;
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const label = `${displayHour}:${String(minute).padStart(2, "0")} ${isPm ? "PM" : "AM"}`;
    slots.push({ value, label });
  }

  return slots;
}

if (appointmentTimeInput) {
  const options = buildAppointmentTimeOptions();
  appointmentTimeInput.innerHTML = '<option value="">Select a time</option>' + options
    .map(slot => `<option value="${slot.value}">${slot.label}</option>`)
    .join("");
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
  appointmentDateInput.addEventListener("change", async () => {
    try {
      const response = await fetch(`/api/availability?date=${appointmentDateInput.value}`);
      const result = await response.json();
      bookedTimes = response.ok ? result.bookedTimes : [];
      appointmentTimeInput?.setCustomValidity("");
    } catch (error) {
      bookedTimes = [];
    }
  });
}

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

  if (appointmentTimeInput && bookedTimes.includes(selectedTime)) {
    appointmentTimeInput.setCustomValidity("This time is already requested. Please choose another time.");
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
