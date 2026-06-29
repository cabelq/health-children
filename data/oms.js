/* Parámetros LMS de la OMS para crecimiento infantil.
   - Peso/edad: 0-120 meses (OMS 2006 + OMS 2007 5-10 años)
   - Talla/edad: 0-228 meses (OMS 2006 + OMS 2007 5-19 años)
   - IMC/edad: 0-228 meses (OMS 2006 + OMS 2007 5-19 años)
   - Perímetro cefálico/edad: 0-60 meses (OMS 2006)
   Fórmula: Z = ((X/M)^L - 1) / (L*S);  Percentil = Φ(Z)
   Estándar OMS < 5 años (Child Growth Standards 2006)
   Referencia OMS 5-19 años (Growth Reference 2007)
*/

window.OMS_DATA = {
  /* ============== PESO / EDAD (0-120 meses) ============== */
  weightForAge: {
    M: [
      { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
      { age: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
      { age: 2, L: 0.197,  M: 5.5675, S: 0.12385 },
      { age: 3, L: 0.1738, M: 6.3762, S: 0.11727 },
      { age: 4, L: 0.1553, M: 7.0023, S: 0.11316 },
      { age: 5, L: 0.1395, M: 7.5105, S: 0.11080 },
      { age: 6, L: 0.1257, M: 7.934,  S: 0.10958 },
      { age: 9, L: 0.0917, M: 8.9014, S: 0.10881 },
      { age: 12, L: 0.0644, M: 9.6479, S: 0.10925 },
      { age: 18, L: 0.0235, M: 10.9389, S: 0.11059 },
      { age: 24, L: -0.0088, M: 12.0405, S: 0.11182 },
      { age: 30, L: -0.0354, M: 13.0537, S: 0.11278 },
      { age: 36, L: -0.0576, M: 13.9937, S: 0.11359 },
      { age: 42, L: -0.0761, M: 14.8808, S: 0.11431 },
      { age: 48, L: -0.0914, M: 15.7258, S: 0.11498 },
      { age: 54, L: -0.1037, M: 16.5347, S: 0.11562 },
      { age: 60, L: -0.1131, M: 17.3116, S: 0.11626 },
      // OMS 2007 Reference 5-10 años (peso/edad)
      { age: 72, L: -0.1280, M: 19.5233, S: 0.11733 },
      { age: 84, L: -0.1379, M: 21.6929, S: 0.11853 },
      { age: 96, L: -0.1435, M: 24.1584, S: 0.11982 },
      { age: 108, L: -0.1445, M: 26.8596, S: 0.12106 },
      { age: 120, L: -0.1411, M: 29.7279, S: 0.12216 },
    ],
    F: [
      { age: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
      { age: 1, L: 0.1714, M: 4.1873, S: 0.13724 },
      { age: 2, L: 0.0962, M: 5.1282, S: 0.13 },
      { age: 3, L: 0.0402, M: 5.8458, S: 0.12619 },
      { age: 4, L: -0.005, M: 6.4237, S: 0.12402 },
      { age: 5, L: -0.043, M: 6.8985, S: 0.12274 },
      { age: 6, L: -0.0756, M: 7.297, S: 0.12204 },
      { age: 9, L: -0.1507, M: 8.2254, S: 0.12199 },
      { age: 12, L: -0.2024, M: 8.9481, S: 0.12268 },
      { age: 18, L: -0.2637, M: 10.0988, S: 0.12297 },
      { age: 24, L: -0.2903, M: 11.0348, S: 0.12152 },
      { age: 30, L: -0.2972, M: 11.8587, S: 0.11881 },
      { age: 36, L: -0.2947, M: 12.6473, S: 0.11581 },
      { age: 42, L: -0.2882, M: 13.4162, S: 0.11282 },
      { age: 48, L: -0.2798, M: 14.1685, S: 0.11005 },
      { age: 54, L: -0.2707, M: 14.9042, S: 0.10761 },
      { age: 60, L: -0.2617, M: 15.6219, S: 0.10553 },
      // OMS 2007 5-10 años
      { age: 72, L: -0.2473, M: 17.9259, S: 0.10719 },
      { age: 84, L: -0.2308, M: 20.2463, S: 0.10927 },
      { age: 96, L: -0.2127, M: 22.8540, S: 0.11151 },
      { age: 108, L: -0.1928, M: 25.6526, S: 0.11376 },
      { age: 120, L: -0.1716, M: 28.7201, S: 0.11599 },
    ],
  },

  /* ============== TALLA / EDAD (0-228 meses) ============== */
  heightForAge: {
    M: [
      { age: 0, L: 1, M: 49.8842, S: 0.03795 },
      { age: 6, L: 1, M: 67.6236, S: 0.03492 },
      { age: 12, L: 1, M: 75.7488, S: 0.03402 },
      { age: 18, L: 1, M: 82.2587, S: 0.03345 },
      { age: 24, L: 1, M: 87.8161, S: 0.03319 },
      { age: 36, L: 1, M: 96.4855, S: 0.03343 },
      { age: 48, L: 1, M: 103.3,   S: 0.03394 },
      { age: 54, L: 1, M: 106.7,   S: 0.0343 },
      { age: 60, L: 1, M: 110.0,   S: 0.03478 },
      { age: 72, L: 1, M: 116.4,   S: 0.03579 },
      { age: 84, L: 1, M: 122.5,   S: 0.03699 },
      { age: 96, L: 1, M: 128.2,   S: 0.03827 },
      { age: 108, L: 1, M: 133.4,  S: 0.03953 },
      { age: 120, L: 1, M: 138.2,  S: 0.04074 },
      { age: 132, L: 1, M: 142.9,  S: 0.04185 },
      { age: 144, L: 1, M: 147.8,  S: 0.04281 },
      { age: 156, L: 1, M: 153.2,  S: 0.04356 },
      { age: 168, L: 1, M: 158.7,  S: 0.04406 },
      { age: 180, L: 1, M: 163.6,  S: 0.04432 },
      { age: 192, L: 1, M: 167.5,  S: 0.04438 },
      { age: 204, L: 1, M: 170.2,  S: 0.04432 },
      { age: 216, L: 1, M: 171.8,  S: 0.04421 },
      { age: 228, L: 1, M: 172.7,  S: 0.04414 },
    ],
    F: [
      { age: 0, L: 1, M: 49.1477, S: 0.0379 },
      { age: 6, L: 1, M: 65.7311, S: 0.03555 },
      { age: 12, L: 1, M: 74.015,  S: 0.03455 },
      { age: 18, L: 1, M: 80.7079, S: 0.03391 },
      { age: 24, L: 1, M: 86.4153, S: 0.03363 },
      { age: 36, L: 1, M: 95.1088, S: 0.03389 },
      { age: 48, L: 1, M: 102.7,   S: 0.0344 },
      { age: 54, L: 1, M: 106.2,   S: 0.03474 },
      { age: 60, L: 1, M: 109.4,   S: 0.03516 },
      { age: 72, L: 1, M: 115.5,   S: 0.03603 },
      { age: 84, L: 1, M: 121.6,   S: 0.03702 },
      { age: 96, L: 1, M: 127.3,   S: 0.03804 },
      { age: 108, L: 1, M: 132.5,  S: 0.03903 },
      { age: 120, L: 1, M: 137.6,  S: 0.03995 },
      { age: 132, L: 1, M: 142.8,  S: 0.04079 },
      { age: 144, L: 1, M: 148.1,  S: 0.04151 },
      { age: 156, L: 1, M: 152.7,  S: 0.04211 },
      { age: 168, L: 1, M: 155.5,  S: 0.04258 },
      { age: 180, L: 1, M: 156.8,  S: 0.04296 },
      { age: 192, L: 1, M: 157.3,  S: 0.04328 },
      { age: 204, L: 1, M: 157.7,  S: 0.04357 },
      { age: 216, L: 1, M: 158.1,  S: 0.04383 },
      { age: 228, L: 1, M: 158.5,  S: 0.04408 },
    ],
  },

  /* ============== IMC / EDAD (0-228 meses) ============== */
  bmiForAge: {
    M: [
      { age: 0, L: -0.3053, M: 13.4069, S: 0.08169 },
      { age: 6, L: -0.3451, M: 16.5776, S: 0.07715 },
      { age: 12, L: -0.3822, M: 16.2604, S: 0.07735 },
      { age: 18, L: -0.4172, M: 15.8869, S: 0.07857 },
      { age: 24, L: -0.4508, M: 15.5894, S: 0.08019 },
      { age: 36, L: -0.5136, M: 15.2503, S: 0.08379 },
      { age: 48, L: -0.5723, M: 15.1572, S: 0.08705 },
      { age: 54, L: -0.6,    M: 15.1626, S: 0.0886 },
      { age: 60, L: -0.6263, M: 15.1902, S: 0.09014 },
      { age: 72, L: -0.6757, M: 15.2934, S: 0.09313 },
      { age: 84, L: -0.7217, M: 15.4711, S: 0.09593 },
      { age: 96, L: -0.7645, M: 15.7187, S: 0.09855 },
      { age: 108, L: -0.8048, M: 16.0216, S: 0.10099 },
      { age: 120, L: -0.8426, M: 16.3628, S: 0.10328 },
      { age: 132, L: -0.8783, M: 16.7317, S: 0.10541 },
      { age: 144, L: -0.9119, M: 17.1245, S: 0.10739 },
      { age: 156, L: -0.9437, M: 17.5392, S: 0.10922 },
      { age: 168, L: -0.9734, M: 17.9628, S: 0.11091 },
      { age: 180, L: -1.0012, M: 18.3669, S: 0.11245 },
      { age: 192, L: -1.027,  M: 18.7535, S: 0.11385 },
      { age: 204, L: -1.0507, M: 19.1141, S: 0.11511 },
      { age: 216, L: -1.0724, M: 19.4453, S: 0.11623 },
      { age: 228, L: -1.0919, M: 19.7448, S: 0.11721 },
    ],
    F: [
      { age: 0, L: -0.0631, M: 13.3363, S: 0.08186 },
      { age: 6, L: -0.1696, M: 16.0728, S: 0.08028 },
      { age: 12, L: -0.2572, M: 15.8576, S: 0.08055 },
      { age: 18, L: -0.3309, M: 15.5297, S: 0.08157 },
      { age: 24, L: -0.3938, M: 15.2527, S: 0.08307 },
      { age: 36, L: -0.4998, M: 14.9012, S: 0.08663 },
      { age: 48, L: -0.5867, M: 14.8117, S: 0.08986 },
      { age: 54, L: -0.6232, M: 14.8135, S: 0.0914 },
      { age: 60, L: -0.656,  M: 14.8351, S: 0.0929 },
      { age: 72, L: -0.7143, M: 14.9385, S: 0.09574 },
      { age: 84, L: -0.7655, M: 15.0932, S: 0.09845 },
      { age: 96, L: -0.8108, M: 15.2974, S: 0.10104 },
      { age: 108, L: -0.851,  M: 15.5537, S: 0.10351 },
      { age: 120, L: -0.8868, M: 15.8597, S: 0.10587 },
      { age: 132, L: -0.9184, M: 16.2067, S: 0.10812 },
      { age: 144, L: -0.9464, M: 16.5836, S: 0.11025 },
      { age: 156, L: -0.9714, M: 16.9768, S: 0.11224 },
      { age: 168, L: -0.9936, M: 17.3745, S: 0.11408 },
      { age: 180, L: -1.0133, M: 17.7643, S: 0.11575 },
      { age: 192, L: -1.0308, M: 18.1341, S: 0.11725 },
      { age: 204, L: -1.0463, M: 18.4765, S: 0.11856 },
      { age: 216, L: -1.0597, M: 18.7868, S: 0.11969 },
      { age: 228, L: -1.0711, M: 19.0632, S: 0.12064 },
    ],
  },

  /* ============== PERÍMETRO CEFÁLICO / EDAD (0-60 meses) ============== */
  // WHO Child Growth Standards 2006 — head circumference-for-age
  headCircumferenceForAge: {
    M: [
      { age: 0, L: 1, M: 34.4618, S: 0.03686 },
      { age: 1, L: 1, M: 37.2759, S: 0.03133 },
      { age: 2, L: 1, M: 39.1285, S: 0.02850 },
      { age: 3, L: 1, M: 40.5135, S: 0.02711 },
      { age: 6, L: 1, M: 43.2354, S: 0.02612 },
      { age: 9, L: 1, M: 44.9788, S: 0.02658 },
      { age: 12, L: 1, M: 46.0997, S: 0.02746 },
      { age: 18, L: 1, M: 47.6477, S: 0.02944 },
      { age: 24, L: 1, M: 48.5645, S: 0.03115 },
      { age: 36, L: 1, M: 49.7317, S: 0.03353 },
      { age: 48, L: 1, M: 50.5807, S: 0.03507 },
      { age: 60, L: 1, M: 51.0997, S: 0.03614 },
    ],
    F: [
      { age: 0, L: 1, M: 33.8787, S: 0.03496 },
      { age: 1, L: 1, M: 36.5463, S: 0.03110 },
      { age: 2, L: 1, M: 38.2521, S: 0.02853 },
      { age: 3, L: 1, M: 39.5328, S: 0.02712 },
      { age: 6, L: 1, M: 42.0655, S: 0.02602 },
      { age: 9, L: 1, M: 43.7031, S: 0.02646 },
      { age: 12, L: 1, M: 44.7624, S: 0.02744 },
      { age: 18, L: 1, M: 46.2711, S: 0.02955 },
      { age: 24, L: 1, M: 47.2418, S: 0.03137 },
      { age: 36, L: 1, M: 48.6229, S: 0.03374 },
      { age: 48, L: 1, M: 49.6256, S: 0.03518 },
      { age: 60, L: 1, M: 50.3509, S: 0.03614 },
    ],
  },
};

// Helpers
window.OMS = {
  zScore(value, L, M, S) {
    if (!M) return 0;
    if (L === 0) return Math.log(value / M) / S;
    return (Math.pow(value / M, L) - 1) / (L * S);
  },
  zToPercentile(z) {
    const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937;
    const a4 = -1.821255978, a5 = 1.330274429;
    const k = 1 / (1 + 0.2316419 * Math.abs(z));
    const w = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-z * z / 2) *
            (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
    const p = z >= 0 ? w : 1 - w;
    return Math.round(p * 1000) / 10;
  },
  getLMS(table, ageMonths) {
    if (!table || !table.length) return { L: 0, M: 0, S: 0, age: ageMonths };
    if (ageMonths <= table[0].age) return table[0];
    if (ageMonths >= table[table.length - 1].age) return table[table.length - 1];
    for (let i = 0; i < table.length - 1; i++) {
      const a = table[i], b = table[i + 1];
      if (ageMonths >= a.age && ageMonths <= b.age) {
        const t = (ageMonths - a.age) / (b.age - a.age);
        return { age: ageMonths, L: a.L + (b.L - a.L) * t, M: a.M + (b.M - a.M) * t, S: a.S + (b.S - a.S) * t };
      }
    }
    return table[table.length - 1];
  },
  weightPercentile(weightKg, ageMonths, sex) {
    const lms = this.getLMS(OMS_DATA.weightForAge[sex], ageMonths);
    return this.zToPercentile(this.zScore(weightKg, lms.L, lms.M, lms.S));
  },
  heightPercentile(heightCm, ageMonths, sex) {
    const lms = this.getLMS(OMS_DATA.heightForAge[sex], ageMonths);
    return this.zToPercentile(this.zScore(heightCm, lms.L, lms.M, lms.S));
  },
  bmiPercentile(bmi, ageMonths, sex) {
    const lms = this.getLMS(OMS_DATA.bmiForAge[sex], ageMonths);
    return this.zToPercentile(this.zScore(bmi, lms.L, lms.M, lms.S));
  },
  headPercentile(headCm, ageMonths, sex) {
    const lms = this.getLMS(OMS_DATA.headCircumferenceForAge[sex], ageMonths);
    return this.zToPercentile(this.zScore(headCm, lms.L, lms.M, lms.S));
  },
  bmiCategory(percentile) {
    if (percentile < 3) return { label: "Bajo peso severo", color: "#dc2626", severity: "high" };
    if (percentile < 15) return { label: "Bajo peso", color: "#f59e0b", severity: "medium" };
    if (percentile < 85) return { label: "Peso normal", color: "#16a34a", severity: "ok" };
    if (percentile < 97) return { label: "Sobrepeso", color: "#f59e0b", severity: "medium" };
    return { label: "Obesidad", color: "#dc2626", severity: "high" };
  },
  heightCategory(percentile) {
    if (percentile < 3) return { label: "Talla baja severa", color: "#dc2626", severity: "high" };
    if (percentile < 10) return { label: "Talla baja", color: "#f59e0b", severity: "medium" };
    if (percentile < 97) return { label: "Talla normal", color: "#16a34a", severity: "ok" };
    return { label: "Talla alta", color: "#06b6d4", severity: "ok" };
  },
  /** Evalúa todas las alertas clínicas para una medición */
  evaluateAlerts(measurement, ageMonths, sex) {
    const alerts = [];
    if (!measurement) return alerts;
    const wP = this.weightPercentile(measurement.weightKg, ageMonths, sex);
    const hP = this.heightPercentile(measurement.heightCm, ageMonths, sex);
    const bmi = measurement.weightKg / Math.pow(measurement.heightCm / 100, 2);
    const bP = this.bmiPercentile(bmi, ageMonths, sex);

    if (wP < 3) alerts.push({ type: "weight", severity: "high", msg: `Peso bajo percentil 3 (P${wP})` });
    if (wP > 97) alerts.push({ type: "weight", severity: "high", msg: `Peso sobre percentil 97 (P${wP})` });
    if (hP < 3) alerts.push({ type: "height", severity: "high", msg: `Talla baja severa (P${hP})` });
    if (bP >= 95) alerts.push({ type: "bmi", severity: "high", msg: `IMC en percentil de obesidad (P${bP})` });
    if (bP < 5) alerts.push({ type: "bmi", severity: "high", msg: `IMC en percentil de bajo peso (P${bP})` });
    if (measurement.headCm && ageMonths <= 60) {
      const headP = this.headPercentile(measurement.headCm, ageMonths, sex);
      if (headP < 3) alerts.push({ type: "head", severity: "high", msg: `Perímetro cefálico bajo P3 (P${headP})` });
      if (headP > 97) alerts.push({ type: "head", severity: "high", msg: `Perímetro cefálico sobre P97 (P${headP})` });
    }
    return alerts;
  },
  monthsBetween(d1, d2) {
    const a = new Date(d1), b = new Date(d2);
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) +
      (b.getDate() >= a.getDate() ? 0 : -1);
  },
  /** Texto legible de edad */
  ageLabel(months) {
    if (months < 0) return "—";
    if (months < 24) return `${months} meses`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m === 0 ? `${y} año${y > 1 ? "s" : ""}` : `${y}a ${m}m`;
  },
  /** Curva percentilada para graficar */
  percentileCurve(table, percentiles, fromMonth, toMonth) {
    const out = [];
    const step = fromMonth <= 24 ? 1 : (fromMonth <= 60 ? 2 : 3);
    for (let age = fromMonth; age <= toMonth; age += step) {
      const lms = this.getLMS(table, age);
      const point = { age };
      percentiles.forEach(p => {
        const z = this.inverseZ(p);
        let value;
        if (lms.L === 0) value = lms.M * Math.exp(z * lms.S);
        else value = lms.M * Math.pow(1 + lms.L * lms.S * z, 1 / lms.L);
        point["p" + p] = value;
      });
      out.push(point);
    }
    return out;
  },
  /** Inversa de Φ (percentil a Z) */
  inverseZ(p) {
    if (p <= 0 || p >= 1) return 0;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pLow = 0.02425, pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5; r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  },
};