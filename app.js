'use strict';

const T = {
  es: {
    tagline: 'Localización de los algarrobos muestreados',
    filters: 'Filtros', all: 'Todos',
    f_country: 'País / región', f_bank: 'Banco',
    search_ph: 'Buscar por nombre o código…',
    lg_exact: 'Coordenada exacta (GPS)', lg_approx: 'Ubicación aproximada',
    lg_note: 'Posición indicativa: centroide de la región de origen.',
    stats: (t, e, a) => `${t} árboles · ${e} con GPS exacto · ${a} por región`,
    sex: 'Sexo', bank: 'Banco', origin: 'Origen', country: 'País', growth: 'Tipo',
    exact: 'Exacta (GPS)', approx: 'Aproximada',
    src_exact: 'Fuente', loc_of: 'Zona de origen',
    ficha: 'Ver ficha', empty: 'Ningún árbol con los filtros actuales',
    clima_label: 'Clima · normales 1991–2020', clima_load: 'Clima…',
    clima_x: 'Clima no disponible', mm_yr: 'mm/año'
  },
  en: {
    tagline: 'Sampling locations of the carob trees',
    filters: 'Filters', all: 'All',
    f_country: 'Country / region', f_bank: 'Collection',
    search_ph: 'Search by name or code…',
    lg_exact: 'Exact coordinate (GPS)', lg_approx: 'Approximate location',
    lg_note: 'Indicative position: centroid of the region of origin.',
    stats: (t, e, a) => `${t} trees · ${e} with exact GPS · ${a} by region`,
    sex: 'Sex', bank: 'Collection', origin: 'Origin', country: 'Country', growth: 'Type',
    exact: 'Exact (GPS)', approx: 'Approximate',
    src_exact: 'Source', loc_of: 'Region of origin',
    ficha: 'View data sheet', empty: 'No trees match the current filters',
    clima_label: 'Climate · 1991–2020 normals', clima_load: 'Climate…',
    clima_x: 'Climate unavailable', mm_yr: 'mm/yr'
  }
};

const COUNTRY = {
  ESP: ['España', 'Spain'], PRT: ['Portugal', 'Portugal'], MAR: ['Marruecos', 'Morocco'],
  ITA: ['Italia', 'Italy'], TUN: ['Túnez', 'Tunisia'], DZA: ['Argelia', 'Algeria'],
  ISR: ['Israel', 'Israel'], AUS: ['Australia', 'Australia'], USA: ['EE. UU.', 'USA'],
  HRV: ['Croacia', 'Croatia'], CYP: ['Chipre', 'Cyprus'], TUR: ['Turquía', 'Turkey']
};
const BANK = {
  'Almería': ['Almería', 'Almería'], 'Tarragona': ['Tarragona', 'Tarragona'],
  'Portugal': ['Portugal', 'Portugal'], 'Mallorca': ['Mallorca', 'Mallorca'],
  'CAJAMAR': ['CAJAMAR', 'CAJAMAR'], 'Marruecos': ['Marruecos', 'Morocco']
};
const WILD = {
  'silvestre': ['Silvestre', 'Wild'], 'cultivado': ['Cultivado', 'Cultivated'],
  'no cultivado actualmente': ['No cultivado actualmente', 'Not currently cultivated'],
  'desconocido': ['Desconocido', 'Unknown']
};
const FICHAS_DIR = 'Fichas/';

// normales climáticas 1991-2020 (ERA5 vía Open-Meteo), bajo demanda y cacheadas
const CLIMA = {};
function getClima(lat, lon) {
  const k = lat.toFixed(2) + ',' + lon.toFixed(2);
  if (!CLIMA[k]) {
    const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + lat + '&longitude=' + lon +
      '&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=UTC';
    CLIMA[k] = fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        const dd = d.daily || {};
        const temps = (dd.temperature_2m_mean || []).filter(v => v != null);
        const precs = (dd.precipitation_sum || []).filter(v => v != null);
        const days = (dd.time || []).length;
        if (!temps.length || !precs.length || !days) throw new Error('sin datos');
        return { t: temps.reduce((a, b) => a + b, 0) / temps.length,
                 p: precs.reduce((a, b) => a + b, 0) / (days / 365.25) };
      })
      .catch(e => { delete CLIMA[k]; throw e; });
  }
  return CLIMA[k];
}

let lang = 'es';
let allTrees = [];
const active = { country: new Set(), bank: new Set() };
let query = '';

const map = L.map('map', { zoomControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 19 })
  .setView([36.5, -4.5], 6);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
}).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: ''
}).addTo(map);

