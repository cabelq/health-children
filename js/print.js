/* Módulo Print — vista imprimible de la ficha completa */
window.PrintModule = (function () {
  function printChild(child) {
    if (!child) return;
    document.body.classList.add("print-mode");

    const meas = (child.measurements || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const last = meas[meas.length - 1];
    const visits = child.visits || [];
    const vaccs = child.vaccines || [];
    const appts = (child.appointments || []).filter(a => !a.done).sort((a, b) => new Date(a.date) - new Date(b.date));
    const meds = child.medications || [];

    // Convertir canvas a imágenes para imprimirlas
    const chartImgs = {};
    ["chart-weight", "chart-height", "chart-bmi", "chart-head"].forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas && canvas.toDataURL) {
        try { chartImgs[id] = canvas.toDataURL("image/png"); } catch (e) {}
      }
    });

    const settings = Storage.getSettings();
    const html = `
      <div class="print-only" style="font-family:sans-serif;color:#000;padding:20px;background:#fff">
        <div style="text-align:center;border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:16px">
          <h1 style="margin:0;color:#2563eb">${esc(settings.familyName || "SaludInfantil")}</h1>
          <p style="margin:4px 0;color:#666">Ficha pediátrica · ${new Date().toLocaleDateString("es-AR")}</p>
        </div>

        <h2 style="margin:0 0 8px">${esc(child.firstName)} ${esc(child.lastName || "")}</h2>
        <table style="width:100%;margin-bottom:16px;border-collapse:collapse">
          <tr>
            <td><strong>Nacimiento:</strong> ${esc(ChildrenModule.formatDate(child.birthDate))} (${esc(ChildrenModule.ageText(child.birthDate))})</td>
            <td><strong>Sexo:</strong> ${child.sex === "M" ? "Varón" : "Mujer"}</td>
            <td><strong>Grupo:</strong> ${esc(child.bloodType || "—")}</td>
          </tr>
          <tr>
            <td><strong>País:</strong> ${esc((window.VACCINE_SCHEDULES[child.country] || {}).name || "—")}</td>
            <td colspan="2"><strong>Pediatra:</strong> ${esc(child.pediatrician || "—")}</td>
          </tr>
          ${child.allergies ? `<tr><td colspan="3"><strong>Alergias:</strong> ${esc(child.allergies)}</td></tr>` : ""}
          ${child.notes ? `<tr><td colspan="3"><strong>Notas:</strong> ${esc(child.notes)}</td></tr>` : ""}
        </table>

        ${last ? `<h3>Última medición</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr>
            <td><strong>Fecha:</strong> ${esc(ChildrenModule.formatDate(last.date))}</td>
            <td><strong>Edad:</strong> ${esc(OMS.ageLabel(OMS.monthsBetween(child.birthDate, last.date)))}</td>
          </tr>
          <tr>
            <td><strong>Peso:</strong> ${last.weightKg} kg (P${OMS.weightPercentile(last.weightKg, OMS.monthsBetween(child.birthDate, last.date), child.sex)})</td>
            <td><strong>Talla:</strong> ${last.heightCm} cm (P${OMS.heightPercentile(last.heightCm, OMS.monthsBetween(child.birthDate, last.date), child.sex)})</td>
          </tr>
          ${last.headCm ? `<tr><td colspan="2"><strong>PC:</strong> ${last.headCm} cm</td></tr>` : ""}
        </table>` : ""}

        ${Object.values(chartImgs).length ? `<h3>Curvas de crecimiento (OMS)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          ${chartImgs["chart-weight"] ? `<div><small>Peso/Edad</small><img src="${chartImgs["chart-weight"]}" style="width:100%"/></div>` : ""}
          ${chartImgs["chart-height"] ? `<div><small>Talla/Edad</small><img src="${chartImgs["chart-height"]}" style="width:100%"/></div>` : ""}
          ${chartImgs["chart-bmi"] ? `<div><small>IMC/Edad</small><img src="${chartImgs["chart-bmi"]}" style="width:100%"/></div>` : ""}
          ${chartImgs["chart-head"] ? `<div><small>Perímetro cefálico</small><img src="${chartImgs["chart-head"]}" style="width:100%"/></div>` : ""}
        </div>` : ""}

        <h3>Historial de mediciones (${meas.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:16px">
          <thead style="background:#f3f4f6"><tr><th style="text-align:left;padding:6px">Fecha</th><th>Edad</th><th>Peso</th><th>Talla</th><th>IMC</th><th>PC</th></tr></thead>
          <tbody>${meas.map(m => {
            const a = OMS.monthsBetween(child.birthDate, m.date);
            const b = m.weightKg / Math.pow(m.heightCm / 100, 2);
            return `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px">${ChildrenModule.formatDate(m.date)}</td><td style="text-align:center">${OMS.ageLabel(a)}</td><td style="text-align:center">${m.weightKg} kg</td><td style="text-align:center">${m.heightCm} cm</td><td style="text-align:center">${b.toFixed(1)}</td><td style="text-align:center">${m.headCm || "—"}</td></tr>`;
          }).join("")}</tbody>
        </table>

        <h3>Atenciones registradas (${visits.length})</h3>
        ${visits.length ? `<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:16px">
          <thead style="background:#f3f4f6"><tr><th style="text-align:left;padding:6px">Fecha</th><th style="text-align:left">Motivo</th><th style="text-align:left">Diagnóstico</th><th style="text-align:left">Tratamiento</th></tr></thead>
          <tbody>${visits.map(v => `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px">${ChildrenModule.formatDate(v.date)}</td><td>${esc(v.reason)}</td><td>${esc(v.diagnosis || "")}</td><td>${esc(v.treatment || "")}</td></tr>`).join("")}</tbody>
        </table>` : "<p>—</p>"}

        <h3>Vacunas aplicadas (${vaccs.length})</h3>
        ${vaccs.length ? `<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:16px">
          <thead style="background:#f3f4f6"><tr><th style="text-align:left;padding:6px">Fecha</th><th style="text-align:left">Vacuna</th><th style="text-align:left">Dosis</th><th>Lote</th></tr></thead>
          <tbody>${vaccs.map(v => `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px">${ChildrenModule.formatDate(v.dateApplied)}</td><td>${esc(v.name)}</td><td>${esc(v.dose)}</td><td>${esc(v.lot || "—")}</td></tr>`).join("")}</tbody>
        </table>` : "<p>—</p>"}

        ${appts.length ? `<h3>Próximas citas</h3>
        <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:16px">
          <thead style="background:#f3f4f6"><tr><th style="text-align:left;padding:6px">Fecha</th><th style="text-align:left">Hora</th><th style="text-align:left">Tipo</th><th style="text-align:left">Notas</th></tr></thead>
          <tbody>${appts.map(a => `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px">${ChildrenModule.formatDate(a.date)}</td><td>${esc(a.time || "—")}</td><td>${esc(AppointmentsModule.typeInfo(a.type).label)}</td><td>${esc(a.notes || "")}</td></tr>`).join("")}</tbody>
        </table>` : ""}

        ${meds.length ? `<h3>Medicación</h3>
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead style="background:#f3f4f6"><tr><th style="text-align:left;padding:6px">Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Desde</th><th>Hasta</th><th>Activa</th></tr></thead>
          <tbody>${meds.map(m => `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px">${esc(m.name)}</td><td style="text-align:center">${esc(m.dose || "—")}</td><td style="text-align:center">${esc(m.frequency || "—")}</td><td style="text-align:center">${ChildrenModule.formatDate(m.startDate)}</td><td style="text-align:center">${m.endDate ? ChildrenModule.formatDate(m.endDate) : "—"}</td><td style="text-align:center">${m.active ? "✓" : "—"}</td></tr>`).join("")}</tbody>
        </table>` : ""}

        <p style="margin-top:30px;font-size:.75rem;color:#999;text-align:center">
          Generado por SaludInfantil · Esta ficha es orientativa. Ante cualquier duda, consultá con tu pediatra.
        </p>
      </div>
    `;

    let printDiv = document.getElementById("print-area");
    if (!printDiv) {
      printDiv = document.createElement("div");
      printDiv.id = "print-area";
      document.body.appendChild(printDiv);
    }
    printDiv.innerHTML = html;
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-mode");
    }, 500);
  }

  function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  return { printChild };
})();