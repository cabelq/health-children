/* Módulo News — lee RSS de OMS y sociedad pediátrica local.
   Estrategia robusta con múltiples proxies CORS + cache local.

   Proxies probados (gratuitos, sin API key):
   - api.allorigins.win (estable, devuelve JSON)
   - corsproxy.io (alternativa)
   - rss2json (último recurso, suele fallar por cuota)
*/
window.NewsModule = (function () {
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));

  // Cache: TTL éxito 1h, TTL fallo 5min
  const TTL_OK = 60 * 60 * 1000;
  const TTL_ERR = 5 * 60 * 1000;
  const cache = new Map();

  function renderCountrySelect() {
    const sel = document.getElementById("news-country");
    if (!sel) return;
    sel.innerHTML = Object.entries(window.PEDIATRIC_SOCIETIES)
      .map(([code, info]) => `<option value="${code}">${esc(info.name)}</option>`).join("");
    const def = Storage.getSettings().defaultCountry || "AR";
    sel.value = window.PEDIATRIC_SOCIETIES[def] ? def : "AR";
  }

  /* ---------- Proxies ---------- */
  const PROXIES = [
    {
      name: "allorigins",
      build: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_=${Date.now()}`,
      parse: async (resp) => {
        const data = await resp.json();
        if (!data.contents) throw new Error("Sin contents");
        return parseRSS(data.contents);
      },
    },
    {
      name: "corsproxy",
      build: url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      parse: async (resp) => {
        const text = await resp.text();
        return parseRSS(text);
      },
    },
    {
      name: "rss2json",
      build: url => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=8`,
      parse: async (resp) => {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();
        if (data.status !== "ok") throw new Error(data.message || "Feed no disponible");
        return data.items.map(i => ({
          title: i.title,
          link: i.link,
          date: i.pubDate,
          desc: stripHTML(i.description || i.content || "").slice(0, 240),
        }));
      },
    },
  ];

  function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || div.innerText || "").trim();
  }

  /** Parser RSS/XML mínimo (sin librerías) */
  function parseRSS(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error("XML inválido");
    const items = [...doc.querySelectorAll("item, entry")];
    return items.slice(0, 8).map(it => {
      const title = textOf(it, "title");
      const link = textOf(it, "link") || it.querySelector("link")?.getAttribute("href") || "#";
      const date = textOf(it, "pubDate") || textOf(it, "published") || textOf(it, "updated") || "";
      const descRaw = textOf(it, "description") || textOf(it, "summary") || textOf(it, "content") || "";
      return {
        title: stripHTML(title),
        link,
        date,
        desc: stripHTML(descRaw).slice(0, 240),
      };
    });
  }

  function textOf(el, tag) {
    const node = el.querySelector(tag);
    return node ? (node.textContent || "").trim() : "";
  }

  /** Intenta cada proxy hasta que alguno funcione */
  async function fetchRSS(url) {
    const cached = cache.get(url);
    if (cached && cached.expires > Date.now()) {
      return cached.value;  // puede ser array o null (fallo cacheado)
    }

    let lastError = null;
    for (const proxy of PROXIES) {
      try {
        const resp = await fetch(proxy.build(url), { cache: "no-store" });
        const items = await proxy.parse(resp);
        if (items && items.length) {
          cache.set(url, { value: items, expires: Date.now() + TTL_OK });
          return items;
        }
        lastError = new Error("Feed vacío");
      } catch (e) {
        console.warn(`[News] ${proxy.name} falló:`, e.message);
        lastError = e;
      }
    }

    // Cachear el fallo por 5min para no spamear
    cache.set(url, { value: null, expires: Date.now() + TTL_ERR });
    console.warn("[News] Todos los proxies fallaron:", lastError?.message);
    return null;
  }

  function renderList(elId, items, sourceUrl, sourceLabel) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (items === null) {
      el.innerHTML = `
        <div class="alert medium">
          <span class="ico">📡</span>
          <div>
            <strong>No se pudo cargar el feed</strong><br>
            <small>Los proxies CORS públicos están teniendo problemas. Probá de nuevo en unos minutos, o entrá directo al sitio oficial.</small>
            <div style="margin-top:8px">
              <a href="${esc(sourceUrl)}" target="_blank" rel="noopener" class="btn primary sm">${esc(sourceLabel)} ↗</a>
            </div>
          </div>
        </div>`;
      return;
    }
    if (!items.length) {
      el.innerHTML = `<div class="hint">Sin noticias por ahora.</div>`;
      return;
    }
    el.innerHTML = items.map(n => `
      <div class="news-item">
        <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <div class="date">${formatDate(n.date)}</div>
        <div class="desc">${esc(n.desc)}…</div>
      </div>`).join("");
  }

  function formatDate(d) {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  }

  async function load(force = false) {
    if (force) cache.clear();
    const country = document.getElementById("news-country").value;
    const society = window.PEDIATRIC_SOCIETIES[country] || window.PEDIATRIC_SOCIETIES.AR;
    const whoEl = document.getElementById("news-who");
    const locEl = document.getElementById("news-local");
    if (whoEl) whoEl.innerHTML = `<div class="hint">Cargando OMS…</div>`;
    if (locEl) locEl.innerHTML = `<div class="hint">Cargando ${esc(society.name)}…</div>`;

    try {
      const [whoItems, localItems] = await Promise.all([
        fetchRSS(window.WHO_RSS),
        fetchRSS(society.rss),
      ]);
      renderList("news-who", whoItems, "https://www.who.int/news", "WHO — News");
      renderList("news-local", localItems, society.url, `${society.name} — Sitio oficial`);
    } catch (e) {
      console.error("[News] load error", e);
    }
  }

  function bindEvents() {
    const sel = document.getElementById("news-country");
    if (sel) sel.onchange = () => load(true);
    const btn = document.getElementById("btn-refresh-news");
    if (btn) btn.onclick = () => load(true);
  }

  return { renderCountrySelect, load, bindEvents };
})();