const cluster = L.markerClusterGroup({
  showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 46, chunkedLoading: true,
  iconCreateFunction: c => {
    const n = c.getChildCount();
    const s = n < 10 ? 34 : n < 100 ? 40 : 46;
    return L.divIcon({ html: `<div class="cl" style="width:${s}px;height:${s}px">${n}</div>`, className: '', iconSize: [s, s] });
  }
});
map.addLayer(cluster);

map.on('popupopen', e => {
  const root = e.popup.getElement();
  const el = root && root.querySelector('.clima');
  if (!el || el.dataset.done) return;
  const lat = parseFloat(el.dataset.lat), lon = parseFloat(el.dataset.lon);
  getClima(lat, lon).then(c => {
    el.dataset.done = '1';
    el.innerHTML = `<div class="clima-h">${T[lang].clima_label}</div>` +
      `<div class="clima-v">${c.t.toFixed(1)} °C · ${Math.round(c.p)} ${T[lang].mm_yr}</div>`;
  }).catch(() => { el.innerHTML = `<span class="clima-load">${T[lang].clima_x}</span>`; });
});

// separa en espiral los puntos que caen en el mismo sitio
function spread(trees) {
  const groups = {};
  trees.forEach(t => {
    const k = t.precision + '@' + t.lat.toFixed(4) + ',' + t.lon.toFixed(4);
    (groups[k] = groups[k] || []).push(t);
  });
  const golden = 2.399963229728653;
  Object.values(groups).forEach(g => {
    if (g.length === 1) { g[0]._lat = g[0].lat; g[0]._lon = g[0].lon; return; }
    const step = g[0].precision === 'exacta' ? 0.00014 : 0.0042;
    g.forEach((t, i) => {
      const r = step * Math.sqrt(i), a = i * golden;
      t._lat = t.lat + r * Math.cos(a);
      t._lon = t.lon + r * Math.sin(a) / Math.cos(t.lat * Math.PI / 180);
    });
  });
}

