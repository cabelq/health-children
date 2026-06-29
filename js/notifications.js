/* Módulo Notifications — notificaciones del navegador para vacunas y citas */
window.NotificationsModule = (function () {
  const STORAGE_KEY = "saludinfantil_notif_state";

  function supported() { return "Notification" in window; }

  async function requestPermission() {
    if (!supported()) {
      App.toast("Tu navegador no soporta notificaciones");
      return false;
    }
    if (Notification.permission === "granted") {
      Storage.setSettings({ notifications: true });
      App.toast("Notificaciones ya activas ✓");
      return true;
    }
    const result = await Notification.requestPermission();
    if (result === "granted") {
      Storage.setSettings({ notifications: true });
      App.toast("Notificaciones activadas ✓");
      scheduleChecks();
      return true;
    }
    App.toast("Permiso denegado");
    return false;
  }

  function show(title, body, tag = "saludinfantil") {
    if (!supported() || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, icon: "icons/icon.svg", tag, badge: "icons/icon.svg" });
    } catch (e) {}
  }

  function checkVaccines() {
    if (Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    const lastKey = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const children = Storage.listChildren();
    let overdueCount = 0;
    let dueSoonCount = 0;
    children.forEach(c => {
      if (!c.birthDate || !c.country) return;
      const info = window.VACCINE_SCHEDULES[c.country];
      if (!info) return;
      const ageNow = OMS.monthsBetween(c.birthDate, new Date());
      info.schedule.forEach(v => {
        const vId = `${v.name}__${v.dose}`;
        if ((c.vaccines || []).some(x => x.vaccineId === vId)) return;
        if (ageNow >= v.ageMonths) overdueCount++;
        else if (v.ageMonths - ageNow <= 1) dueSoonCount++;
      });
    });
    if (overdueCount > 0 && lastKey.overdue !== today) {
      show("💉 Vacunas atrasadas", `${overdueCount} vacunas atrasadas en ${children.length} niños.`, "overdue");
      lastKey.overdue = today;
    }
    if (dueSoonCount > 0 && lastKey.dueSoon !== today) {
      show("⏰ Vacunas próximas", `${dueSoonCount} vacunas se aplican este mes.`, "dueSoon");
      lastKey.dueSoon = today;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastKey));
  }

  function checkAppointments() {
    if (Notification.permission !== "granted") return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastKey = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const children = Storage.listChildren();
    let tomorrowCount = 0, todayCount = 0;
    children.forEach(c => {
      (c.appointments || []).forEach(a => {
        if (a.done) return;
        if (a.date === tomorrowStr && a.reminder) tomorrowCount++;
        if (a.date === todayStr && a.reminder) todayCount++;
      });
    });
    if (todayCount > 0 && lastKey.apptToday !== todayStr) {
      show("📅 Cita hoy", `Tenés ${todayCount} cita(s) programada(s) para hoy.`, "apptToday");
      lastKey.apptToday = todayStr;
    }
    if (tomorrowCount > 0 && lastKey.apptTomorrow !== tomorrowStr) {
      show("📅 Cita mañana", `Tenés ${tomorrowCount} cita(s) programada(s) para mañana.`, "apptTomorrow");
      lastKey.apptTomorrow = tomorrowStr;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastKey));
  }

  function scheduleChecks() {
    checkVaccines();
    checkAppointments();
    // Re-chequear cada 6 horas
    setInterval(() => { checkVaccines(); checkAppointments(); }, 6 * 60 * 60 * 1000);
  }

  function init() {
    if (Notification.permission === "granted") {
      Storage.setSettings({ notifications: true });
      scheduleChecks();
    }
  }

  return { requestPermission, show, init, supported, scheduleChecks };
})();