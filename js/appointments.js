/* Módulo Appointments — calendario mensual + gestión de citas */
window.AppointmentsModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  let currentMonth = new Date();

  const APPT_TYPES = [
    { value: "control", label: "Control de niño sano", ico: "🩺" },
    { value: "vacuna", label: "Vacuna", ico: "💉" },
    { value: "especialista", label: "Especialista", ico: "👨‍⚕️" },
    { value: "estudios", label: "Estudios / análisis", ico: "🧪" },
    { value: "dentista", label: "Dentista", ico: "🦷" },
    { value: "otro", label: "Otro", ico: "📅" },
  ];

  function typeInfo(v) { return APPT_TYPES.find(t => t.value === v) || APPT_TYPES[5]; }

  function renderChildSelect() {
    const sel = document.getElementById("calendar-child");
    if (!sel) return;
    const children = Storage.listChildren();
    const prev = sel.value;
    sel.innerHTML = `<option value="">— Todos —</option>` +
      children.map(c => `<option value="${c.id}">${esc(c.firstName)} ${esc(c.lastName || "")}</option>`).join("");
    sel.value = prev || "";
  }

  function getEventsForDay(dateStr, childId) {
    const out = [];
    const children = Storage.listChildren().filter(c => !childId || c.id === childId);
    children.forEach(c => {
      // Citas agendadas
      (c.appointments || []).forEach(a => {
        if (a.date === dateStr && !a.done) {
          out.push({ type: "apt", child: c, data: a });
        }
      });
      // Vacunas pendientes cuya edad objetivo cae ese mes/año
      if (c.birthDate && c.country) {
        const info = window.VACCINE_SCHEDULES[c.country];
        if (info) {
          const ageNow = OMS.monthsBetween(c.birthDate, new Date());
          info.schedule.forEach(v => {
            const vId = `${v.name}__${v.dose}`;
            const applied = (c.vaccines || []).some(x => x.vaccineId === vId);
            if (applied) return;
            // Calculamos fecha objetivo del niño
            const target = new Date(c.birthDate);
            target.setMonth(target.getMonth() + v.ageMonths);
            const targetStr = target.toISOString().slice(0, 10);
            if (targetStr === dateStr) {
              out.push({ type: "vacc", child: c, data: v });
            }
          });
          void ageNow;
        }
      }
      // Medicación activa en ese día
      (c.medications || []).forEach(m => {
        if (!m.active) return;
        if (!m.startDate) return;
        const start = m.startDate;
        const end = m.endDate || "9999-12-31";
        if (dateStr >= start && dateStr <= end) {
          out.push({ type: "med", child: c, data: m });
        }
      });
    });
    return out;
  }

  function renderCalendar() {
    const sel = document.getElementById("calendar-child");
    const childId = sel ? sel.value : "";
    const label = document.getElementById("cal-month-label");
    const grid = document.getElementById("cal-grid");
    if (!label || !grid) return;

    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    label.textContent = currentMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

    const firstDay = new Date(y, m, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysPrev = new Date(y, m, 0).getDate();

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().slice(0, 10);

    let html = ["L", "M", "M", "J", "V", "S", "D"].map(d => `<div class="cal-head">${d}</div>`).join("");
    // Días del mes anterior
    for (let i = startWeekday - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><div class="n">${daysPrev - i}</div></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const events = getEventsForDay(dateStr, childId);
      const isToday = dateStr === todayStr;
      html += `<div class="cal-day ${isToday ? "today" : ""}" data-date="${dateStr}">
        <div class="n">${d}</div>
        <div class="events">${events.map(e => `<div class="ev ${e.type}" title="${esc(typeInfo(e.data.type || e.type).label)}"></div>`).join("")}</div>
      </div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".cal-day:not(.other-month)").forEach(el => {
      el.onclick = () => showDayDetail(el.dataset.date, childId);
    });
  }

  function showDayDetail(dateStr, childId) {
    const events = getEventsForDay(dateStr, childId);
    const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    const body = events.length ? events.map(e => {
      if (e.type === "apt") {
        const ti = typeInfo(e.data.type);
        return `<div class="list-item">
          <div class="dot info"></div>
          <div class="grow">
            <div class="title">${ti.ico} ${esc(ti.label)} — ${esc(e.child.firstName)}</div>
            <div class="sub">${esc(e.data.time || "")} ${e.data.notes ? "— " + esc(e.data.notes) : ""}</div>
          </div>
        </div>`;
      } else if (e.type === "vacc") {
        return `<div class="list-item">
          <div class="dot pending"></div>
          <div class="grow">
            <div class="title">💉 ${esc(e.data.name)} — ${esc(e.child.firstName)}</div>
            <div class="sub">${esc(e.data.dose)} · ${OMS.ageLabel(e.data.ageMonths)}</div>
          </div>
        </div>`;
      } else {
        return `<div class="list-item">
          <div class="dot done"></div>
          <div class="grow">
            <div class="title">💊 ${esc(e.data.name)} — ${esc(e.child.firstName)}</div>
            <div class="sub">${esc(e.data.dose || "")} ${e.data.frequency ? "· " + esc(e.data.frequency) : ""}</div>
          </div>
        </div>`;
      }
    }).join("") : `<div class="hint">Sin eventos este día.</div>`;
    App.openModal({
      title: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
      body, footer: [{ label: "Cerrar", class: "btn", action: "close" }],
    });
  }

  function renderUpcomingList() {
    const list = document.getElementById("appt-list");
    const sel = document.getElementById("calendar-child");
    const childId = sel ? sel.value : "";
    const children = Storage.listChildren().filter(c => !childId || c.id === childId);
    const today = new Date().toISOString().slice(0, 10);
    const items = [];
    children.forEach(c => {
      (c.appointments || []).forEach(a => {
        if (a.date >= today && !a.done) {
          items.push({ child: c, a });
        }
      });
    });
    items.sort((x, y) => new Date(x.a.date) - new Date(y.a.date));
    if (!items.length) {
      list.innerHTML = `<div class="hint">Sin citas próximas. Apretá <strong>+ Nueva cita</strong> para agendar.</div>`;
      return;
    }
    list.innerHTML = items.slice(0, 20).map(({ child, a }) => {
      const ti = typeInfo(a.type);
      const dt = new Date(a.date + (a.time ? "T" + a.time : "") + ":00");
      const diffDays = Math.round((new Date(a.date + "T00:00:00") - new Date()) / 86400000);
      const when = a.date === today ? "Hoy" :
        diffDays === 1 ? "Mañana" :
        (diffDays > 1 && diffDays <= 7) ? `En ${diffDays} días` :
        ChildrenModule.formatDate(a.date);
      return `<div class="list-item ${a.done ? "done" : ""}">
        <div class="dot ${a.done ? "done" : "info"}"></div>
        <div class="grow">
          <div class="title">${ti.ico} ${esc(ti.label)} — ${esc(child.firstName)}</div>
          <div class="sub">${when}${a.time ? " · " + esc(a.time) + " hs" : ""} ${a.notes ? "· " + esc(a.notes) : ""}</div>
        </div>
        <button class="btn sm" data-toggle-appt="${child.id}|${a.id}">${a.done ? "Reactivar" : "✓"}</button>
        <button class="btn sm danger" data-del-appt="${child.id}|${a.id}">✕</button>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-toggle-appt]").forEach(btn => {
      btn.onclick = () => {
        const [cid, aid] = btn.dataset.toggleAppt.split("|");
        const c = Storage.getChild(cid); if (!c) return;
        const a = (c.appointments || []).find(x => x.id === aid);
        if (!a) return;
        Storage.updateAppointment(cid, aid, { done: !a.done });
        renderUpcomingList();
      };
    });
    list.querySelectorAll("[data-del-appt]").forEach(btn => {
      btn.onclick = () => {
        if (!confirm("¿Eliminar esta cita?")) return;
        const [cid, aid] = btn.dataset.delAppt.split("|");
        Storage.deleteAppointment(cid, aid);
        renderUpcomingList(); renderCalendar();
        App.toast("Cita eliminada");
      };
    });
  }

  function openForm(existing, defaultDate) {
    const isEdit = !!existing;
    const a = existing || { childId: "", date: defaultDate || new Date().toISOString().slice(0, 10), time: "", type: "control", notes: "", reminder: true };
    const children = Storage.listChildren();
    if (!children.length) { App.toast("Primero agregá un niño"); return; }
    if (!a.childId) a.childId = children[0].id;

    const typesOpts = APPT_TYPES.map(t => `<option value="${t.value}" ${a.type === t.value ? "selected" : ""}>${t.ico} ${esc(t.label)}</option>`).join("");

    App.openModal({
      title: isEdit ? "Editar cita" : "Nueva cita",
      body: `
        <form id="appt-form">
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Niño *</label>
              <select name="childId" required>
                ${children.map(c => `<option value="${c.id}" ${a.childId === c.id ? "selected" : ""}>${esc(c.firstName)} ${esc(c.lastName || "")}</option>`).join("")}
              </select>
            </div>
            <div class="field" style="flex:1">
              <label>Tipo *</label>
              <select name="type" required>${typesOpts}</select>
            </div>
          </div>
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Fecha *</label>
              <input type="date" name="date" required value="${esc(a.date)}" />
            </div>
            <div class="field" style="flex:1">
              <label>Hora</label>
              <input type="time" name="time" value="${esc(a.time || "")}" />
            </div>
          </div>
          <div class="field">
            <label>Notas / Profesional / Centro</label>
            <textarea name="notes" rows="2" placeholder="Ej: Dr. Pérez - Consultorio 3 - Traer libreta">${esc(a.notes || "")}</textarea>
          </div>
          <div class="field">
            <label><input type="checkbox" name="reminder" ${a.reminder ? "checked" : ""} /> Avisarme cuando se acerque la fecha</label>
          </div>
        </form>
      `,
      footer: [
        ...(isEdit ? [{ label: "Eliminar", class: "btn danger", action: () => {
          Storage.deleteAppointment(a.childId, a.id);
          App.closeModal(); App.toast("Cita eliminada");
          renderUpcomingList(); renderCalendar();
        }}] : []),
        { label: "Cancelar", class: "btn", action: "close" },
        { label: isEdit ? "Guardar" : "Crear", class: "btn primary", action: () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("appt-form")));
          if (!fd.date) { App.toast("Indicá la fecha"); return; }
          fd.reminder = !!fd.reminder;
          if (isEdit) Storage.updateAppointment(a.childId, a.id, fd);
          else Storage.addAppointment(fd.childId, fd);
          App.closeModal();
          renderUpcomingList(); renderCalendar();
          App.refreshDashboard();
          App.toast(isEdit ? "Cita actualizada" : "Cita creada");
        }},
      ],
    });
  }

  function bindEvents() {
    document.getElementById("cal-prev").onclick = () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      renderCalendar();
    };
    document.getElementById("cal-next").onclick = () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      renderCalendar();
    };
    document.getElementById("calendar-child").onchange = () => {
      renderCalendar(); renderUpcomingList();
    };
    document.getElementById("btn-new-appt").onclick = () => openForm(null);
  }

  function render() { renderCalendar(); renderUpcomingList(); }

  return { bindEvents, render, renderChildSelect, openForm, typeInfo, APPT_TYPES };
})();