function markerFor(t) {
  const cls = t.precision === 'exacta' ? 'exact' : 'approx';
  const size = t.precision === 'exacta' ? 16 : 15;
  const icon = L.divIcon({ className: `tree-marker ${cls}`, html: '<div class="pin"></div>', iconSize: [size, size] });
  const m = L.marker([t._lat, t._lon], { icon, keyboard: false });
  m.bindPopup(() => popup(t), { closeButton: true, minWidth: 220, maxWidth: 300 });
  return m;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tr = (m, k, f) => (m[k] && m[k][lang === 'es' ? 0 : 1]) || f || k;

function regionText(t) {
  const c = tr(COUNTRY, t.country, t.country);
  if (t.bank === 'CAJAMAR' && (!t.province || t.province.includes('?'))) {
    return lang === 'es' ? 'Origen desconocido (conservado en CAJAMAR Las Palmerillas)'
                         : 'Unknown origin (held at CAJAMAR Las Palmerillas)';
  }
  const place = (t.origin && !/^(esp|prt|mar|ita|tun|aus|usa|none)$/i.test(t.origin)) ? t.origin
              : (t.province && !t.province.includes('?') ? t.province : null);
  return place ? `${place}, ${c}` : c;
}

function popup(t) {
  const L18 = T[lang];
  const cls = t.precision === 'exacta' ? 'exact' : 'approx';
  const cName = t.country ? tr(COUNTRY, t.country, t.country) : '';
  const rows = [];
  if (t.sex) rows.push([L18.sex, t.sex]);
  if (t.bank) rows.push([L18.bank, tr(BANK, t.bank, t.bank)]);
  let origin = '';
  if (t.origin && t.origin !== t.country && fold(t.origin) !== fold(cName)) origin = t.origin;
  else if (t.province && !t.province.includes('?') && fold(t.province) !== fold(cName)) origin = t.province;
  if (origin) rows.push([L18.origin, origin]);
  if (t.country) rows.push([L18.country, cName]);
  if (t.wild) rows.push([L18.growth, tr(WILD, t.wild, t.wild)]);
  const dl = rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('');
  const src = t.precision === 'exacta'
    ? `${L18.src_exact}: ${esc(t.coord_source || '')}`
    : `${L18.loc_of}: ${esc(regionText(t))}`;
  let btn = '';
  if (t.ficha) {
    const cap = `${t.name || ''} · ${t.id}`;
    btn = `<button class="ficha-btn" data-ficha="${esc(t.ficha)}" data-cap="${esc(cap)}">${L18.ficha}</button>`;
  }
  return `<div class="pop">
    <h3>${esc(t.name || t.id)}</h3>
    <span class="code">${esc(t.id)}</span>
    <div><span class="badge ${cls}">${cls === 'exact' ? L18.exact : L18.approx}</span></div>
    <dl>${dl}</dl>
    <p class="src">${src}</p>
    <div class="clima" data-lat="${t.lat}" data-lon="${t.lon}"><span class="clima-load">${L18.clima_load}</span></div>
    ${btn}
  </div>`;
}

function passes(t) {
  if (active.country.size && !active.country.has(t.country)) return false;
  if (active.bank.size && !active.bank.has(t.bank)) return false;
  if (query) {
    const q = fold(query);
    if (!fold(t.name).includes(q) && !fold(t.id).includes(q) && !fold(t.code).includes(q)) return false;
  }
  return true;
}

function render() {
  cluster.clearLayers();
  const shown = allTrees.filter(passes);
  cluster.addLayers(shown.map(markerFor));
  const L18 = T[lang], st = document.getElementById('stats');
  if (!allTrees.length) return;
  const e = shown.filter(t => t.precision === 'exacta').length;
  st.textContent = shown.length ? L18.stats(shown.length, e, shown.length - e) : L18.empty;
}

function chip(dim, value, label, count) {
  const b = document.createElement('button');
  b.className = 'chip' + (active[dim].has(value) ? ' on' : '');
  b.innerHTML = `${esc(label)} <span class="count">${count}</span>`;
  b.onclick = () => {
    active[dim].has(value) ? active[dim].delete(value) : active[dim].add(value);
    b.classList.toggle('on');
    render();
  };
  return b;
}

function buildFilters() {
  const byCountry = {}, byBank = {};
  allTrees.forEach(t => {
    if (t.country) byCountry[t.country] = (byCountry[t.country] || 0) + 1;
    if (t.bank) byBank[t.bank] = (byBank[t.bank] || 0) + 1;
  });
  const cEl = document.getElementById('fCountry'), bEl = document.getElementById('fBank');
  cEl.innerHTML = ''; bEl.innerHTML = '';
  Object.keys(byCountry).sort((a, b) => byCountry[b] - byCountry[a]).forEach(k => cEl.appendChild(chip('country', k, tr(COUNTRY, k, k), byCountry[k])));
  Object.keys(byBank).sort((a, b) => byBank[b] - byBank[a]).forEach(k => bEl.appendChild(chip('bank', k, tr(BANK, k, k), byBank[k])));
}

function applyLang() {
  document.documentElement.lang = lang;
  const L18 = T[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (typeof L18[k] === 'string') el.textContent = L18[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.dataset.i18nPh;
    if (L18[k]) el.placeholder = L18[k];
  });
  document.querySelectorAll('#lang button').forEach(x => x.classList.toggle('on', x.dataset.lang === lang));
  buildFilters();
  render();
}

// visor de fichas
function openFicha(file, cap) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lbImg').src = FICHAS_DIR + file;
  document.getElementById('lbCap').textContent = cap || '';
  lb.hidden = false;
}
function closeFicha() { document.getElementById('lightbox').hidden = true; document.getElementById('lbImg').src = ''; }

function wire() {
  document.querySelectorAll('#lang button').forEach(b => b.onclick = () => { lang = b.dataset.lang; applyLang(); });
  document.getElementById('search').addEventListener('input', e => { query = e.target.value.trim(); render(); });
  document.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => {
    const dim = b.dataset.clear; active[dim].clear();
    document.querySelectorAll(`#f${dim[0].toUpperCase() + dim.slice(1)} .chip`).forEach(c => c.classList.remove('on'));
    render();
  });

  const ctr = document.getElementById('controls'), tg = document.getElementById('toggleFilters');
  const setPanel = open => { ctr.classList.toggle('open', open); tg.setAttribute('aria-expanded', open); };
  setPanel(window.innerWidth > 640);
  tg.onclick = () => setPanel(!ctr.classList.contains('open'));

  // fichas
  document.addEventListener('click', e => {
    const b = e.target.closest('.ficha-btn');
    if (b) openFicha(b.dataset.ficha, b.dataset.cap);
  });
  document.getElementById('lbClose').onclick = closeFicha;
  document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeFicha(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFicha(); });
}

function fitCore() {
  const core = allTrees.filter(t => t.lon > -12 && t.lon < 20 && t.lat > 27 && t.lat < 45);
  if (core.length) map.fitBounds(L.latLngBounds(core.map(t => [t._lat, t._lon])).pad(0.08));
}

wire();

fetch('data/arboles.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    allTrees = (d.trees || d).filter(t => typeof t.lat === 'number' && typeof t.lon === 'number');
    spread(allTrees);
    applyLang();
    fitCore();
  })
  .catch(err => {
    document.getElementById('stats').textContent = 'No se pudieron cargar los datos (' + err.message + ').';
    console.error('Error cargando data/arboles.json:', err);
  });
