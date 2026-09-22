'use strict';

/* ---------------------------------------------------------------- textos */
const T = {
  es: {
    tagline: 'Localización de los algarrobos muestreados por el grupo BIO-359: Genómica Evolutiva de Plantas',
    filters: 'Filtros', all: 'Todos', mode: 'Pines', globe: 'Globo', visits: 'Visitas',
    f_country: 'País / región', f_bank: 'Banco', f_sex: 'Sexo', gmaps: 'Google Maps',
    search_ph: 'Buscar por nombre o código…',
    lg_exact: 'Coordenada exacta (GPS)', lg_approx: 'Ubicación aproximada',
    lg_note: 'Cuando no se conoce la posición exacta, se usa el centroide de la región conocida más precisa.',
    stats: (t, e, a) => `${t} árboles · ${e} con posición exacta · ${a} por región`,
    sex: 'Sexo', bank: 'Banco', origin: 'Origen', country: 'País', growth: 'Tipo',
    exact: 'Exacta (GPS)', approx: 'Aproximada',
    src_exact: 'Fuente', loc_of: 'Zona de origen',
    ficha: 'Ver ficha', empty: 'Ningún árbol con los filtros actuales',
    clima_label: 'Clima (1991–2020)', clima_load: 'Clima…',
    clima_x: 'Clima no disponible', mm_yr: 'mm/año'
  },
  en: {
    tagline: 'Sampling locations of the carob trees by the BIO-359 group: Plant Evolutionary Genomics',
    filters: 'Filters', all: 'All', mode: 'Pins', globe: 'Globe', visits: 'Visits',
    f_country: 'Country / region', f_bank: 'Collection', f_sex: 'Sex', gmaps: 'Google Maps',
    search_ph: 'Search by name or code…',
    lg_exact: 'Exact coordinate (GPS)', lg_approx: 'Approximate location',
    lg_note: 'When the exact position is unknown, the centroid of the most precise known region is used.',
    stats: (t, e, a) => `${t} trees · ${e} with exact position · ${a} by region`,
    sex: 'Sex', bank: 'Collection', origin: 'Origin', country: 'Country', growth: 'Type',
    exact: 'Exact (GPS)', approx: 'Approximate',
    src_exact: 'Source', loc_of: 'Region of origin',
    ficha: 'View data sheet', empty: 'No trees match the current filters',
    clima_label: 'Climate (1991–2020)', clima_load: 'Climate…',
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
  silvestre: ['Silvestre', 'Wild'], cultivado: ['Cultivado', 'Cultivated'],
  'no cultivado actualmente': ['No cultivado actualmente', 'Not currently cultivated'],
  desconocido: ['Desconocido', 'Unknown']
};
const SEX = { macho: ['Macho', 'Male'], hembra: ['Hembra', 'Female'], hermafrodita: ['Hermafrodita', 'Hermaphrodite'] };
const FICHAS_DIR = 'Fichas/';
const HITS_URL = 'https://abacus.jasoncameron.dev/hit/aarongs1999.github.io/algarromapv2';
const PIN_SVG = '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">' +
  '<path class="pin-body" d="M13 1.2C6.8 1.2 1.8 6.2 1.8 12.4c0 7.7 9.6 19.6 10.4 20.6.4.5 1.2.5 1.6 0 .8-1 10.4-12.9 10.4-20.6C24.2 6.2 19.2 1.2 13 1.2z"/>' +
  '<circle class="pin-dot" cx="13" cy="12.4" r="4.3"/></svg>';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tr = (m, k, f) => (m[k] && m[k][lang === 'es' ? 0 : 1]) || f || k;
const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

// el campo Sexo trae valores variados (Feminina, Masculina, Hemafodita…); los reduce a categorías
function sexCats(v) {
  const s = fold(v), out = [];
  if (s.includes('hemb') || s.includes('femin') || s.includes('femen')) out.push('hembra');
  if (s.includes('macho') || s.includes('mascul')) out.push('macho');
  if (s.includes('frodit') || s.includes('afodit')) out.push('hermafrodita');
  return out;
}

/* ---------------------------------------------------------------- estado */
let lang = 'es';
let mode = 'cluster';          // 'cluster' | 'pins'
let projection = 'globe';      // 'mercator' | 'globe'
let query = '';
let allTrees = [], shown = [], byId = {};
let index = null, markers = {}, popupObj = null;
let hitsValue = null, dataReady = false, started = false;
const active = { country: new Set(), bank: new Set(), sex: new Set() };

/* ---------------------------------------------------------------- mapa */
const map = new maplibregl.Map({
  container: 'map',
  attributionControl: false,
  dragRotate: false,
  minZoom: 1.2, maxZoom: 19,
  center: [-3.7, 39.5], zoom: 3.1,        // vista globo inicial centrada en España
  style: {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      sat: { type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
      labels: { type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'] }
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }, { id: 'labels', type: 'raster', source: 'labels' }]
  }
});
map.touchZoomRotate.disableRotation();
// atribución primero (queda abajo del todo) y luego el zoom encima
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.on('load', () => {
  const a = document.querySelector('.maplibregl-ctrl-attrib');
  if (a) { a.classList.remove('maplibregl-compact-show'); a.removeAttribute('open'); }
  if (started) render();   // con el mapa ya pintado, refresca los marcadores
});
map.on('moveend', () => { if (mode === 'cluster') renderClusters(); });
map.on('click', () => { if (popupObj) { popupObj.remove(); popupObj = null; } });

/* ---------------------------------------------------------------- clima (ERA5 1991–2020, bajo demanda) */
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
function fillClima(root) {
  const el = root && root.querySelector('.clima');
  if (!el || el.dataset.done) return;
  getClima(parseFloat(el.dataset.lat), parseFloat(el.dataset.lon)).then(c => {
    el.dataset.done = '1';
    el.innerHTML = `<div class="clima-h">${T[lang].clima_label}</div>` +
      `<div class="clima-v">${c.t.toFixed(1)} °C · ${Math.round(c.p)} ${T[lang].mm_yr}</div>`;
  }).catch(() => { el.innerHTML = `<span class="clima-load">${T[lang].clima_x}</span>`; });
}

/* ---------------------------------------------------------------- geometría de marcadores */
// separa en espiral los puntos que caen en el mismo sitio (mismo centroide o árbol duplicado)
function spread(trees) {
  const groups = {};
  for (const t of trees) {
    const k = t.precision + '@' + t.lat.toFixed(4) + ',' + t.lon.toFixed(4);
    (groups[k] || (groups[k] = [])).push(t);
  }
  const golden = 2.399963229728653;
  for (const g of Object.values(groups)) {
    if (g.length === 1) { g[0]._lat = g[0].lat; g[0]._lon = g[0].lon; continue; }
    const step = g[0].precision === 'exacta' ? 0.00014 : 0.0042;
    g.forEach((t, i) => {
      const r = step * Math.sqrt(i), a = i * golden;
      t._lat = t.lat + r * Math.cos(a);
      t._lon = t.lon + r * Math.sin(a) / Math.cos(t.lat * Math.PI / 180);
    });
  }
}

function dotEl(t) {
  const d = document.createElement('div');
  d.className = 'tree-marker ' + (t.precision === 'exacta' ? 'exact' : 'approx');
  const s = t.precision === 'exacta' ? 16 : 15;
  d.style.width = d.style.height = s + 'px';
  d.innerHTML = '<div class="pin"></div>';
  return d;
}
function pinEl(t) {
  const d = document.createElement('div');
  d.className = 'tree-pin ' + (t.precision === 'exacta' ? 'exact' : 'approx');
  d.innerHTML = PIN_SVG;
  return d;
}
function clusterEl(n) {
  const s = n < 10 ? 34 : n < 100 ? 40 : 46;
  const d = document.createElement('div');
  d.className = 'cl'; d.style.width = d.style.height = s + 'px'; d.textContent = n;
  return d;
}

/* ---------------------------------------------------------------- popup */
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
  const btn = t.ficha
    ? `<button class="ficha-btn" data-ficha="${esc(t.ficha)}" data-cap="${esc((t.name || '') + ' · ' + t.id)}">${L18.ficha}</button>`
    : '';
  const gz = t.precision === 'exacta' ? 18 : 11;
  const gmaps = `<a class="ficha-btn ghost" href="https://www.google.com/maps/place/${t.lat},${t.lon}/@${t.lat},${t.lon},${gz}z/data=!3m1!1e3" target="_blank" rel="noopener">` +
    `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>${L18.gmaps}</a>`;
  return `<div class="pop">
    <h3>${esc(t.name || t.id)}</h3>
    <span class="code">${esc(t.id)}</span>
    <div><span class="badge ${cls}">${cls === 'exact' ? L18.exact : L18.approx}</span></div>
    <dl>${dl}</dl>
    <p class="src">${src}</p>
    <div class="clima" data-lat="${t.lat}" data-lon="${t.lon}"><span class="clima-load">${L18.clima_load}</span></div>
    ${gmaps}${btn}
  </div>`;
}
function openPopup(t, lngLat, offset) {
  if (popupObj) popupObj.remove();
  popupObj = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '300px', offset: offset || 12 })
    .setLngLat(lngLat).setHTML(popup(t)).addTo(map);
  fillClima(popupObj.getElement());
}

