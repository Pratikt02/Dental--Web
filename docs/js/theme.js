(function () {
  const storageKey = "sakthiDentalTheme";
  const savedTheme = localStorage.getItem(storageKey);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    document.querySelectorAll(".theme-toggle").forEach(button => {
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      button.querySelector(".theme-toggle-label").textContent = isDark ? "Light" : "Dark";
      button.querySelector(".theme-toggle-icon").textContent = isDark ? "☀" : "☾";
    });
  }

  function createToggle() {
    if (document.querySelector(".theme-toggle")) return;

    const toggle = document.createElement("button");
    toggle.className = "theme-toggle";
    toggle.type = "button";
    toggle.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true"></span><span class="theme-toggle-label"></span>';
    toggle.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
      localStorage.setItem(storageKey, nextTheme);
      applyTheme(nextTheme);
    });

    document.body.appendChild(toggle);
    applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
  }

  if (document.body) {
    applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
    document.addEventListener("DOMContentLoaded", createToggle, { once: true });
  }
})();