/* Módulo Charts — gráficos de peso/talla/IMC con curvas percentiladas OMS
   Dibuja sobre canvas nativo, sin librerías externas.
*/
window.Charts = (function () {
  // Colores para percentiles
  const P3_COLOR = "#dc2626";
  const P15_COLOR = "#f59e0b";
  const P50_COLOR = "#16a34a";
  const P85_COLOR = "#f59e0b";
  const P97_COLOR = "#dc2626";
  const POINT_COLOR = "#2563eb";

  function clearCanvas(ctx, w, h) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }

  function drawAxes(ctx, w, h, padding, xMin, xMax, yMin, yMax, xLabel, yLabel, xTicks, yTicks) {
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;
    // Grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#6b7280";

    // Y grid + labels
    yTicks.forEach(t => {
      const y = padding.top + plotH - ((t - yMin) / (yMax - yMin)) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(t.toString(), 4, y + 3);
    });

    // X grid + labels
    xTicks.forEach(t => {
      const x = padding.left + ((t - xMin) / (xMax - xMin)) * plotW;
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();
      ctx.fillText(t.toString(), x - 6, h - padding.bottom + 14);
    });

    // Labels
    ctx.fillStyle = "#1f2937";
    ctx.font = "12px sans-serif";
    ctx.save();
    ctx.translate(14, padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
    ctx.fillText(xLabel, w / 2, h - 6);
  }

  function xToPx(age, xMin, xMax, w, pad) {
    return pad.left + ((age - xMin) / (xMax - xMin)) * (w - pad.left - pad.right);
  }
  function yToPx(val, yMin, yMax, h, pad) {
    return pad.top + (1 - (val - yMin) / (yMax - yMin)) * (h - pad.top - pad.bottom);
  }

  function drawCurve(ctx, points, xKey, yKey, color, width, xMin, xMax, yMin, yMax, w, h, pad, dash = []) {
    if (!points || !points.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash.length) ctx.setLineDash(dash); else ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xToPx(p[xKey], xMin, xMax, w, pad);
      const y = yToPx(p[yKey], yMin, yMax, h, pad);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPoints(ctx, points, xKey, yKey, xMin, xMax, yMin, yMax, w, h, pad) {
    if (!points || !points.length) return;
    points.forEach(p => {
      const x = xToPx(p[xKey], xMin, xMax, w, pad);
      const y = yToPx(p[yKey], yMin, yMax, h, pad);
      ctx.fillStyle = POINT_COLOR;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  function makeTicks(min, max, step) {
    const out = [];
    const epsilon = 1e-9;
    for (let v = Math.ceil(min / step) * step; v <= max + epsilon; v += step) {
      out.push(Math.round(v * 1000) / 1000);
    }
    return out;
  }

  function drawTitle(ctx, title, w) {
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 16);
    ctx.textAlign = "start";
  }

  function legend(ctx, x, y, items) {
    ctx.font = "10px sans-serif";
    let dx = x;
    items.forEach(it => {
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(it.dash || []);
      ctx.beginPath();
      ctx.moveTo(dx, y);
      ctx.lineTo(dx + 18, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#374151";
      ctx.fillText(it.label, dx + 22, y + 3);
      dx += 22 + ctx.measureText(it.label).width + 12;
    });
  }

  function drawOne(canvasId, title, opts) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || c.width, h = c.clientHeight || c.height;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    clearCanvas(ctx, w, h);
    const pad = { top: 30, right: 12, bottom: 30, left: 38 };

    drawTitle(ctx, title, w);

    const sex = opts.sex || "M";
    const table = opts.table;
    const yMin = opts.yMin, yMax = opts.yMax;
    const xMin = 0, xMax = Math.max(opts.xMax, 60);
    const yStep = (yMax - yMin) / 5;
    const xStep = xMax <= 24 ? 3 : (xMax <= 60 ? 6 : 12);
    drawAxes(ctx, w, h, pad, xMin, xMax, yMin, yMax,
      "Edad (meses)", opts.yLabel,
      makeTicks(xMin, xMax, xStep),
      makeTicks(yMin, yMax, yStep).map(v => Math.round(v))
    );

    // Curvas percentiladas
    const curves = OMS.percentileCurve(table, [3, 15, 50, 85, 97], 0, xMax);
    drawCurve(ctx, curves, "age", "p3", P3_COLOR, 1.5, xMin, xMax, yMin, yMax, w, h, pad, [4, 4]);
    drawCurve(ctx, curves, "age", "p15", P15_COLOR, 1, xMin, xMax, yMin, yMax, w, h, pad, [2, 4]);
    drawCurve(ctx, curves, "age", "p50", P50_COLOR, 2, xMin, xMax, yMin, yMax, w, h, pad);
    drawCurve(ctx, curves, "age", "p85", P85_COLOR, 1, xMin, xMax, yMin, yMax, w, h, pad, [2, 4]);
    drawCurve(ctx, curves, "age", "p97", P97_COLOR, 1.5, xMin, xMax, yMin, yMax, w, h, pad, [4, 4]);

    // Puntos del niño
    if (opts.measurements && opts.measurements.length) {
      drawPoints(ctx, opts.measurements, "ageMonths", opts.valueKey, xMin, xMax, yMin, yMax, w, h, pad);
    }

    // Leyenda
    legend(ctx, pad.left + 4, pad.top + 8, [
      { label: "P3", color: P3_COLOR, dash: [4, 4] },
      { label: "P15", color: P15_COLOR, dash: [2, 4] },
      { label: "P50", color: P50_COLOR },
      { label: "P85", color: P85_COLOR, dash: [2, 4] },
      { label: "P97", color: P97_COLOR, dash: [4, 4] },
      { label: "Niño/a", color: POINT_COLOR },
    ]);
  }

  function drawAll(data) {
    if (!data) {
      ["chart-weight", "chart-height", "chart-bmi", "chart-head"].forEach(id => {
        const c = document.getElementById(id);
        if (!c) return;
        const w = c.clientWidth || c.width, h = c.clientHeight || c.height;
        const ctx = c.getContext("2d");
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--surface") || "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#9ca3af"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Seleccioná un niño para ver la curva", w / 2, h / 2);
      });
      return;
    }
    const sex = data.sex || "M";
    const ageMonths = data.ageNowMonths || 60;
    const xMax = Math.min(228, Math.max(60, Math.ceil((ageMonths + 6) / 12) * 12));
    const sexLabel = sex === "M" ? "Varón" : "Mujer";

    drawOne("chart-weight", `Peso / Edad — ${sexLabel}`, {
      sex, table: OMS_DATA.weightForAge[sex],
      yLabel: "Peso (kg)", yMin: 0, yMax: 25,
      valueKey: "weightKg", measurements: data.measurements, xMax,
    });
    drawOne("chart-height", `Talla / Edad — ${sexLabel}`, {
      sex, table: OMS_DATA.heightForAge[sex],
      yLabel: "Talla (cm)", yMin: 45, yMax: 180,
      valueKey: "heightCm", measurements: data.measurements, xMax,
    });
    drawOne("chart-bmi", `IMC / Edad — ${sexLabel}`, {
      sex, table: OMS_DATA.bmiForAge[sex],
      yLabel: "IMC", yMin: 12, yMax: 24,
      valueKey: "bmi", measurements: data.measurements.map(m => ({ ...m, bmi: m.weightKg / Math.pow(m.heightCm / 100, 2) })), xMax,
    });

    // Perímetro cefálico solo hasta 5 años
    const headMeas = data.measurements.filter(m => m.ageMonths <= 60 && m.headCm);
    if (headMeas.length) {
      drawOne("chart-head", `Perímetro cefálico / Edad — ${sexLabel}`, {
        sex, table: OMS_DATA.headCircumferenceForAge[sex],
        yLabel: "PC (cm)", yMin: 32, yMax: 55,
        valueKey: "headCm", measurements: headMeas, xMax: 60,
      });
    } else {
      const c = document.getElementById("chart-head");
      if (c) {
        const w = c.clientWidth || c.width, h = c.clientHeight || c.height;
        const ctx = c.getContext("2d");
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--surface") || "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#9ca3af"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Sin mediciones de PC (hasta 5 años)", w / 2, h / 2);
      }
    }
  }

  return { drawAll, drawOne };
})();