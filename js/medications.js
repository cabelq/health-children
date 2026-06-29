/* Módulo Medications — gestión de medicación activa e histórica */
window.MedicationsModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  function renderChildSelect() {
    const sel = document.getElementById("med-child");
    if (!sel) return;
    const children = Storage.listChildren();
    const prev = sel.value;
    sel.innerHTML = children.map(c => `<option value="${c.id}">${esc(c.firstName)} ${esc(c.lastName || "")}</option>`).join("");
    if (prev && children.find(c => c.id === prev)) sel.value = prev;
  }

  function renderList() {
    const childId = document.getElementById("med-child").value;
    const c = Storage.getChild(childId);
    const cont = document.getElementById("med-list");
    if (!c) { cont.innerHTML = `<div class="hint">Seleccioná un niño.</div>`; return; }
    const meds = c.medications || [];
    const active = meds.filter(m => m.active);
    const past = meds.filter(m => !m.active);

    if (!meds.length) {
      cont.innerHTML = `<div class="card"><div class="hint">Sin medicación registrada. Apretá <strong>+ Agregar medicamento</strong> cuando sea necesario.</div></div>`;
      return;
    }

    const card = (m) => `
      <div class="list-item ${m.active ? "" : "done"}">
        <div class="dot ${m.active ? "info" : "done"}"></div>
        <div class="grow">
          <div class="title">💊 ${esc(m.name)} ${m.dose ? `<small>(${esc(m.dose)})</small>` : ""}</div>
          <div class="sub">
            ${m.frequency ? `🔁 ${esc(m.frequency)} · ` : ""}
            Desde ${ChildrenModule.formatDate(m.startDate)}
            ${m.endDate ? ` hasta ${ChildrenModule.formatDate(m.endDate)}` : ""}
            ${m.notes ? ` · 📝 ${esc(m.notes)}` : ""}
          </div>
        </div>
        <button class="btn sm" data-toggle-med="${m.id}">${m.active ? "✓ Finalizar" : "Reactivar"}</button>
        <button class="btn sm danger" data-del-med="${m.id}">✕</button>
      </div>`;

    cont.innerHTML = `
      <div class="card">
        <h3>Activos (${active.length})</h3>
        <div class="list">${active.length ? active.map(card).join("") : `<div class="hint">Sin medicación activa.</div>`}</div>
      </div>
      <div class="card">
        <h3>Histórico (${past.length})</h3>
        <div class="list">${past.length ? past.map(card).join("") : `<div class="hint">Sin medicación pasada.</div>`}</div>
      </div>
    `;

    cont.querySelectorAll("[data-toggle-med]").forEach(btn => {
      btn.onclick = () => {
        const m = meds.find(x => x.id === btn.dataset.toggleMed); if (!m) return;
        Storage.updateMedication(childId, m.id, { active: !m.active });
        renderList();
      };
    });
    cont.querySelectorAll("[data-del-med]").forEach(btn => {
      btn.onclick = () => {
        if (!confirm("¿Eliminar este registro?")) return;
        Storage.deleteMedication(childId, btn.dataset.delMed);
        renderList();
        App.toast("Eliminado");
      };
    });
  }

  function openForm(existing) {
    const childId = document.getElementById("med-child").value;
    if (!childId) { App.toast("Seleccioná un niño primero"); return; }
    const isEdit = !!existing;
    const m = existing || { name: "", dose: "", frequency: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", notes: "", active: true };
    App.openModal({
      title: isEdit ? "Editar medicación" : "Nueva medicación",
      body: `
        <form id="med-form">
          <div class="field">
            <label>Medicamento *</label>
            <input type="text" name="name" required placeholder="Ej: Amoxicilina 250mg/5ml" value="${esc(m.name)}" />
          </div>
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Dosis</label>
              <input type="text" name="dose" placeholder="Ej: 5ml" value="${esc(m.dose || "")}" />
            </div>
            <div class="field" style="flex:1">
              <label>Frecuencia</label>
              <input type="text" name="frequency" placeholder="Ej: cada 8 horas" value="${esc(m.frequency || "")}" />
            </div>
          </div>
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Desde *</label>
              <input type="date" name="startDate" required value="${esc(m.startDate)}" />
            </div>
            <div class="field" style="flex:1">
              <label>Hasta (opcional)</label>
              <input type="date" name="endDate" value="${esc(m.endDate || "")}" />
            </div>
          </div>
          <div class="field">
            <label>Notas</label>
            <textarea name="notes" rows="2" placeholder="Ej: Tomar con las comidas, agitar antes...">${esc(m.notes || "")}</textarea>
          </div>
          <div class="field">
            <label><input type="checkbox" name="active" ${m.active ? "checked" : ""} /> Medicación activa</label>
          </div>
        </form>
      `,
      footer: [
        { label: "Cancelar", class: "btn", action: "close" },
        { label: isEdit ? "Guardar" : "Crear", class: "btn primary", action: () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("med-form")));
          if (!fd.name) { App.toast("Indicá el nombre"); return; }
          fd.active = !!fd.active;
          if (isEdit) Storage.updateMedication(childId, m.id, fd);
          else Storage.addMedication(childId, fd);
          App.closeModal();
          renderList();
          App.toast(isEdit ? "Medicación actualizada" : "Medicación agregada");
        }},
      ],
    });
  }

  function bindEvents() {
    document.getElementById("med-child").onchange = renderList;
    document.getElementById("btn-new-med").onclick = () => openForm(null);
  }

  return { bindEvents, renderList, renderChildSelect, openForm };
})();