/* Módulo Theme — modo claro/oscuro */
window.ThemeModule = (function () {
  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀️" : "🌙";
    Storage.setSettings({ theme });
    // Re-renderizar gráficos para que adopten el nuevo fondo
    setTimeout(() => {
      const gc = document.getElementById("growth-child");
      if (gc && gc.value && document.getElementById("view-growth").classList.contains("active")) {
        GrowthModule.renderFor(gc.value);
      }
    }, 50);
  }

  function init() {
    const settings = Storage.getSettings();
    apply(settings.theme || "light");
    document.getElementById("theme-toggle").onclick = () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      apply(current === "dark" ? "light" : "dark");
    };
  }

  return { apply, init };
})();