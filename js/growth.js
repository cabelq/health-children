/* Módulo Growth — registro de mediciones, gráficos y percentiles OMS */
window.GrowthModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  function renderChildSelect() {
    const sel = document.getElementById("growth-child");
    if (!sel) return;
    const children = Storage.listChildren();
    sel.innerHTML = `<option value="">— Seleccioná un niño —</option>` +
      children.map(c => `<option value="${c.id}">${esc(c.firstName)} ${esc(c.lastName || "")}</option>`).join("");
  }

  function openMeasureForm(child) {
    const last = (child.measurements || []).slice(-1)[0];
    App.openModal({
      title: "Registrar medición",
      body: `
        <form id="meas-form">
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Fecha *</label>
              <input type="date" name="date" required value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div class="field" style="flex:1">
              <label>Edad al medir</label>
              <input type="text" value="${ChildrenModule.ageText(child.birthDate)}" disabled />
            </div>
          </div>
          <div class="row gap">
            <div class="field" style="flex:1">
              <label>Peso (kg) *</label>
              <input type="number" name="weightKg" step="0.01" required value="${last?.weightKg || ""}" />
            </div>
            <div class="field" style="flex:1">
              <label>Talla (cm) *</label>
              <input type="number" name="heightCm" step="0.1" required value="${last?.heightCm || ""}" />
            </div>
            <div class="field" style="flex:1">
              <label>Perímetro cefálico (cm)</label>
              <input type="number" name="headCm" step="0.1" value="${last?.headCm || ""}" />
            </div>
          </div>
          <div class="field">
            <label>Notas</label>
            <textarea name="notes" rows="2" placeholder="Ej: Control sano, comió bien..."></textarea>
          </div>
        </form>
      `,
      footer: [
        { label: "Cancelar", class: "btn", action: "close" },
        { label: "Guardar", class: "btn primary", action: () => {
          const fd = Object.fromEntries(new FormData(document.getElementById("meas-form")));
          if (!fd.weightKg || !fd.heightCm || !fd.date) { App.toast("Faltan datos"); return; }
          Storage.addMeasurement(child.id, {
            date: fd.date,
            weightKg: parseFloat(fd.weightKg),
            heightCm: parseFloat(fd.heightCm),
            headCm: fd.headCm ? parseFloat(fd.headCm) : null,
            notes: fd.notes,
          });
          App.toast("Medición guardada");
          App.closeModal();
          renderFor(child.id);
        }},
      ],
    });
  }

  function renderAlerts(alerts) {
    const cont = document.getElementById("growth-alerts");
    if (!cont) return;
    if (!alerts.length) { cont.innerHTML = ""; return; }
    cont.innerHTML = alerts.map(a =>
      `<div class="alert ${a.severity}">
        <span class="ico">⚠</span>
        <div><strong>${esc(a.msg)}</strong><br>
        <small>Confirmá con tu pediatra en el próximo control.</small></div>
      </div>`).join("");
  }

  function renderFor(childId, searchTerm = "") {
    const c = Storage.getChild(childId);
    const latestEl = document.getElementById("latest-measure");
    const historyEl = document.getElementById("measure-history");
    if (!c) {
      latestEl.innerHTML = `<div class="hint">Seleccioná un niño para ver sus mediciones.</div>`;
      historyEl.innerHTML = "";
      renderAlerts([]);
      Charts.drawAll(null);
      return;
    }
    let meas = (c.measurements || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!meas.length) {
      latestEl.innerHTML = `<div class="hint">Sin mediciones todavía.</div>`;
      historyEl.innerHTML = "";
      renderAlerts([]);
      Charts.drawAll({ measurements: [], sex: c.sex });
      return;
    }

    const last = meas[meas.length - 1];
    const ageMonths = OMS.monthsBetween(c.birthDate, last.date);
    const wP = OMS.weightPercentile(last.weightKg, ageMonths, c.sex);
    const hP = OMS.heightPercentile(last.heightCm, ageMonths, c.sex);
    const bmi = last.weightKg / Math.pow(last.heightCm / 100, 2);
    const bP = OMS.bmiPercentile(bmi, ageMonths, c.sex);
    const bmiCat = OMS.bmiCategory(bP);
    const hCat = OMS.heightCategory(hP);
    const alerts = OMS.evaluateAlerts(last, ageMonths, c.sex);
    renderAlerts(alerts);

    let headInfo = "";
    if (last.headCm && ageMonths <= 60) {
      const headP = OMS.headPercentile(last.headCm, ageMonths, c.sex);
      headInfo = `<div>👶 <strong>Perímetro cefálico:</strong> ${last.headCm} cm → Percentil <strong>${headP}</strong></div>`;
    }

    latestEl.innerHTML = `
      <div style="font-size:.9rem; line-height:1.8">
        <div><strong>Última medición:</strong> ${ChildrenModule.formatDate(last.date)}</div>
        <div><strong>Edad:</strong> ${ageMonths} meses (${OMS.ageLabel(ageMonths)})</div>
        <hr style="margin:10px 0;border:0;border-top:1px solid var(--border)" />
        <div>⚖️ <strong>Peso:</strong> ${last.weightKg} kg → Percentil <strong>${wP}</strong></div>
        <div>📏 <strong>Talla:</strong> ${last.heightCm} cm → Percentil <strong>${hP}</strong>
          <span class="badge" style="background:${hCat.color}22; color:${hCat.color}">${hCat.label}</span>
        </div>
        <div>🧮 <strong>IMC:</strong> ${bmi.toFixed(2)} → Percentil <strong>${bP}</strong>
          <span class="badge" style="background:${bmiCat.color}22; color:${bmiCat.color}">${bmiCat.label}</span>
        </div>
        ${headInfo}
        ${last.notes ? `<div class="hint">📝 ${esc(last.notes)}</div>` : ""}
      </div>
    `;

    let display = meas.slice().reverse();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      display = display.filter(m =>
        (m.notes || "").toLowerCase().includes(q) ||
        (m.date || "").includes(q));
    }
    historyEl.innerHTML = display.length ? display.map(m => {
      const age = OMS.monthsBetween(c.birthDate, m.date);
      const wb = OMS.weightPercentile(m.weightKg, age, c.sex);
      const hb = OMS.heightPercentile(m.heightCm, age, c.sex);
      const bm = m.weightKg / Math.pow(m.heightCm / 100, 2);
      const bmP = OMS.bmiPercentile(bm, age, c.sex);
      return `<div class="list-item">
        <div class="dot done"></div>
        <div class="grow">
          <div class="title">${ChildrenModule.formatDate(m.date)} (${age} meses)</div>
          <div class="sub">⚖️ ${m.weightKg} kg (P${wb}) · 📏 ${m.heightCm} cm (P${hb}) · IMC ${bm.toFixed(1)} (P${bmP})${m.headCm ? " · 👶 " + m.headCm + " cm" : ""}</div>
        </div>
        <button class="btn sm danger" data-del-m="${m.id}">✕</button>
      </div>`;
    }).join("") : `<div class="hint">Sin resultados.</div>`;

    historyEl.querySelectorAll("[data-del-m]").forEach(btn => {
      btn.onclick = () => {
        if (confirm("¿Eliminar esta medición?")) {
          Storage.deleteMeasurement(c.id, btn.dataset.delM);
          renderFor(c.id, searchTerm);
        }
      };
    });

    Charts.drawAll({
      measurements: meas.map(m => ({
        ...m,
        ageMonths: OMS.monthsBetween(c.birthDate, m.date),
      })),
      sex: c.sex,
      ageNowMonths: OMS.monthsBetween(c.birthDate, new Date()),
    });
  }

  function bindEvents() {
    const sel = document.getElementById("growth-child");
    if (sel) sel.onchange = e => renderFor(e.target.value);
    const btn = document.getElementById("btn-new-measure");
    if (btn) btn.onclick = () => {
      const id = document.getElementById("growth-child").value;
      if (!id) { App.toast("Seleccioná un niño primero"); return; }
      openMeasureForm(Storage.getChild(id));
    };
    const search = document.getElementById("search-measure");
    if (search) search.oninput = e => {
      const id = document.getElementById("growth-child").value;
      if (id) renderFor(id, e.target.value);
    };
    const printBtn = document.getElementById("btn-print-chart");
    if (printBtn) printBtn.onclick = () => {
      const id = document.getElementById("growth-child").value;
      if (!id) { App.toast("Seleccioná un niño primero"); return; }
      PrintModule.printChild(Storage.getChild(id));
    };
  }

  return { renderChildSelect, renderFor, bindEvents };
})();