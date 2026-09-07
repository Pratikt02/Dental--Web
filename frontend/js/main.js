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

// ====================
// Testimonials Slider
// ====================
document.addEventListener("DOMContentLoaded", function () {
  const testimonials = document.querySelectorAll(".testimonial-card");
  let index = 0;

  if (testimonials.length === 0) return;

  setInterval(() => {
    testimonials[index].classList.remove("active");
    index = (index + 1) % testimonials.length;
    testimonials[index].classList.add("active");
  }, 4000);
});

// Appointment booking
const appointmentDateInput = document.getElementById("appointmentDate");

if (appointmentDateInput) {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  appointmentDateInput.min = localDate;
}

document.getElementById("appointmentForm")?.addEventListener("submit", async function (event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = document.getElementById("appointmentStatus");
  const submitButton = form.querySelector("button[type='submit']");

  status.textContent = "Sending your request...";
  status.className = "form-status";
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

// ====================
// Professional Dental Tips (Auto Changing)
// ====================

document.addEventListener("DOMContentLoaded", function () {

  const tips = [
    {
      title: "Brush Twice Daily",
      text: "Brush your teeth morning and night using fluoride toothpaste."
    },
    {
      title: "Floss Regularly",
      text: "Floss removes food particles and plaque between teeth."
    },
    {
      title: "Visit Dentist Every 6 Months",
      text: "Regular checkups help detect problems early."
    },
    {
      title: "Avoid Excess Sugar",
      text: "Too much sugar increases risk of cavities."
    },
    {
      title: "Drink Plenty of Water",
      text: "Water helps wash away bacteria and keeps mouth fresh."
    }
  ];

  const container = document.getElementById("tips-container");

  if (!container) return;

  let index = 0;

  function showTip() {
    container.innerHTML = `
      <div class="tip-card">
        <h3>${tips[index].title}</h3>
        <p>${tips[index].text}</p>
      </div>
    `;

    index = (index + 1) % tips.length;
  }

  showTip();
  setInterval(showTip, 4000); // Change every 4 seconds

});