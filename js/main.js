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

// Contact form validation
document.getElementById("contactForm")?.addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const error = document.getElementById("formError");

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name || !email || !phone) {
    error.textContent = "Please fill all required fields.";
    return;
  }

  if (!emailPattern.test(email)) {
    error.textContent = "Please enter a valid email address.";
    return;
  }

  error.textContent = "";
  alert("Thank you! Your message has been submitted.");
  this.reset();
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