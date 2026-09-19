'use strict';

const T = {
  es: {
    tagline: 'Localización de los algarrobos muestreados',
    filters: 'Filtros', all: 'Todos',
    f_country: 'País / región', f_bank: 'Banco',
    search_ph: 'Buscar por nombre o código…',
    base_light: 'Claro', base_sat: 'Satélite',
    lg_exact: 'Coordenada exacta (GPS)', lg_approx: 'Ubicación aproximada (región)',
    lg_note: 'Los puntos aproximados se sitúan en su región de origen y se separan para no solaparse; su posición es indicativa.',
    stats: (t, e, a) => `${t} árboles · ${e} con GPS exacto · ${a} por región`,
    sex: 'Sexo', bank: 'Banco', origin: 'Origen', country: 'País',
    growth: 'Tipo', prec: 'Precisión',
    exact: 'Exacta (GPS)', approx: 'Aproximada',
    src_exact: 'Fuente', loc_of: 'Zona de origen',
    none: 'árboles sin coordenada', empty: 'Ningún árbol con los filtros actuales'
  },
  en: {
    tagline: 'Sampling locations of the carob trees',
    filters: 'Filters', all: 'All',
    f_country: 'Country / region', f_bank: 'Collection',
    search_ph: 'Search by name or code…',
    base_light: 'Light', base_sat: 'Satellite',
    lg_exact: 'Exact coordinate (GPS)', lg_approx: 'Approximate location (region)',
    lg_note: 'Approximate points are placed in their region of origin and spread apart to avoid overlap; their position is indicative.',
    stats: (t, e, a) => `${t} trees · ${e} with exact GPS · ${a} by region`,
    sex: 'Sex', bank: 'Collection', origin: 'Origin', country: 'Country',
    growth: 'Type', prec: 'Precision',
    exact: 'Exact (GPS)', approx: 'Approximate',
    src_exact: 'Source', loc_of: 'Region of origin',
    none: 'trees without coordinates', empty: 'No trees match the current filters'
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

let lang = 'es';
let base = 'light';
let allTrees = [];
const active = { country: new Set(), bank: new Set() };
let query = '';

const map = L.map('map', { zoomControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 19 }).setView([36.5, -4.5], 6);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '&copy; OpenStreetMap &copy; CARTO', max: 20, sub: 'abcd'
  },
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagery &copy; Esri, Maxar, Earthstar Geographics', max: 19
  }
};
let tileLayer = null;
const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

function setBase(b) {
  base = b;
  if (tileLayer) map.removeLayer(tileLayer);
  const cfg = TILES[b];
  const url = (b === 'light' && prefersDark()) ? cfg.dark : cfg.url;
  const opts = { attribution: cfg.attr, maxZoom: cfg.max, crossOrigin: true };
  if (cfg.sub) opts.subdomains = cfg.sub;
  tileLayer = L.tileLayer(url, opts).addTo(map);
  document.querySelectorAll('#basemap button').forEach(x => x.classList.toggle('on', x.dataset.base === b));
}

const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 46,
  chunkedLoading: true,
  iconCreateFunction: c => {
    const n = c.getChildCount();
    const s = n < 10 ? 34 : n < 100 ? 40 : 46;
    return L.divIcon({
      html: `<div class="cl" style="width:${s}px;height:${s}px">${n}</div>`,
      className: '', iconSize: [s, s]
    });
  }
});
map.addLayer(cluster);

// separa en espiral los puntos que caen en el mismo sitio (mismo centroide o mismo árbol)
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
      const r = step * Math.sqrt(i);
      const a = i * golden;
      t._lat = t.lat + r * Math.cos(a);
      t._lon = t.lon + r * Math.sin(a) / Math.cos(t.lat * Math.PI / 180);
    });
  });
}

function markerFor(t) {
  const cls = t.precision === 'exacta' ? 'exact' : 'approx';
  const size = t.precision === 'exacta' ? 15 : 14;
  const icon = L.divIcon({
    className: `tree-marker ${cls}`,
    html: '<div class="pin"></div>',
    iconSize: [size, size]
  });
  const m = L.marker([t._lat, t._lon], { icon, keyboard: false });
  m.bindPopup(() => popup(t), { closeButton: true, minWidth: 220, maxWidth: 300 });
  m._tree = t;
  return m;
}

function tr(map3, key, fallback) { return (map3[key] && map3[key][lang === 'es' ? 0 : 1]) || fallback || key; }

