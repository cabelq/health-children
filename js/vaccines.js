/* Módulo de Vacunas — calendario + seguimiento por niño */
window.VaccinesModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  function ageLabel(months) {
    if (months === 0) return "Al nacer";
    if (months < 12) return `${months} meses`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m === 0 ? `${y} año${y > 1 ? "s" : ""}` : `${y}a ${m}m`;
  }

  function renderCountrySelect() {
    const sel = document.getElementById("country-select");
    sel.innerHTML = Object.entries(window.VACCINE_SCHEDULES)
      .map(([code, info]) => `<option value="${code}">${esc(info.name)} — ${esc(info.calendar)}</option>`).join("");
    sel.value = Storage.getSettings().defaultCountry || "AR";
  }

  function renderChildSelect() {
    const sel = document.getElementById("vaccine-child");
    const children = Storage.listChildren();
    sel.innerHTML = `<option value="">— Seleccioná un niño —</option>` +
      children.map(c => `<option value="${c.id}">${esc(c.firstName)} ${esc(c.lastName || "")}</option>`).join("");
  }

  function statusOf(child, vItem) {
    if (!child.birthDate) return "pending";
    // Id estable: nombre+dosis
    const vId = `${vItem.name}__${vItem.dose}`;
    const applied = (child.vaccines || []).find(v => v.vaccineId === vId);
    if (applied) return "done";
    const ageNow = OMS.monthsBetween(child.birthDate, new Date());
    if (ageNow >= vItem.ageMonths) return "overdue";
    return "pending";
  }

  function renderSchedule() {
    const country = document.getElementById("country-select").value;
    const childId = document.getElementById("vaccine-child").value;
    const container = document.getElementById("vaccine-schedule");
    if (!country) { container.innerHTML = ""; return; }
    const info = window.VACCINE_SCHEDULES[country];
    const child = childId ? Storage.getChild(childId) : null;

    let rows = info.schedule.map(v => {
      const ageNow = child && child.birthDate ? OMS.monthsBetween(child.birthDate, new Date()) : null;
      let badge = "";
      let actions = "";

      if (child) {
        const vId = `${v.name}__${v.dose}`;
        const applied = (child.vaccines || []).find(x => x.vaccineId === vId);
        if (applied) {
          badge = `<span class="badge done">✓ Aplicada ${applied.dateApplied ? "(" + applied.dateApplied + ")" : ""}</span>`;
          actions = `<button class="btn sm danger" data-remove="${applied.id}">Quitar</button>`;
        } else if (ageNow !== null && ageNow >= v.ageMonths) {
          badge = `<span class="badge overdue">⏰ Atrasada</span>`;
          actions = `<button class="btn sm primary" data-apply="${vId}" data-name="${esc(v.name)}" data-dose="${esc(v.dose)}">Aplicar</button>`;
        } else {
          badge = `<span class="badge pending">Pendiente</span>`;
          actions = `<button class="btn sm" data-apply="${vId}" data-name="${esc(v.name)}" data-dose="${esc(v.dose)}">Marcar aplicada</button>`;
        }
      } else {
        badge = v.optional ? `<span class="badge optional">Recomendada</span>` : "";
      }

      return `<div class="vaccine-row">
        <div class="name"><strong>${esc(v.name)}</strong></div>
        <div class="age">${ageLabel(v.ageMonths)} — ${esc(v.dose)}</div>
        <div>${badge}</div>
        <div class="actions">${actions}</div>
        <div></div>
      </div>`;
    }).join("");

    container.innerHTML = `
      <div class="card-head">
        <div>
          <h3>${esc(info.name)}</h3>
          <small>${esc(info.calendar)} · <a href="${info.source}" target="_blank" rel="noopener">Fuente oficial</a></small>
        </div>
      </div>
      <div class="vaccine-row head">
        <div class="name-h">Vacuna</div>
        <div class="age-h">Edad / Dosis</div>
        <div class="dose-h">Estado</div>
        <div>Acción</div>
        <div></div>
      </div>
      ${rows}
      ${child ? "" : `<p class="hint">💡 Seleccioná un niño arriba para registrar qué vacunas ya tiene aplicadas.</p>`}
    `;

    container.querySelectorAll("[data-apply]").forEach(btn => {
      btn.onclick = () => openApplyForm(child, btn.dataset.apply, btn.dataset.name, btn.dataset.dose, country);
    });
    container.querySelectorAll("[data-remove]").forEach(btn => {
      btn.onclick = () => {
        if (confirm("¿Quitar esta vacuna aplicada?")) {
          Storage.removeVaccine(child.id, btn.dataset.remove);
          renderSchedule();
          App.toast("Vacuna quitada");
        }
      };
    });
  }

  function openApplyForm(child, vaccId, name, dose, country) {
    App.openModal({
      title: "Registrar aplicación de vacuna",
      body: `
        <p><strong>${esc(name)}</strong> — ${esc(dose)}</p>
        <p class="hint">Niño: ${esc(child.firstName)} ${esc(child.lastName || "")}</p>
        <form id="vacc-form">
          <div class="field">
            <label>Fecha de aplicación *</label>
            <input type="date" name="dateApplied" required value="${new Date().toISOString().slice(0,10)}" />
          </div>
          <div class="field">
            <label>Lote (opcional)</label>
            <input type="text" name="lot" placeholder="Ej: ABC123" />
          </div>
          <div class="field">
            <label>Centro de salud / Profesional</label>
            <input type="text" name="place" placeholder="Hospital, vacunatorio..." />
          </div>
          <div class="field">
            <label>Notas (reacciones, próxima dosis...)</label>
            <textarea name="notes" rows="2"></textarea>
          </div>
        </form>
      `,
      footer: [
        { label: "Cancelar", class: "btn", action: "close" },
        { label: "Guardar", class: "btn primary", action: () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("vacc-form")));
          if (!fd.dateApplied) { App.toast("Indicá la fecha"); return; }
          Storage.applyVaccine(child.id, {
            vaccineId: vaccId, name, dose, country, ...fd,
          });
          App.toast("Vacuna registrada");
          App.closeModal();
          renderSchedule();
          App.refreshDashboard();
        }},
      ],
    });
  }

  function getUpcomingFor(child, countryCode, limitMonths = 3) {
    const schedule = window.VACCINE_SCHEDULES[countryCode]?.schedule || [];
    if (!child.birthDate) return [];
    const ageNow = OMS.monthsBetween(child.birthDate, new Date());
    return schedule.filter(v => {
      const vId = `${v.name}__${v.dose}`;
      const applied = (child.vaccines || []).some(x => x.vaccineId === vId);
      if (applied) return false;
      return (v.ageMonths - ageNow) <= limitMonths && v.ageMonths >= ageNow - 6;
    }).slice(0, 6);
  }

  function bindEvents() {
    document.getElementById("country-select").onchange = renderSchedule;
    document.getElementById("vaccine-child").onchange = renderSchedule;
  }

  return {
    renderCountrySelect, renderChildSelect, renderSchedule,
    bindEvents, getUpcomingFor,
  };
})();