/* ---------------------------------------------------------------- render */
function toFeature(t) {
  return { type: 'Feature', properties: { id: t.id, precision: t.precision }, geometry: { type: 'Point', coordinates: [t._lon, t._lat] } };
}
function clearMarkers() {
  for (const k of Object.keys(markers)) { markers[k].remove(); delete markers[k]; }
}
function renderClusters() {
  if (!index) return;
  let bbox;
  if (projection === 'globe') bbox = [-180, -85, 180, 85];
  else { const b = map.getBounds(); bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; }
  const feats = index.getClusters(bbox, Math.floor(map.getZoom()));
  const present = {};
  for (const f of feats) {
    const [lng, lat] = f.geometry.coordinates;
    if (f.properties.cluster) {
      const key = 'c' + f.properties.cluster_id;
      present[key] = 1;
      if (!markers[key]) {
        const el = clusterEl(f.properties.point_count);
        el.onclick = ev => {
          ev.stopPropagation();
          map.easeTo({ center: [lng, lat], zoom: Math.min(index.getClusterExpansionZoom(f.properties.cluster_id), 19) });
        };
        markers[key] = new maplibregl.Marker({ element: el, opacity: '1', opacityWhenCovered: '0' }).setLngLat([lng, lat]).addTo(map);
      }
    } else {
      const t = byId[f.properties.id], key = 'p' + f.properties.id;
      present[key] = 1;
      if (!markers[key]) {
        const el = dotEl(t);
        el.onclick = ev => { ev.stopPropagation(); openPopup(t, [lng, lat], 12); };
        markers[key] = new maplibregl.Marker({ element: el, opacity: '1', opacityWhenCovered: '0' }).setLngLat([lng, lat]).addTo(map);
      }
    }
  }
  for (const k of Object.keys(markers)) if (!present[k]) { markers[k].remove(); delete markers[k]; }
}
function renderPins() {
  clearMarkers();
  for (const t of shown) {
    const el = pinEl(t);
    el.onclick = ev => { ev.stopPropagation(); openPopup(t, [t._lon, t._lat], 32); };
    markers['p' + t.id] = new maplibregl.Marker({ element: el, anchor: 'bottom', opacity: '1', opacityWhenCovered: '0' }).setLngLat([t._lon, t._lat]).addTo(map);
  }
}
function render() {
  shown = allTrees.filter(passes);
  index = new Supercluster({ radius: 46, maxZoom: 14, minPoints: 2 }).load(shown.map(toFeature));
  clearMarkers();
  if (mode === 'cluster') renderClusters(); else renderPins();
  const L18 = T[lang];
  if (allTrees.length) {
    const e = shown.filter(t => t.precision === 'exacta').length;
    document.getElementById('stats').textContent = shown.length ? L18.stats(shown.length, e, shown.length - e) : L18.empty;
  }
}