function popup(t) {
  const L18 = T[lang];
  const cls = t.precision === 'exacta' ? 'exact' : 'approx';
  const rows = [];
  const cName = t.country ? tr(COUNTRY, t.country, t.country) : '';
  if (t.sex) rows.push([L18.sex, t.sex]);
  if (t.bank) rows.push([L18.bank, tr(BANK, t.bank, t.bank)]);
  let origin = '';
  if (t.origin && t.origin !== t.country && fold(t.origin) !== fold(cName)) origin = t.origin;
  else if (t.province && !t.province.includes('?') && fold(t.province) !== fold(cName)) origin = t.province;
  if (origin) rows.push([L18.origin, origin]);
  if (t.country) rows.push([L18.country, cName]);
  if (t.wild) rows.push([L18.growth, tr(WILD, t.wild, t.wild)]);
  const dl = rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('');
  let src;
  if (t.precision === 'exacta') {
    src = `${L18.src_exact}: ${esc(t.coord_source || '')}`;
  } else {
    const label = regionText(t);
    src = `${L18.loc_of}: ${esc(label)}`;
  }
  return `<div class="pop">
    <h3>${esc(t.name || t.id)}</h3>
    <span class="code">${esc(t.id)}</span>
    <div><span class="badge ${cls}">${cls === 'exact' ? L18.exact : L18.approx}</span></div>
    <dl>${dl}</dl>
    <p class="src">${src}</p>
  </div>`;
}

function regionText(t) {
  // reconstruye la etiqueta en el idioma activo a partir de los campos
  const c = tr(COUNTRY, t.country, t.country);
  if (t.bank === 'CAJAMAR' && (!t.province || t.province.includes('?'))) {
    return lang === 'es' ? 'Origen desconocido (conservado en CAJAMAR Las Palmerillas)'
                         : 'Unknown origin (held at CAJAMAR Las Palmerillas)';
  }
  const place = (t.origin && !/^(esp|prt|mar|ita|tun|aus|usa|none)$/i.test(t.origin)) ? t.origin
              : (t.province && !t.province.includes('?') ? t.province : null);
  return place ? `${place}, ${c}` : c;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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
  const L18 = T[lang];
  const st = document.getElementById('stats');
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
  const cEl = document.getElementById('fCountry');
  const bEl = document.getElementById('fBank');
  cEl.innerHTML = ''; bEl.innerHTML = '';
  Object.keys(byCountry).sort((a, b) => byCountry[b] - byCountry[a])
    .forEach(k => cEl.appendChild(chip('country', k, tr(COUNTRY, k, k), byCountry[k])));
  Object.keys(byBank).sort((a, b) => byBank[b] - byBank[a])
    .forEach(k => bEl.appendChild(chip('bank', k, tr(BANK, k, k), byBank[k])));
}

function applyLang() {
  document.documentElement.lang = lang;
  const L18 = T[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (L18[k] && typeof L18[k] === 'string') el.textContent = L18[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.dataset.i18nPh;
    if (L18[k]) el.placeholder = L18[k];
  });
  document.querySelectorAll('#lang button').forEach(x => x.classList.toggle('on', x.dataset.lang === lang));
  buildFilters();
  render();
}

function wire() {
  document.querySelectorAll('#lang button').forEach(b => b.onclick = () => { lang = b.dataset.lang; applyLang(); });
  document.querySelectorAll('#basemap button').forEach(b => b.onclick = () => setBase(b.dataset.base));
  document.getElementById('search').addEventListener('input', e => { query = e.target.value.trim(); render(); });
  document.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => {
    const dim = b.dataset.clear; active[dim].clear();
    document.querySelectorAll(`#f${dim[0].toUpperCase() + dim.slice(1)} .chip`).forEach(c => c.classList.remove('on'));
    render();
  });
  const tg = document.getElementById('toggleFilters');
  const ctr = document.getElementById('controls');
  tg.onclick = () => { ctr.classList.toggle('open'); tg.classList.toggle('hidden', ctr.classList.contains('open')); };
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (base === 'light') setBase('light'); });
  }
}

function fitCore() {
  // encuadre inicial al Mediterráneo occidental (donde está la gran mayoría)
  const core = allTrees.filter(t => t.lon > -12 && t.lon < 20 && t.lat > 27 && t.lat < 45);
  if (core.length) {
    map.fitBounds(L.latLngBounds(core.map(t => [t._lat, t._lon])).pad(0.08));
  }
}

setBase('light');
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
    document.getElementById('stats').textContent =
      'No se pudieron cargar los datos (' + err.message + '). Sirve la carpeta por HTTP.';
    console.error('Error cargando data/arboles.json:', err);
  });
