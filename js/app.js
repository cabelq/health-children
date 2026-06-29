/* App — orquestador principal con autenticación */
(function () {
  const App = {
    currentTab: "dashboard",

    async init() {
      try { await Storage.init(); }
      catch (e) {
        console.error("Storage init failed", e);
        App.toast("Error al cargar la base de datos");
      }

      // Verificar sesión
      const user = Auth.getCurrentUser();
      if (!user) {
        this.showAuthScreen();
        return;
      }
      this.showApp();
    },

    showAuthScreen() {
      document.getElementById("auth-screen").hidden = false;
      document.getElementById("app-container").hidden = true;
      this.setupAuth();
    },

    showApp() {
      document.getElementById("auth-screen").hidden = true;
      document.getElementById("app-container").hidden = false;
      this.setupApp();
    },

    setupAuth() {
      const sub = document.getElementById("auth-sub");
      const loginForm = document.getElementById("login-form");
      const regForm = document.getElementById("register-form");

      const showLogin = () => {
        sub.textContent = "Iniciá sesión para acceder a tu familia";
        loginForm.hidden = false;
        regForm.hidden = true;
      };
      const showRegister = () => {
        if (Auth.hasUsers()) {
          sub.textContent = "Agregar un nuevo miembro a la familia";
        } else {
          sub.textContent = "Creá la cuenta del primer administrador familiar";
        }
        loginForm.hidden = true;
        regForm.hidden = false;
      };

      if (Auth.hasUsers()) showLogin();
      else showRegister();

      document.getElementById("go-register").onclick = (e) => { e.preventDefault(); showRegister(); };
      document.getElementById("go-login").onclick = (e) => { e.preventDefault(); showLogin(); };

      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(loginForm));
        const errEl = document.getElementById("login-error");
        errEl.hidden = true;
        const user = await Auth.login(fd.username, fd.password);
        if (!user) {
          errEl.textContent = "Usuario o contraseña incorrectos";
          errEl.hidden = false;
          return;
        }
        this.showApp();
      };

      regForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(regForm));
        const errEl = document.getElementById("register-error");
        errEl.hidden = true;
        try {
          await Auth.register({
            username: fd.username.trim().toLowerCase(),
            displayName: fd.displayName.trim(),
            password: fd.password,
            role: Auth.hasUsers() ? "member" : "admin",
          });
          // Auto-login
          const u = await Auth.login(fd.username.trim().toLowerCase(), fd.password);
          if (u) this.showApp();
        } catch (err) {
          errEl.textContent = err.message;
          errEl.hidden = false;
        }
      };
    },

    setupApp() {
      ThemeModule.init();
      NotificationsModule.init();

      // Tabs
      document.querySelectorAll(".tab").forEach(btn => {
        btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
      });

      // Mostrar/ocultar tabs según rol
      const me = Auth.getCurrentUser();
      document.querySelectorAll("[data-admin-only]").forEach(el => {
        el.hidden = !Auth.isAdmin();
      });

      // User chip
      const avatar = document.getElementById("user-avatar");
      const name = document.getElementById("user-name");
      const role = document.getElementById("user-role");
      const greeting = document.getElementById("user-greeting");
      if (me) {
        avatar.textContent = (me.displayName || me.username)[0].toUpperCase();
        avatar.style.background = roleColor(me.role);
        name.textContent = me.displayName;
        role.textContent = roleLabel(me.role);
        greeting.textContent = me.displayName.split(" ")[0] + " 👋";
      }

      document.getElementById("btn-logout").onclick = () => {
        if (confirm("¿Cerrar sesión?")) {
          Auth.logout();
          location.reload();
        }
      };

      // Módulos
      ChildrenModule.bindEvents();
      VaccinesModule.bindEvents();
      GrowthModule.bindEvents();
      MedicationsModule.bindEvents();
      AppointmentsModule.bindEvents();
      NewsModule.bindEvents();
      this.bindSettings();

      // Gating: deshabilitar botones de edición para viewers
      if (!Auth.canEdit()) {
        document.querySelectorAll("[data-requires='member']").forEach(btn => {
          btn.disabled = true;
          btn.title = "Tu rol no permite editar";
          btn.style.opacity = ".5";
          btn.style.cursor = "not-allowed";
        });
      }

      // Selects iniciales
      VaccinesModule.renderCountrySelect();
      VaccinesModule.renderChildSelect();
      GrowthModule.renderChildSelect();
      AppointmentsModule.renderChildSelect();
      MedicationsModule.renderChildSelect();
      NewsModule.renderCountrySelect();
      this.renderSettingsCountry();

      this.refreshFamilyHeader();
      this.switchTab("dashboard");
      this.refreshDashboard();
      ChildrenModule.render();

      window.addEventListener("resize", () => {
        const id = document.getElementById("growth-child").value;
        if (this.currentTab === "growth" && id) GrowthModule.renderFor(id);
      });

      let newsLoaded = false;
      document.querySelector('[data-tab="news"]').addEventListener("click", () => {
        if (!newsLoaded) { NewsModule.load(); newsLoaded = true; }
      });

      document.addEventListener("keydown", e => {
        if (e.key === "Escape") { this.closeModal(); this.closeLightbox(); }
      });

      // Sliding session refresh
      setInterval(() => Auth.refresh(), 30 * 60 * 1000);
    },

    switchTab(tab) {
      // Si no es admin y quiere ir a users, ignorar
      if (tab === "users" && !Auth.isAdmin()) return;
      this.currentTab = tab;
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + tab));
      if (tab === "children") ChildrenModule.render();
      if (tab === "vaccines") { VaccinesModule.renderChildSelect(); VaccinesModule.renderSchedule(); }
      if (tab === "growth") {
        GrowthModule.renderChildSelect();
        const id = document.getElementById("growth-child").value;
        GrowthModule.renderFor(id);
      }
      if (tab === "calendar") { AppointmentsModule.renderChildSelect(); AppointmentsModule.render(); }
      if (tab === "medications") { MedicationsModule.renderChildSelect(); MedicationsModule.renderList(); }
      if (tab === "users") UsersModule.renderList();
      if (tab === "settings") this.renderSettingsForm();
    },

    refreshAll() {
      ChildrenModule.render();
      VaccinesModule.renderChildSelect();
      GrowthModule.renderChildSelect();
      AppointmentsModule.renderChildSelect();
      MedicationsModule.renderChildSelect();
      this.refreshDashboard();
    },

    refreshFamilyHeader() {
      const s = Storage.getSettings();
      if (s.familyName) {
        document.getElementById("family-name").textContent = s.familyName;
        document.title = `${s.familyName} — SaludInfantil`;
      }
    },

    refreshDashboard() {
      const children = Storage.listChildren();
      document.getElementById("stat-children").textContent = children.length;
      const totalVisits = children.reduce((s, c) => s + (c.visits?.length || 0), 0);
      document.getElementById("stat-visits").textContent = totalVisits;

      let pending = 0;
      const nextList = [];
      const today = new Date().toISOString().slice(0, 10);
      const limitDate = new Date(); limitDate.setDate(limitDate.getDate() + 60);
      const limitStr = limitDate.toISOString().slice(0, 10);

      children.forEach(c => {
        if (c.birthDate && c.country) {
          const info = window.VACCINE_SCHEDULES[c.country];
          if (info) {
            const ageNow = OMS.monthsBetween(c.birthDate, new Date());
            info.schedule.forEach(v => {
              const vId = `${v.name}__${v.dose}`;
              if ((c.vaccines || []).some(x => x.vaccineId === vId)) return;
              if (ageNow >= v.ageMonths) pending++;
              const target = new Date(c.birthDate);
              target.setMonth(target.getMonth() + v.ageMonths);
              const ts = target.toISOString().slice(0, 10);
              if (ts >= today && ts <= limitStr) {
                nextList.push({ date: ts, kind: "vacuna", child: c, label: v.name, sub: v.dose });
              }
            });
          }
        }
        (c.appointments || []).forEach(a => {
          if (!a.done && a.date >= today && a.date <= limitStr) {
            const ti = AppointmentsModule.typeInfo(a.type);
            nextList.push({ date: a.date, kind: "cita", child: c, label: ti.label + (a.time ? " " + a.time + " hs" : ""), sub: a.notes });
          }
        });
      });

      document.getElementById("stat-pending").textContent = pending;

      const upcomingEl = document.getElementById("upcoming-events");
      if (!nextList.length) {
        upcomingEl.innerHTML = `<div class="hint">Sin eventos en los próximos 60 días. 🎉</div>`;
      } else {
        upcomingEl.innerHTML = nextList.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10).map(it => {
          const dt = new Date(it.date + "T00:00:00");
          const diff = Math.round((dt - new Date()) / 86400000);
          const lbl = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : `en ${diff}d`;
          const ico = it.kind === "vacuna" ? "💉" : "📅";
          const dotClass = it.kind === "vacuna" ? "pending" : "info";
          return `<div class="list-item">
            <div class="dot ${dotClass}"></div>
            <div class="grow">
              <div class="title">${ico} ${esc(it.label)} — ${esc(it.child.firstName)}</div>
              <div class="sub">${ChildrenModule.formatDate(it.date)} (${lbl}) ${it.sub ? "· " + esc(it.sub) : ""}</div>
            </div>
          </div>`;
        }).join("");
      }

      const nextAppt = children
        .flatMap(c => (c.appointments || []).filter(a => !a.done).map(a => ({ ...a, childName: c.firstName })))
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      document.getElementById("stat-next").textContent = nextAppt
        ? `${ChildrenModule.formatDate(nextAppt.date)} — ${nextAppt.childName}` : "—";

      const alertsCont = document.getElementById("alerts-banner");
      const allAlerts = [];
      children.forEach(c => {
        const last = (c.measurements || []).slice(-1)[0];
        if (!last || !c.birthDate) return;
        const age = OMS.monthsBetween(c.birthDate, last.date);
        OMS.evaluateAlerts(last, age, c.sex).forEach(a => allAlerts.push({ ...a, child: c }));
      });
      if (allAlerts.length) {
        alertsCont.innerHTML = `<div class="alert high">
          <span class="ico">⚠</span>
          <div><strong>${allAlerts.length} alerta(s) clínica(s) en las últimas mediciones</strong><br><small>Revisá la sección Crecimiento.</small></div>
        </div>`;
      } else alertsCont.innerHTML = "";
    },

    renderSettingsCountry() {
      const sel = document.getElementById("set-default-country");
      if (!sel) return;
      sel.innerHTML = Object.entries(window.VACCINE_SCHEDULES)
        .map(([code, info]) => `<option value="${code}">${esc(info.name)}</option>`).join("");
      sel.value = Storage.getSettings().defaultCountry || "AR";
    },

    renderSettingsForm() {
      const s = Storage.getSettings();
      const el = document.getElementById("set-family-name");
      if (el) el.value = s.familyName || "";
      this.renderSettingsCountry();
    },

    openModal({ title, body, footer = [], onMount }) {
      const modal = document.getElementById("modal");
      document.getElementById("modal-title").textContent = title;
      document.getElementById("modal-body").innerHTML = body;
      const footEl = document.getElementById("modal-foot");
      footEl.innerHTML = "";
      footer.forEach(f => {
        const btn = document.createElement("button");
        btn.className = f.class || "btn";
        btn.textContent = f.label;
        btn.onclick = () => { if (f.action === "close" || !f.action) this.closeModal(); else f.action(); };
        footEl.appendChild(btn);
      });
      modal.hidden = false;
      if (onMount) onMount(modal);
    },
    closeModal() { document.getElementById("modal").hidden = true; },

    openLightbox(src) {
      const lb = document.getElementById("lightbox");
      document.getElementById("lightbox-img").src = src;
      lb.hidden = false;
      lb.onclick = () => this.closeLightbox();
    },
    closeLightbox() {
      const lb = document.getElementById("lightbox");
      lb.hidden = true;
      document.getElementById("lightbox-img").src = "";
    },

    toast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => t.hidden = true, 2400);
    },

    bindSettings() {
      document.getElementById("btn-export").onclick = () => {
        const json = Storage.exportJSON();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `saludinfantil-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast("Respaldo descargado");
      };
      document.getElementById("file-import").onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try { Storage.importJSON(ev.target.result); this.toast("Datos importados"); this.refreshAll(); }
          catch { this.toast("Archivo inválido"); }
        };
        reader.readAsText(file);
      };
      document.getElementById("btn-clear").onclick = () => {
        if (confirm("¿Borrar TODOS los datos? Esto incluye usuarios y niños.")) {
          Storage.clearAll();
          Auth.logout();
          location.reload();
        }
      };
      document.getElementById("modal-close").onclick = () => this.closeModal();
      document.getElementById("modal").addEventListener("click", e => { if (e.target.id === "modal") this.closeModal(); });
      document.getElementById("btn-save-settings").onclick = () => {
        const familyName = document.getElementById("set-family-name").value.trim();
        const defaultCountry = document.getElementById("set-default-country").value;
        Storage.setSettings({ familyName, defaultCountry });
        this.refreshFamilyHeader();
        this.toast("Ajustes guardados");
      };
      document.getElementById("btn-notif").onclick = () => NotificationsModule.requestPermission();
      document.getElementById("btn-test-notif").onclick = () => {
        NotificationsModule.show("🩺 SaludInfantil", "Notificación de prueba.");
        this.toast("Mira la esquina de tu pantalla");
      };
    },
  };

  function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function roleLabel(r) { return { admin: "Administrador", member: "Editor", viewer: "Solo lectura" }[r] || r; }
  function roleColor(r) { return { admin: "linear-gradient(135deg,#dc2626,#f59e0b)", member: "linear-gradient(135deg,#2563eb,#06b6d4)", viewer: "linear-gradient(135deg,#6b7280,#94a3b8)" }[r] || "var(--primary)"; }

  window.App = App;
  document.addEventListener("DOMContentLoaded", () => App.init());
})();