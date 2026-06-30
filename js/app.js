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

      // Auto-backup si está activado
      const settings = Storage.getSettings();
      if (settings.autoBackup) this.startAutoBackup();
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
      document.getElementById("btn-export").onclick = () => this.exportBackup();
      document.getElementById("btn-export-encrypted").onclick = () => this.exportEncryptedBackup();
      document.getElementById("btn-auto-backup").onclick = () => this.toggleAutoBackup();
      document.getElementById("file-import").onchange = e => this.handleImportBackup(e);
      document.getElementById("btn-clear").onclick = () => this.requirePassword("¿Borrar TODOS los datos? Esto incluye usuarios y niños.", () => {
        Storage.clearAll();
        Auth.logout();
        location.reload();
      });
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

      // WebDAV sync
      document.getElementById("btn-save-webdav").onclick = () => this.saveWebdav();
      document.getElementById("btn-sync-now").onclick = () => this.syncNow();
      document.getElementById("btn-sync-push").onclick = () => this.syncPush();
      document.getElementById("btn-sync-pull").onclick = () => this.syncPull();
      this.refreshWebdavStatus();

      this.refreshBackupStatus();
    },

    /* ---------- WebDAV sync UI ---------- */
    refreshWebdavStatus() {
      const cfg = SyncModule.getConfig();
      const statusEl = document.getElementById("webdav-status");
      const urlEl = document.getElementById("set-webdav-url");
      const userEl = document.getElementById("set-webdav-user");
      const passEl = document.getElementById("set-webdav-pass");
      if (urlEl) urlEl.value = cfg.url || "";
      if (userEl) userEl.value = cfg.username || "";
      if (passEl) passEl.value = cfg.password || "";
      const settings = Storage.getSettings();
      if (SyncModule.isConfigured()) {
        const last = settings.lastSyncPush || settings.lastSyncPull;
        const lastStr = last ? `Última sync: ${new Date(last).toLocaleString("es-AR")}` : "Configurado. Sin sincronización aún.";
        statusEl.textContent = `✓ ${lastStr}`;
        statusEl.className = "hint good";
      } else {
        statusEl.textContent = "Sin configurar.";
        statusEl.className = "hint";
      }
    },
    async saveWebdav() {
      const url = document.getElementById("set-webdav-url").value.trim();
      const username = document.getElementById("set-webdav-user").value.trim();
      const password = document.getElementById("set-webdav-pass").value;
      Storage.setSettings({ webdav_url: url, webdav_user: username, webdav_pass: password });
      this.toast("Configuración guardada");
      this.refreshWebdavStatus();
      try {
        await SyncModule.testConnection();
        this.toast("✓ Conexión exitosa con el servidor");
      } catch (e) {
        this.toast("Error: " + e.message);
      }
    },
    async syncNow() {
      if (!SyncModule.isConfigured()) {
        this.toast("Configurá el servidor primero");
        return;
      }
      try {
        const result = await SyncModule.sync();
        this.toast(`✓ Sync OK (${result.action || "completado"})`);
        this.refreshWebdavStatus();
        if (result.action === "pull" || result.size) {
          // Si bajó datos remotos, recargar la app
          setTimeout(() => location.reload(), 1500);
        }
      } catch (e) {
        this.toast("Error en sync: " + e.message);
      }
    },
    async syncPush() {
      this.requirePassword("Confirmá tu identidad para subir al servidor", async () => {
        try {
          await Storage.persistNow();
          await SyncModule.push();
          this.toast("✓ Datos subidos al servidor");
          this.refreshWebdavStatus();
        } catch (e) {
          this.toast("Error: " + e.message);
        }
      });
    },
    async syncPull() {
      this.requirePassword("Confirmá tu identidad para descargar (pisa los datos locales)", async () => {
        try {
          const result = await SyncModule.pull();
          this.toast(`✓ Datos descargados (${Math.round(result.size/1024)} KB). Recargando…`);
          setTimeout(() => location.reload(), 1500);
        } catch (e) {
          this.toast("Error: " + e.message);
        }
      });
    },

    /* ---------- Backup helpers ---------- */
    exportBackup() {
      const json = Storage.exportJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saludinfantil-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast("Respaldo descargado");
    },
    async exportEncryptedBackup() {
      const me = Auth.getCurrentUser();
      if (!me) return;
      // Re-autenticar para confirmar
      this.requirePassword("Re-escribí tu contraseña para cifrar el respaldo", async (password) => {
        try {
          const json = await Storage.exportEncryptedJSON(password);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `saludinfantil-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.toast("Respaldo cifrado descargado");
        } catch (e) {
          this.toast("Error: " + e.message);
        }
      });
    },
    async handleImportBackup(e) {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const text = ev.target.result;
          let data = null;
          try { data = JSON.parse(text); } catch { throw new Error("Archivo no es JSON válido"); }

          if (data.encrypted && data.payload) {
            // Backup cifrado → pedir password
            this.requirePassword("Backup cifrado — ingresá tu contraseña", async (password) => {
              try {
                await Storage.importJSONAuto(text, password);
                this.toast("Backup cifrado importado ✓");
                this.refreshAll();
              } catch (err) {
                this.toast("Error: " + err.message);
              }
            });
          } else {
            // Backup en plano → re-autenticar para confirmar
            this.requirePassword("Re-escribí tu contraseña para importar (reemplaza todos los datos)", async () => {
              try {
                await Storage.importJSONAuto(text);
                this.toast("Backup importado ✓");
                this.refreshAll();
              } catch (err) {
                this.toast("Error: " + err.message);
              }
            });
          }
        } catch (err) {
          this.toast("Error: " + err.message);
        }
      };
      reader.readAsText(file);
    },
    refreshBackupStatus() {
      const settings = Storage.getSettings();
      const el = document.getElementById("backup-status");
      const btn = document.getElementById("btn-auto-backup");
      if (!el || !btn) return;
      if (settings.lastBackup) {
        const date = new Date(settings.lastBackup);
        const days = Math.floor((Date.now() - date.getTime()) / 86400000);
        el.innerHTML = days === 0
          ? `✓ Último respaldo: hoy`
          : days === 1
            ? `⚠ Último respaldo: ayer`
            : days < 7
              ? `⚠ Último respaldo: hace ${days} días`
              : `❌ Último respaldo: hace ${days} días (recomendamos hacer uno)`;
        el.className = days < 2 ? "hint good" : days < 7 ? "hint warn" : "hint bad";
      } else {
        el.innerHTML = `❌ Nunca se hizo un respaldo. Te recomendamos hacer uno.`;
        el.className = "hint bad";
      }
      btn.textContent = settings.autoBackup ? "⏸ Pausar auto-backup" : "▶ Activar auto-backup (cada 24h)";
    },
    toggleAutoBackup() {
      const settings = Storage.getSettings();
      const newVal = !settings.autoBackup;
      Storage.setSettings({ autoBackup: newVal });
      if (newVal) this.startAutoBackup();
      else this.stopAutoBackup();
      this.refreshBackupStatus();
      this.toast(newVal ? "Auto-backup activado (cada 24h)" : "Auto-backup pausado");
    },
    autoBackupInterval: null,
    startAutoBackup() {
      this.stopAutoBackup();
      // Backup silencioso cada 24h. Si pasaron >24h desde el último, hacer uno al inicio.
      const tick = async () => {
        try {
          if (!Storage.hasEncryptionKey()) return;
          const json = await Storage.exportEncryptedJSONWithKey();
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `saludinfantil-autobackup-${new Date().toISOString().slice(0, 10)}.json`;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          Storage.setSettings({ lastBackup: new Date().toISOString() });
          this.refreshBackupStatus();
        } catch (e) {
          console.warn("Auto-backup failed:", e.message);
        }
      };
      // Disparar cada 24h
      this.autoBackupInterval = setInterval(tick, 24 * 60 * 60 * 1000);
      // Si pasó más de 24h desde el último, hacer uno ahora (silencioso)
      const settings = Storage.getSettings();
      if (!settings.lastBackup || (Date.now() - new Date(settings.lastBackup).getTime()) > 24 * 60 * 60 * 1000) {
        setTimeout(tick, 5000);
      }
    },
    stopAutoBackup() {
      if (this.autoBackupInterval) {
        clearInterval(this.autoBackupInterval);
        this.autoBackupInterval = null;
      }
    },

    /* ---------- Re-authentication for sensitive actions ---------- */
    /**
     * Pide al usuario re-escribir su contraseña antes de ejecutar una acción sensible.
     * Si el password es correcto, ejecuta onConfirm(password).
     */
    requirePassword(message, onConfirm) {
      this.openModal({
        title: "Confirmar identidad",
        body: `
          <p class="hint" style="margin-bottom:12px">${esc(message)}</p>
          <div class="field">
            <label>Tu contraseña</label>
            <input type="password" id="reauth-password" autofocus autocomplete="current-password" />
          </div>
          <div class="auth-error" id="reauth-error" hidden></div>
        `,
        footer: [
          { label: "Cancelar", class: "btn", action: "close" },
          { label: "Confirmar", class: "btn primary", action: async () => {
            const pwd = document.getElementById("reauth-password").value;
            const errEl = document.getElementById("reauth-error");
            if (!pwd) { errEl.textContent = "Ingresá tu contraseña"; errEl.hidden = false; return; }
            // Verificar intentando hacer login
            const me = Auth.getCurrentUser();
            if (!me) { this.closeModal(); return; }
            const verified = await Auth.login(me.username, pwd);
            if (!verified) {
              errEl.textContent = "Contraseña incorrecta";
              errEl.hidden = false;
              return;
            }
            this.closeModal();
            onConfirm(pwd);
          }},
        ],
      });
    },
  };

  function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function roleLabel(r) { return { admin: "Administrador", member: "Editor", viewer: "Solo lectura" }[r] || r; }
  function roleColor(r) { return { admin: "linear-gradient(135deg,#dc2626,#f59e0b)", member: "linear-gradient(135deg,#2563eb,#06b6d4)", viewer: "linear-gradient(135deg,#6b7280,#94a3b8)" }[r] || "var(--primary)"; }

  window.App = App;
  document.addEventListener("DOMContentLoaded", () => App.init());
})();