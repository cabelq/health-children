/* Módulo Children — gestión de fichas, atenciones, fotos y perfil */
window.ChildrenModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  const VISIT_REASONS = [
    "Control de niño sano",
    "Fiebre",
    "Tos / catarro",
    "Diarrea",
    "Vómitos",
    "Erupción / alergia",
    "Otitis (oído)",
    "Faringitis / angina",
    "Broncoespasmo",
    "Control por enfermedad crónica",
    "Traumatismo / golpe",
    "Vacunación",
    "Otro",
  ];

  function ageText(birthDate) {
    if (!birthDate) return "—";
    const m = OMS.monthsBetween(birthDate, new Date());
    return OMS.ageLabel(m);
  }

  function initials(c) {
    return `${(c.firstName || "?")[0]}${(c.lastName || "")[0] || ""}`.toUpperCase();
  }

  function render(search = "") {
    const grid = document.getElementById("children-grid");
    if (!grid) return;
    let children = Storage.listChildren();
    if (search) {
      const q = search.toLowerCase();
      children = children.filter(c =>
        (c.firstName + " " + (c.lastName || "")).toLowerCase().includes(q));
    }
    if (!children.length) {
      grid.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; color:var(--muted)">
        <h3>${search ? "Sin resultados" : "Todavía no hay niños cargados"}</h3>
        <p>${search ? "Probá con otro nombre." : 'Apretá <strong>+ Agregar niño</strong> para empezar.'}</p>
      </div>`;
      return;
    }
    grid.innerHTML = children.map(c => {
      const last = (c.measurements || []).slice(-1)[0];
      let alertsCount = 0;
      if (last && c.birthDate) {
        const ageNow = OMS.monthsBetween(c.birthDate, last.date);
        alertsCount = OMS.evaluateAlerts(last, ageNow, c.sex).filter(a => a.severity === "high").length;
      }
      return `<div class="child-card" data-id="${c.id}" style="border-left-color:${c.profileColor || "var(--primary)"}">
        ${alertsCount ? `<div class="alerts-badge" title="${alertsCount} alerta(s) clínica(s)">⚠ ${alertsCount}</div>` : ""}
        <div class="avatar" style="background:${c.profileColor || "var(--primary)"}">${initials(c)}</div>
        <h3>${esc(c.firstName)} ${esc(c.lastName || "")}</h3>
        <div class="meta">
          <div>🎂 ${formatDate(c.birthDate)} (${ageText(c.birthDate)})</div>
          <div>👤 ${c.sex === "M" ? "Varón" : c.sex === "F" ? "Mujer" : "—"}</div>
          <div>🌎 ${(window.VACCINE_SCHEDULES[c.country] || {}).name || c.country}</div>
          ${c.pediatrician ? `<div>🩺 ${esc(c.pediatrician)}</div>` : ""}
        </div>
        <div class="actions">
          <button class="btn sm" data-action="view" data-id="${c.id}">Ver ficha</button>
          <button class="btn sm" data-action="edit" data-id="${c.id}">Editar</button>
          <button class="btn sm danger" data-action="del" data-id="${c.id}">Eliminar</button>
        </div>
      </div>`;
    }).join("");
  }

  function formatDate(d) {
    if (!d) return "—";
    return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-AR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const c = existing || {
      firstName: "", lastName: "", sex: "M", birthDate: "",
      country: Storage.getSettings().defaultCountry || "AR",
      pediatrician: "", bloodType: "", allergies: "", notes: "",
      profileColor: pickColor(),
    };
    const countries = Object.entries(window.VACCINE_SCHEDULES).map(([code, info]) =>
      `<option value="${code}" ${c.country === code ? "selected" : ""}>${esc(info.name)}</option>`).join("");

    const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#06b6d4", "#ec4899", "#14b8a6"];

    App.openModal({
      title: isEdit ? "Editar niño" : "Nuevo niño",
      body: `
        <form id="child-form">
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Nombre *</label>
              <input type="text" name="firstName" required value="${esc(c.firstName)}" />
            </div>
            <div class="field" style="flex:1">
              <label>Apellido</label>
              <input type="text" name="lastName" value="${esc(c.lastName || "")}" />
            </div>
          </div>
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Sexo *</label>
              <select name="sex" required>
                <option value="M" ${c.sex === "M" ? "selected" : ""}>Varón</option>
                <option value="F" ${c.sex === "F" ? "selected" : ""}>Mujer</option>
              </select>
            </div>
            <div class="field" style="flex:1">
              <label>Fecha de nacimiento *</label>
              <input type="date" name="birthDate" required value="${c.birthDate || ""}" />
            </div>
          </div>
          <div class="field">
            <label>País / esquema de vacunación</label>
            <select name="country">${countries}</select>
          </div>
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Pediatra</label>
              <input type="text" name="pediatrician" value="${esc(c.pediatrician || "")}" />
            </div>
            <div class="field" style="flex:1">
              <label>Grupo sanguíneo</label>
              <input type="text" name="bloodType" value="${esc(c.bloodType || "")}" />
            </div>
          </div>
          <div class="field">
            <label>Alergias</label>
            <input type="text" name="allergies" value="${esc(c.allergies || "")}" />
          </div>
          <div class="field">
            <label>Notas generales</label>
            <textarea name="notes" rows="2">${esc(c.notes || "")}</textarea>
          </div>
          <div class="field">
            <label>Color de perfil</label>
            <div class="row gap" style="gap:6px">
              ${colors.map(col => `<label style="cursor:pointer"><input type="radio" name="profileColor" value="${col}" ${c.profileColor === col ? "checked" : ""} style="margin-right:2px"/> <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${col};vertical-align:middle"></span></label>`).join("")}
            </div>
          </div>
        </form>
      `,
      footer: [
        { label: "Cancelar", class: "btn", action: "close" },
        { label: isEdit ? "Guardar" : "Crear", class: "btn primary", action: () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("child-form")));
          if (!fd.firstName || !fd.birthDate || !fd.sex) { App.toast("Faltan datos obligatorios"); return; }
          if (isEdit) Storage.updateChild(existing.id, fd);
          else Storage.addChild(fd);
          App.closeModal(); render(); App.refreshAll(); App.toast(isEdit ? "Ficha actualizada" : "Niño agregado");
        }},
      ],
    });
  }

  function openDetail(id) {
    const c = Storage.getChild(id);
    if (!c) return;
    const visits = (c.visits || []).map(v => `
      <div class="list-item">
        <div class="dot done"></div>
        <div class="grow">
          <div class="title">${esc(v.reason || "Atención")}</div>
          <div class="sub">${formatDate(v.date)} ${v.diagnosis ? "— " + esc(v.diagnosis) : ""}</div>
          ${v.treatment ? `<div class="sub">Tratamiento: ${esc(v.treatment)}</div>` : ""}
          ${v.notes ? `<div class="sub">📝 ${esc(v.notes)}</div>` : ""}
        </div>
        <button class="btn sm danger" data-del-visit="${v.id}">✕</button>
      </div>`).join("");

    const photos = (c.photos || []).slice(0, 6).map(p => `
      <div class="photo-thumb" data-photo="${p.id}">
        <img src="${esc(p.data)}" alt="${esc(p.caption || "")}" loading="lazy" />
        <button class="del" data-del-photo="${p.id}">✕</button>
      </div>`).join("");

    App.openModal({
      title: `${c.firstName} ${c.lastName || ""}`,
      body: `
        <div style="margin-bottom:12px">
          <div><strong>Edad:</strong> ${ageText(c.birthDate)}</div>
          <div><strong>Sexo:</strong> ${c.sex === "M" ? "Varón" : "Mujer"}</div>
          <div><strong>País:</strong> ${(window.VACCINE_SCHEDULES[c.country] || {}).name || "—"}</div>
          ${c.pediatrician ? `<div><strong>Pediatra:</strong> ${esc(c.pediatrician)}</div>` : ""}
          ${c.bloodType ? `<div><strong>Grupo:</strong> ${esc(c.bloodType)}</div>` : ""}
          ${c.allergies ? `<div><strong>Alergias:</strong> ${esc(c.allergies)}</div>` : ""}
          ${c.notes ? `<div><strong>Notas:</strong> ${esc(c.notes)}</div>` : ""}
        </div>
        <hr style="border:0;border-top:1px solid var(--border);margin:14px 0"/>
        <div class="row gap" style="justify-content:space-between">
          <h3 style="margin:0">Atenciones registradas</h3>
          <button class="btn sm" id="btn-print-this">🖨 Imprimir ficha completa</button>
        </div>
        <div class="list" id="visits-list" style="margin-top:8px">${visits || `<div class="hint">Sin atenciones.</div>`}</div>
        <hr style="border:0;border-top:1px solid var(--border);margin:14px 0"/>
        <h3>Fotos</h3>
        <div class="row gap" style="align-items:flex-start">
          <div class="photo-grid" style="flex:1">${photos || `<div class="hint" style="grid-column:1/-1">Sin fotos. Subí una abajo.</div>`}</div>
        </div>
        <div class="field" style="margin-top:8px">
          <label>📷 Adjuntar foto (se guarda localmente)</label>
          <input type="file" id="photo-input" accept="image/*" />
          <input type="text" id="photo-caption" placeholder="Descripción (opcional)" style="margin-top:6px" />
        </div>
        <hr style="border:0;border-top:1px solid var(--border);margin:14px 0"/>
        <h3>Registrar nueva atención</h3>
        <form id="visit-form">
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Fecha</label>
              <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" />
            </div>
            <div class="field" style="flex:2">
              <label>Motivo *</label>
              <input list="visit-reasons" name="reason" required placeholder="Ej: Control mensual" />
              <datalist id="visit-reasons">
                ${VISIT_REASONS.map(r => `<option value="${esc(r)}">`).join("")}
              </datalist>
            </div>
          </div>
          <div class="field">
            <label>Diagnóstico</label>
            <input type="text" name="diagnosis" placeholder="Ej: Sano / Faringitis..." />
          </div>
          <div class="field">
            <label>Tratamiento / Indicaciones</label>
            <textarea name="treatment" rows="2" placeholder="Medicación, próxima cita, recomendaciones..."></textarea>
          </div>
        </form>
      `,
      footer: [
        { label: "Cerrar", class: "btn", action: "close" },
        { label: "Registrar atención", class: "btn primary", action: () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("visit-form")));
          if (!fd.reason) { App.toast("Indicá el motivo"); return; }
          Storage.addVisit(id, fd);
          App.toast("Atención registrada");
          openDetail(id);
          App.refreshDashboard();
        }},
      ],
      onMount(modal) {
        modal.querySelectorAll("[data-del-visit]").forEach(btn => {
          btn.onclick = () => {
            if (confirm("¿Eliminar esta atención?")) {
              Storage.deleteVisit(id, btn.dataset.delVisit);
              App.toast("Atención eliminada"); openDetail(id); App.refreshDashboard();
            }
          };
        });
        modal.querySelectorAll("[data-photo]").forEach(el => {
          el.onclick = (e) => {
            if (e.target.classList.contains("del")) return;
            App.openLightbox(el.querySelector("img").src);
          };
        });
        modal.querySelectorAll("[data-del-photo]").forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            if (confirm("¿Eliminar esta foto?")) {
              Storage.deletePhoto(id, btn.dataset.delPhoto);
              openDetail(id); App.toast("Foto eliminada");
            }
          };
        });
        const fileInput = modal.querySelector("#photo-input");
        const captionInput = modal.querySelector("#photo-caption");
        if (fileInput) {
          fileInput.onchange = () => {
            const f = fileInput.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
              Storage.addPhoto(id, { data: ev.target.result, caption: captionInput.value });
              App.toast("Foto agregada");
              openDetail(id);
            };
            reader.readAsDataURL(f);
          };
        }
        const btnPrint = modal.querySelector("#btn-print-this");
        if (btnPrint) btnPrint.onclick = () => PrintModule.printChild(c);
      },
    });
  }

  function pickColor() {
    const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#06b6d4", "#ec4899", "#14b8a6"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function bindEvents() {
    const btn = document.getElementById("btn-new-child");
    if (btn) btn.onclick = () => openForm(null);
    const search = document.getElementById("search-child");
    if (search) search.oninput = e => render(e.target.value);
    const grid = document.getElementById("children-grid");
    if (grid) grid.addEventListener("click", e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "edit") openForm(Storage.getChild(id));
      else if (action === "view") openDetail(id);
      else if (action === "del") {
        if (confirm("¿Eliminar este niño y todos sus registros?")) {
          Storage.deleteChild(id);
          App.toast("Eliminado"); render(); App.refreshAll();
        }
      }
    });
  }

  return {
    render, bindEvents, openForm, openDetail, ageText, formatDate, initials, escapeHTML: esc,
    VISIT_REASONS, pickColor,
  };
})();