/* ---------------------------------------------------------------- filtros / idioma / contador */
function passes(t) {
  if (active.country.size && !active.country.has(t.country)) return false;
  if (active.bank.size && !active.bank.has(t.bank)) return false;
  if (active.sex.size && !(t._sex || []).some(c => active.sex.has(c))) return false;
  if (query) {
    const q = fold(query);
    if (!fold(t.name).includes(q) && !fold(t.id).includes(q) && !fold(t.code).includes(q)) return false;
  }
  return true;
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
  const byCountry = {}, byBank = {}, bySex = { macho: 0, hembra: 0, hermafrodita: 0 };
  for (const t of allTrees) {
    if (t.country) byCountry[t.country] = (byCountry[t.country] || 0) + 1;
    if (t.bank) byBank[t.bank] = (byBank[t.bank] || 0) + 1;
    for (const c of (t._sex || [])) bySex[c]++;
  }
  const put = (id, rows) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    rows.forEach(([dim, k, label, n]) => el.appendChild(chip(dim, k, label, n)));
  };
  put('fCountry', Object.keys(byCountry).sort((a, b) => byCountry[b] - byCountry[a]).map(k => ['country', k, tr(COUNTRY, k, k), byCountry[k]]));
  put('fBank', Object.keys(byBank).sort((a, b) => byBank[b] - byBank[a]).map(k => ['bank', k, tr(BANK, k, k), byBank[k]]));
  put('fSex', ['hembra', 'macho', 'hermafrodita'].filter(k => bySex[k]).map(k => ['sex', k, tr(SEX, k, k), bySex[k]]));
}
function applyLang() {
  document.documentElement.lang = lang;
  const L18 = T[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (typeof L18[k] === 'string') el.textContent = L18[k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const k = el.dataset.i18nPh; if (L18[k]) el.placeholder = L18[k]; });
  document.querySelectorAll('#lang button').forEach(x => x.classList.toggle('on', x.dataset.lang === lang));
  if (hitsValue != null) document.getElementById('hitsCount').textContent = hitsValue.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
  if (popupObj) { popupObj.remove(); popupObj = null; }
  buildFilters();
  render();
}
function loadHits() {
  const el = document.getElementById('hits');
  if (!el) return;
  fetch(HITS_URL)
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(d => {
      if (typeof d.value !== 'number') throw new Error('sin valor');
      hitsValue = d.value;
      document.getElementById('hitsCount').textContent = hitsValue.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
      el.hidden = false;
    })
    .catch(() => { el.hidden = true; });
}

