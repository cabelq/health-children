/* ============================================================
   Storage v3 — SQLite embebido (sql.js) con persistencia en IndexedDB
   - DB en memoria (rápida), serializada a IndexedDB tras cada cambio
   - API pública idéntica a versiones anteriores
   - Migración automática desde localStorage v2 si existe
   ============================================================ */
const Storage = (function () {
  const IDB_NAME = "saludinfantil_idb";
  const IDB_STORE = "sqlite_blobs";
  const IDB_KEY = "main_db";
  const LEGACY_KEY = "saludinfantil_v2";
  const SQLJS_LOCAL = "vendor/sql-wasm.js";
  const SQLJS_WASM_LOCAL = "vendor/sql-wasm.wasm";
  const SQLJS_CDN = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js";

  let db = null;
  let SQL = null;
  let _ready = null;

  function uid() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pickColor() {
    const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#06b6d4", "#ec4899", "#14b8a6"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  function init() {
    if (_ready) return _ready;
    _ready = (async () => {
      // Cargar sql.js (local primero, CDN como fallback)
      try {
        if (typeof window.initSqlJs !== "function") {
          await loadScript(SQLJS_LOCAL).catch(async () => {
            console.warn("sql.js local no disponible, usando CDN");
            await loadScript(SQLJS_CDN);
          });
        }
        SQL = await window.initSqlJs({
          locateFile: f => f.endsWith(".wasm") ? SQLJS_WASM_LOCAL : SQLJS_LOCAL,
        });
      } catch (e) {
        console.error("Error cargando sql.js:", e);
        throw e;
      }

      // Cargar DB existente o crear nueva
      const buf = await loadFromIDB();
      db = new SQL.Database(buf || undefined);
      createSchema();

      // Si es nueva, migrar desde localStorage v2
      if (!buf) await migrateFromLocalStorage();
    })();
    return _ready;
  }

  /* ---------- IndexedDB persistence ---------- */
  function openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadFromIDB() {
    try {
      const idb = await openIDB();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("IDB load failed:", e);
      return null;
    }
  }

  async function saveToIDB() {
    if (!db) return;
    try {
      const data = db.export();
      const idb = await openIDB();
      await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(data, IDB_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn("IDB save failed:", e);
    }
  }

  function persist() { saveToIDB(); }

  /* ---------- Schema ---------- */
  function createSchema() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        displayName TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'viewer')),
        createdAt TEXT,
        lastLogin TEXT
      );

      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        firstName TEXT,
        lastName TEXT,
        sex TEXT,
        birthDate TEXT,
        country TEXT,
        bloodType TEXT,
        pediatrician TEXT,
        profileColor TEXT,
        allergies TEXT,
        notes TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY,
        childId TEXT NOT NULL,
        date TEXT,
        reason TEXT,
        diagnosis TEXT,
        treatment TEXT,
        notes TEXT,
        FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY,
        childId TEXT NOT NULL,
        date TEXT,
        weightKg REAL,
        heightCm REAL,
        headCm REAL,
        notes TEXT,
        FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS vaccines (
        id TEXT PRIMARY KEY,
        childId TEXT NOT NULL,
        vaccineId TEXT,
        name TEXT,
        dose TEXT,
        country TEXT,
        dateApplied TEXT,
        lot TEXT,
        place TEXT,
        notes TEXT,
        FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        childId TEXT NOT NULL,
        date TEXT,
        time TEXT,
        type TEXT,
        reminder INTEGER,
        notes TEXT,
        done INTEGER,
        FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY,
        childId TEXT NOT NULL,
        name TEXT,
        dose TEXT,
        frequency TEXT,
        startDate TEXT,
        endDate TEXT,
        active INTEGER,
        notes TEXT,
        FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        childId TEXT NOT NULL,
        date TEXT,
        data TEXT,
        caption TEXT,
        FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_visits_child ON visits(childId);
      CREATE INDEX IF NOT EXISTS idx_meas_child ON measurements(childId);
      CREATE INDEX IF NOT EXISTS idx_vacc_child ON vaccines(childId);
      CREATE INDEX IF NOT EXISTS idx_appt_child ON appointments(childId);
      CREATE INDEX IF NOT EXISTS idx_med_child ON medications(childId);
      CREATE INDEX IF NOT EXISTS idx_photos_child ON photos(childId);
    `);
  }

  /* ---------- Migration ---------- */
  async function migrateFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.children || !Array.isArray(data.children)) return;
      console.info("[Storage] Migrando", data.children.length, "niños desde localStorage…");
      for (const c of data.children) insertChildFromLegacy(c);
      if (data.settings) setSettings(data.settings);
      persist();
      console.info("[Storage] Migración completa ✓");
    } catch (e) {
      console.warn("[Storage] Migración falló:", e);
    }
  }

  function insertChildFromLegacy(c) {
    const childId = c.id || uid();
    db.run(
      `INSERT OR REPLACE INTO children
       (id, firstName, lastName, sex, birthDate, country, bloodType, pediatrician, profileColor, allergies, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [childId, c.firstName, c.lastName || "", c.sex, c.birthDate, c.country,
       c.bloodType || "", c.pediatrician || "", c.profileColor || pickColor(),
       c.allergies || "", c.notes || "", c.createdAt || new Date().toISOString()]
    );
    (c.visits || []).forEach(v =>
      db.run(
        `INSERT OR REPLACE INTO visits (id, childId, date, reason, diagnosis, treatment, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [v.id || uid(), childId, v.date, v.reason || "", v.diagnosis || "", v.treatment || "", v.notes || ""]
      )
    );
    (c.measurements || []).forEach(m =>
      db.run(
        `INSERT OR REPLACE INTO measurements (id, childId, date, weightKg, heightCm, headCm, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [m.id || uid(), childId, m.date, m.weightKg, m.heightCm, m.headCm || null, m.notes || ""]
      )
    );
    (c.vaccines || []).forEach(v =>
      db.run(
        `INSERT OR REPLACE INTO vaccines (id, childId, vaccineId, name, dose, country, dateApplied, lot, place, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id || uid(), childId, v.vaccineId || "", v.name, v.dose, v.country,
         v.dateApplied, v.lot || "", v.place || "", v.notes || ""]
      )
    );
    (c.appointments || []).forEach(a =>
      db.run(
        `INSERT OR REPLACE INTO appointments (id, childId, date, time, type, reminder, notes, done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id || uid(), childId, a.date, a.time || "", a.type, a.reminder ? 1 : 0,
         a.notes || "", a.done ? 1 : 0]
      )
    );
    (c.medications || []).forEach(m =>
      db.run(
        `INSERT OR REPLACE INTO medications (id, childId, name, dose, frequency, startDate, endDate, active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id || uid(), childId, m.name, m.dose || "", m.frequency || "",
         m.startDate, m.endDate || "", m.active ? 1 : 0, m.notes || ""]
      )
    );
    (c.photos || []).forEach(p =>
      db.run(
        `INSERT OR REPLACE INTO photos (id, childId, date, data, caption)
         VALUES (?, ?, ?, ?, ?)`,
        [p.id || uid(), childId, p.date, p.data, p.caption || ""]
      )
    );
  }

  /* ---------- Helpers ---------- */
  function exec(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  function run(sql, params = []) {
    db.run(sql, params);
    persist();
  }

  function hydrateChild(row) {
    if (!row) return null;
    const id = row.id;
    const child = {
      id, firstName: row.firstName, lastName: row.lastName, sex: row.sex,
      birthDate: row.birthDate, country: row.country, bloodType: row.bloodType,
      pediatrician: row.pediatrician, profileColor: row.profileColor,
      allergies: row.allergies, notes: row.notes, createdAt: row.createdAt,
      visits: [], measurements: [], vaccines: [], appointments: [],
      medications: [], photos: [],
    };
    child.visits = exec("SELECT * FROM visits WHERE childId=? ORDER BY date DESC", [id]);
    child.measurements = exec("SELECT * FROM measurements WHERE childId=? ORDER BY date ASC", [id]);
    child.vaccines = exec("SELECT * FROM vaccines WHERE childId=? ORDER BY dateApplied ASC", [id]);
    child.appointments = exec("SELECT * FROM appointments WHERE childId=? ORDER BY date ASC", [id]);
    child.medications = exec("SELECT * FROM medications WHERE childId=? ORDER BY startDate DESC", [id]);
    child.photos = exec("SELECT * FROM photos WHERE childId=? ORDER BY date DESC", [id]);
    child.appointments.forEach(a => { a.reminder = !!a.reminder; a.done = !!a.done; });
    child.medications.forEach(m => { m.active = !!m.active; });
    return child;
  }

  /* ---------- API pública ---------- */
  return {
    init,

    listChildren() {
      return exec("SELECT * FROM children ORDER BY createdAt ASC");
    },
    getChild(id) {
      const rows = exec("SELECT * FROM children WHERE id=?", [id]);
      return rows.length ? hydrateChild(rows[0]) : null;
    },
    addChild(payload) {
      const id = uid();
      const child = Object.assign({
        id, createdAt: new Date().toISOString(), profileColor: pickColor(),
      }, payload);
      run(
        `INSERT INTO children (id, firstName, lastName, sex, birthDate, country, bloodType, pediatrician, profileColor, allergies, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [child.id, child.firstName, child.lastName || "", child.sex, child.birthDate,
         child.country, child.bloodType || "", child.pediatrician || "",
         child.profileColor, child.allergies || "", child.notes || "", child.createdAt]
      );
      return child;
    },
    updateChild(id, patch) {
      const current = exec("SELECT * FROM children WHERE id=?", [id])[0];
      if (!current) return null;
      const updated = Object.assign({}, current, patch);
      run(
        `UPDATE children SET firstName=?, lastName=?, sex=?, birthDate=?, country=?, bloodType=?, pediatrician=?, profileColor=?, allergies=?, notes=?
         WHERE id=?`,
        [updated.firstName, updated.lastName || "", updated.sex, updated.birthDate,
         updated.country, updated.bloodType || "", updated.pediatrician || "",
         updated.profileColor || "", updated.allergies || "", updated.notes || "", id]
      );
      return updated;
    },
    deleteChild(id) {
      run("DELETE FROM children WHERE id=?", [id]);
    },

    addVisit(childId, visit) {
      const v = Object.assign({ id: uid(), date: new Date().toISOString().slice(0, 10) }, visit);
      run(
        `INSERT INTO visits (id, childId, date, reason, diagnosis, treatment, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [v.id, childId, v.date, v.reason || "", v.diagnosis || "", v.treatment || "", v.notes || ""]
      );
      return v;
    },
    deleteVisit(childId, visitId) {
      run("DELETE FROM visits WHERE id=? AND childId=?", [visitId, childId]);
    },

    addMeasurement(childId, m) {
      const meas = Object.assign({ id: uid(), date: new Date().toISOString().slice(0, 10) }, m);
      run(
        `INSERT INTO measurements (id, childId, date, weightKg, heightCm, headCm, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [meas.id, childId, meas.date, meas.weightKg, meas.heightCm, meas.headCm || null, meas.notes || ""]
      );
      return meas;
    },
    deleteMeasurement(childId, mid) {
      run("DELETE FROM measurements WHERE id=? AND childId=?", [mid, childId]);
    },

    applyVaccine(childId, payload) {
      const v = Object.assign({ id: uid(), dateApplied: new Date().toISOString().slice(0, 10) }, payload);
      run(
        `INSERT INTO vaccines (id, childId, vaccineId, name, dose, country, dateApplied, lot, place, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, childId, v.vaccineId || "", v.name, v.dose, v.country,
         v.dateApplied, v.lot || "", v.place || "", v.notes || ""]
      );
      return v;
    },
    removeVaccine(childId, vid) {
      run("DELETE FROM vaccines WHERE id=? AND childId=?", [vid, childId]);
    },

    addAppointment(childId, a) {
      const ap = Object.assign({
        id: uid(), date: new Date().toISOString().slice(0, 10), time: "",
        type: "control", reminder: true, notes: "", done: false,
      }, a);
      run(
        `INSERT INTO appointments (id, childId, date, time, type, reminder, notes, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ap.id, childId, ap.date, ap.time || "", ap.type, ap.reminder ? 1 : 0, ap.notes || "", ap.done ? 1 : 0]
      );
      return ap;
    },
    updateAppointment(childId, apId, patch) {
      const current = exec("SELECT * FROM appointments WHERE id=? AND childId=?", [apId, childId])[0];
      if (!current) return null;
      const updated = Object.assign({}, current, patch);
      run(
        `UPDATE appointments SET date=?, time=?, type=?, reminder=?, notes=?, done=? WHERE id=?`,
        [updated.date, updated.time || "", updated.type, updated.reminder ? 1 : 0,
         updated.notes || "", updated.done ? 1 : 0, apId]
      );
      return updated;
    },
    deleteAppointment(childId, apId) {
      run("DELETE FROM appointments WHERE id=? AND childId=?", [apId, childId]);
    },

    addMedication(childId, m) {
      const med = Object.assign({
        id: uid(), name: "", dose: "", frequency: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "", active: true, notes: "",
      }, m);
      run(
        `INSERT INTO medications (id, childId, name, dose, frequency, startDate, endDate, active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [med.id, childId, med.name, med.dose || "", med.frequency || "",
         med.startDate, med.endDate || "", med.active ? 1 : 0, med.notes || ""]
      );
      return med;
    },
    updateMedication(childId, mid, patch) {
      const current = exec("SELECT * FROM medications WHERE id=? AND childId=?", [mid, childId])[0];
      if (!current) return null;
      const updated = Object.assign({}, current, patch);
      run(
        `UPDATE medications SET name=?, dose=?, frequency=?, startDate=?, endDate=?, active=?, notes=? WHERE id=?`,
        [updated.name, updated.dose || "", updated.frequency || "",
         updated.startDate, updated.endDate || "", updated.active ? 1 : 0, updated.notes || "", mid]
      );
      return updated;
    },
    deleteMedication(childId, mid) {
      run("DELETE FROM medications WHERE id=? AND childId=?", [mid, childId]);
    },

    addPhoto(childId, p) {
      const photo = Object.assign({ id: uid(), date: new Date().toISOString().slice(0, 10), caption: "" }, p);
      run(
        `INSERT INTO photos (id, childId, date, data, caption) VALUES (?, ?, ?, ?, ?)`,
        [photo.id, childId, photo.date, photo.data, photo.caption || ""]
      );
      return photo;
    },
    deletePhoto(childId, pid) {
      run("DELETE FROM photos WHERE id=? AND childId=?", [pid, childId]);
    },

    getSettings() {
      const rows = exec("SELECT key, value FROM settings");
      const out = { defaultCountry: "AR", theme: "light", notifications: false, familyName: "" };
      rows.forEach(r => {
        try { out[r.key] = JSON.parse(r.value); }
        catch { out[r.key] = r.value; }
      });
      return out;
    },

    /* ---------- Users ---------- */
    listUsers() {
      return exec("SELECT id, username, displayName, role, createdAt, lastLogin FROM users ORDER BY createdAt ASC");
    },
    getUser(id) {
      const rows = exec("SELECT id, username, displayName, role, createdAt, lastLogin FROM users WHERE id=?", [id]);
      return rows[0] || null;
    },
    getUserByUsername(username) {
      const rows = exec("SELECT * FROM users WHERE username=? COLLATE NOCASE", [username]);
      return rows[0] || null;
    },
    countUsers() {
      return exec("SELECT COUNT(*) as c FROM users")[0].c;
    },
    addUser({ username, displayName, passwordHash, salt, role = "member" }) {
      const id = uid();
      const createdAt = new Date().toISOString();
      run(
        `INSERT INTO users (id, username, displayName, passwordHash, salt, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, username, displayName, passwordHash, salt, role, createdAt]
      );
      return { id, username, displayName, role, createdAt };
    },
    updateUserLastLogin(id) {
      run("UPDATE users SET lastLogin=? WHERE id=?", [new Date().toISOString(), id]);
    },
    updateUserRole(id, role) {
      run("UPDATE users SET role=? WHERE id=?", [role, id]);
    },
    // Actualiza campos arbitrarios del usuario (displayName, role, passwordHash, salt).
    // Protege columnas que no deben tocarse desde acá: id, username, createdAt, lastLogin.
    updateUser(id, patch) {
      const ALLOWED = new Set(["displayName", "role", "passwordHash", "salt"]);
      const keys = Object.keys(patch || {}).filter(k => ALLOWED.has(k));
      if (keys.length === 0) return this.getUser(id);
      const setSql = keys.map(k => `${k}=?`).join(", ");
      const vals = keys.map(k => patch[k]);
      run(`UPDATE users SET ${setSql} WHERE id=?`, [...vals, id]);
      return this.getUser(id);
    },
    deleteUser(id) {
      run("DELETE FROM users WHERE id=?", [id]);
    },
    setSettings(patch) {
      Object.entries(patch).forEach(([k, v]) => {
        run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, JSON.stringify(v)]);
      });
      return this.getSettings();
    },

    exportJSON() {
      const out = {
        version: "v3-sqlite",
        exportedAt: new Date().toISOString(),
        children: this.listChildren().map(c => hydrateChild(c)),
        settings: this.getSettings(),
      };
      return JSON.stringify(out, null, 2);
    },
    importJSON(text) {
      const data = JSON.parse(text);
      this.clearAll();
      (data.children || []).forEach(c => insertChildFromLegacy(c));
      if (data.settings) this.setSettings(data.settings);
      persist();
      return data;
    },
    clearAll() {
      db.exec(`
        DELETE FROM visits; DELETE FROM measurements; DELETE FROM vaccines;
        DELETE FROM appointments; DELETE FROM medications; DELETE FROM photos;
        DELETE FROM alerts; DELETE FROM children; DELETE FROM settings;
        DELETE FROM users;
      `);
      persist();
    },

    uid,
    get ready() { return _ready; },
    _db: () => db,  // Para debug
  };
})();
window.Storage = Storage;