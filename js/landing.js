/* Landing page — theme toggle */
(function () {
  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    try { localStorage.setItem("saludinfantil_landing_theme", theme); } catch (e) {}
  }
  // Inicializar con preferencia guardada o del sistema
  let saved = null;
  try { saved = localStorage.getItem("saludinfantil_landing_theme"); } catch (e) {}
  if (!saved) {
    saved = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  apply(saved);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    apply(current === "dark" ? "light" : "dark");
  });
})();