/* ---------------------------------------------------------------- fichas */
function openFicha(file, cap) {
  document.getElementById('lbImg').src = FICHAS_DIR + file;
  document.getElementById('lbCap').textContent = cap || '';
  document.getElementById('lightbox').hidden = false;
}
function closeFicha() {
  document.getElementById('lightbox').hidden = true;
  document.getElementById('lbImg').src = '';
}

/* ---------------------------------------------------------------- interacción */
function setMode(next) {
  if (next === mode) return;
  mode = next;
  const b = document.getElementById('toggleMode');
  b.classList.toggle('on', mode === 'pins');
  b.setAttribute('aria-pressed', mode === 'pins');
  render();
}
function setGlobe(on) {
  projection = on ? 'globe' : 'mercator';
  map.setProjection({ type: projection });
  const b = document.getElementById('toggleGlobe');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  if (mode === 'cluster') renderClusters();
}

function wire() {
  document.querySelectorAll('#lang button').forEach(b => b.onclick = () => { lang = b.dataset.lang; applyLang(); });
  document.getElementById('search').addEventListener('input', debounce(e => { query = e.target.value.trim(); render(); }, 120));
  document.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => {
    const dim = b.dataset.clear; active[dim].clear();
    document.querySelectorAll(`#f${dim[0].toUpperCase() + dim.slice(1)} .chip`).forEach(c => c.classList.remove('on'));
    render();
  });

  const ctr = document.getElementById('controls'), tg = document.getElementById('toggleFilters');
  const setPanel = open => { ctr.classList.toggle('open', open); tg.classList.toggle('on', open); tg.setAttribute('aria-expanded', open); };
  setPanel(false);
  tg.onclick = () => setPanel(!ctr.classList.contains('open'));

  document.getElementById('toggleMode').onclick = () => setMode(mode === 'cluster' ? 'pins' : 'cluster');
  const gb = document.getElementById('toggleGlobe');
  gb.classList.toggle('on', projection === 'globe');
  gb.setAttribute('aria-pressed', projection === 'globe');
  gb.onclick = () => setGlobe(projection !== 'globe');

  document.addEventListener('click', e => { const b = e.target.closest('.ficha-btn'); if (b) openFicha(b.dataset.ficha, b.dataset.cap); });
  document.getElementById('lbClose').onclick = closeFicha;
  document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeFicha(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFicha(); });
}

function start() {
  if (started || !dataReady) return;
  started = true;
  applyLang();
}

wire();
loadHits();

fetch('data/arboles.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    allTrees = (d.trees || d).filter(t => typeof t.lat === 'number' && typeof t.lon === 'number');
    byId = {};
    for (const t of allTrees) { byId[t.id] = t; t._sex = sexCats(t.sex); }
    spread(allTrees);
    dataReady = true;
    start();
  })
  .catch(err => {
    document.getElementById('stats').textContent = 'No se pudieron cargar los datos (' + err.message + ').';
    console.error('Error cargando data/arboles.json:', err);
  });
