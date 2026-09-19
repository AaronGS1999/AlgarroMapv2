# -*- coding: utf-8 -*-
"""Curado y estandarizacion de coordenadas de las muestras de algarrobo.
Lee el Excel maestro y produce data/arboles.json + data/arboles.csv en WGS84 decimal."""
import openpyxl, re, json, csv, math, unicodedata, io

import os
HERE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(HERE, "..", "Listado muestras ADN (final).xlsx")
OUT = os.path.join(HERE, "..", "data")
wb = openpyxl.load_workbook(XLSX, data_only=True)

corrections = []   # log de correcciones
warnings = []

def norm_code(v):
    if v is None: return None
    s = str(v).strip()
    if not s: return None
    su = s.upper()
    if su.startswith("CS"): s = s[2:].strip()
    try:
        return f"{int(float(s)):03d}"
    except Exception:
        return s

def strip_accents(s):
    if s is None: return ""
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn")

# ---------- parsers de coordenadas ----------
def to_num(tok):
    return float(tok.replace(",", "."))

def parse_decimal_pair(s):
    """'36.93, -1.99' admitiendo coma decimal y basura final. Devuelve (lat, lon)."""
    nums = re.findall(r"[-+]?\d+(?:[.,]\d+)?", s)
    if len(nums) < 2:
        return None
    lat = to_num(nums[0]); lon = to_num(nums[1])
    return lat, lon

def parse_dms_token(tok, default_dir):
    """Convierte un token DMS suelto a grados decimales. Tolerante con simbolos raros."""
    if tok is None: return None
    t = str(tok)
    t = (t.replace("◦", "°").replace("º", "°")
           .replace("′", "'").replace("’", "'").replace("‘", "'")
           .replace("″", '"').replace("”", '"').replace("''", '"').replace("’’", '"'))
    d = default_dir
    m = re.search(r"[NSEWnsew]", t)
    if m:
        d = m.group(0).upper()
    t2 = re.sub(r"(?<=\d)\s+(?=\d)", "", t)          # une "3. 174" -> "3.174"
    t2 = t2.replace(",", ".")
    parts = re.findall(r"\d+(?:\.\d+)?", t2)
    if not parts:
        return None
    deg = float(parts[0]); minu = float(parts[1]) if len(parts) > 1 else 0.0
    sec = float(parts[2]) if len(parts) > 2 else 0.0
    val = deg + minu/60.0 + sec/3600.0
    if d in ("S", "W"):
        val = -val
    return val

def looks_dms(s):
    return ("°" in s) or ("◦" in s) or ("º" in s) or ("'" in s) or ("′" in s) or ("’" in s)

def split_dms_pair(s):
    """Parte una cadena tipo grados-minutos-segundos con N y W en (lat, lon)."""
    m = re.search(r"[NSns]", s)
    if not m:
        return None
    i = m.end()
    lat = parse_dms_token(s[:i], "N")
    lon = parse_dms_token(s[i:], "W")
    if lat is None or lon is None:
        return None
    return lat, lon

# ---------- 1) Banco Almeria: coordenadas de campo ----------
alm = {}
ws = wb["Banco Almería"]
for r in list(ws.iter_rows(values_only=True))[1:]:
    code = norm_code(r[12]); ubic = r[9]
    if not code or ubic is None:
        continue
    s = str(ubic).strip()
    if not s or strip_accents(s).lower() == "almeria":
        continue
    latlon = None
    if looks_dms(s):
        latlon = split_dms_pair(s)
    if latlon is None:
        latlon = parse_decimal_pair(s)
    if latlon is None:
        warnings.append(f"Almeria {code}: no se pudo interpretar '{s}'")
        continue
    lat, lon = latlon
    if lon > 0:
        corrections.append(f"{code} ('{s}'): longitud positiva corregida a negativa")
        lon = -lon
    if not (36.0 <= lat <= 38.0 and -3.6 <= lon <= -1.5):
        warnings.append(f"Almeria {code}: fuera de rango lat={lat:.5f} lon={lon:.5f} ('{s}')")
    alm[code] = (round(lat, 6), round(lon, 6))

# ---------- 2) Marruecos ----------
hasna = {}
ws = wb["Datos Marruecos Hasna"]
for r in list(ws.iter_rows(values_only=True))[1:]:
    if r[2] is None: continue
    try: scode = int(float(str(r[2]).strip()))
    except: continue
    hasna[scode] = dict(cod=norm_code(r[7]), lat_raw=r[3], lon_raw=r[4], site=r[1], area=r[0])

mor = {}
ws = wb["Marruecos_coord_correctas"]
for r in list(ws.iter_rows(values_only=True))[1:]:
    if r[2] is None: continue
    try: scode = int(float(str(r[2]).strip()))
    except: continue
    lat = parse_dms_token(r[5], "N"); lon = parse_dms_token(r[6], "W")
    if lat is None or lon is None:
        warnings.append(f"Marruecos scode {scode}: DMS no interpretable"); continue
    mor[scode] = (round(lat,6), round(lon,6), "Marruecos_coord_correctas")

for scode, h in hasna.items():
    if scode in mor: continue
    lr, lonr = str(h["lat_raw"]), str(h["lon_raw"])
    if "X=" in lr or "Y=" in lr or "X=" in lonr or "Y=" in lonr:
        warnings.append(f"Marruecos scode {scode} ({h['site']}): solo UTM -> se ubicara por region"); continue
    lat = parse_dms_token(lr, "N"); lon = parse_dms_token(lonr, "W")
    if lat is None or lon is None:
        warnings.append(f"Marruecos scode {scode}: respaldo Hasna no interpretable"); continue
    mor[scode] = (round(lat,6), round(lon,6), "Datos Marruecos Hasna (respaldo)")

mor_by_code = {}
for scode, (lat, lon, src) in mor.items():
    cod = hasna.get(scode, {}).get("cod") or f"{scode+515:03d}"
    if not (27.0 <= lat <= 37.0 and -13.5 <= lon <= -1.0):
        warnings.append(f"Marruecos {cod}: fuera de rango lat={lat:.4f} lon={lon:.4f}")
    mor_by_code[cod] = (lat, lon, src)

# ---------- 3) Gaceteer aproximado ----------
LOCALITIES = {
    "tavira (colecao antiga)": (37.127, -7.650), "tavira": (37.127, -7.650),
    "benafim": (37.242, -8.060), "paderne": (37.160, -8.204),
    "matos de cima, paderne": (37.170, -8.190), "querenca": (37.190, -7.995),
    "moncarapacho": (37.093, -7.783), "quelfes": (37.040, -7.833),
    "odeleite": (37.340, -7.462), "corte pequena, odeleite": (37.330, -7.470),
    "mesquita baixa, s b alportel": (37.222, -7.892),
    "varzea vinagre": (37.230, -8.040), "vila nova cacela": (37.163, -7.548),
    "selecao viveirista": (37.20, -8.05),
    "taroudant": (30.471, -8.877), "tarouant": (30.471, -8.877),
    "el ksiba": (32.573, -6.022), "essaouira": (31.513, -9.770),
    "moulay-idris el-methasiyne": (34.054, -5.522), "el menzel-beni asral": (33.836, -4.533),
    "talaint": (29.85, -9.30),
}
PROVINCES = {
    ("esp","tarragona"): (41.06, 1.10), ("esp","mallorca"): (39.62, 2.99),
    ("esp","malaga"): (36.72, -4.42), ("esp","alicante"): (38.35, -0.48),
    ("esp","castellon"): (40.10, -0.10), ("esp","valencia"): (39.47, -0.38),
    ("esp","ibiza"): (38.98, 1.43), ("esp","cadiz"): (36.53, -6.10),
    ("esp","barcelona"): (41.55, 1.95), ("esp","cordoba"): (37.89, -4.78),
    ("esp","sevilla"): (37.39, -5.99), ("esp","murcia"): (37.99, -1.30),
    ("esp","granada"): (37.18, -3.60), ("esp","almeria"): (37.10, -2.35),
    ("prt","algarve"): (37.20, -8.10),
    ("ita","sicilia"): (37.60, 14.02), ("ita","bari"): (41.12, 16.87),
    ("ita","cerdena"): (40.12, 9.01),
    ("aus","west"): (-31.95, 115.86), ("aus","geralpton"): (-28.774, 114.611),
    ("usa","california"): (36.78, -119.42),
    ("cyp","zona europea"): (35.00, 33.20),
    ("tur","sayini"): (39.00, 35.00), ("tur","de kaska"): (36.20, 29.64),
    ("mar","khenis-takot"): (33.30, -6.10), ("mar","essaouira"): (31.513, -9.770),
    ("mar","el ksiba"): (32.573, -6.022), ("mar","el menzel-beni asral"): (33.836, -4.533),
    ("mar","farsi"): (31.80, -7.10), ("mar","talaint"): (29.85, -9.30),
    ("mar","moulay-idris el-methasiyne"): (34.054, -5.522), ("mar","tarouant"): (30.471, -8.877),
    ("tun","ariana"): (36.86, 10.19), ("tun","bargou"): (36.09, 9.57),
    ("tun","sfax"): (34.74, 10.76), ("tun","jhadou"): (34.00, 9.00),
    ("tun","nomag"): (34.00, 9.00),
}
COUNTRIES = {
    "esp": (40.0, -3.7), "prt": (39.5, -8.0), "mar": (31.8, -7.09),
    "ita": (41.9, 12.5), "tun": (34.0, 9.5), "dza": (36.20, 3.60),
    "isr": (31.5, 34.9), "aus": (-31.95, 115.86), "usa": (37.5, -120.0),
    "hrv": (45.1, 15.2), "cyp": (35.0, 33.2), "tur": (39.0, 35.0),
}
CAJAMAR_PALMERILLAS = (36.796, -2.720)

def resolve_region(pais, prov, origen, banco):
    pl = strip_accents(pais).lower().strip() if pais else ""
    pv = strip_accents(prov).lower().strip() if prov else ""
    og = strip_accents(origen).lower().strip() if origen else ""
    unknown_pv = (pv in ("", "none")) or ("?" in pv)
    unknown_og = (og in ("", "none")) or ("?" in og)
    if unknown_pv and unknown_og and banco == "CAJAMAR":
        return CAJAMAR_PALMERILLAS, "Origen desconocido — conservado en CAJAMAR Las Palmerillas", "baja"
    if og in LOCALITIES:
        return LOCALITIES[og], f"Localidad: {origen}", "media"
    if (pl, pv) in PROVINCES:
        extra = f" ({origen})" if (og and og not in (pl, "none", "esp")) else ""
        return PROVINCES[(pl, pv)], f"Región: {prov}{extra}", "media"
    if pl in COUNTRIES:
        return COUNTRIES[pl], f"País: {pais}", "baja"
    return None, None, None

# ---------- 4) Ensamblar ----------
ws = wb["Listado común "]
rows = list(ws.iter_rows(values_only=True))

def clean(v):
    if v is None: return None
    s = str(v).strip()
    return s if s else None

def norm_wild(v):
    s = strip_accents(v).lower() if v else ""
    if not s: return "desconocido"
    if s.startswith("w") or "silvestre" in s: return "silvestre"
    if s.startswith("c") or "cultiv" in s: return "cultivado"
    if "actualmente no" in s: return "no cultivado actualmente"
    return "desconocido"

trees = []; seen = set()
for r in rows[1:]:
    code = norm_code(r[0])
    if not code or code in seen: continue
    seen.add(code)
    nombre = clean(r[2]); sexo = clean(r[3]); banco = clean(r[4])
    origen = clean(r[5]); prov = clean(r[6]); wild = clean(r[7]); pais = clean(r[8])
    lat = lon = None; precision = None; source = None; region = None; conf = None
    if code in alm:
        lat, lon = alm[code]; precision = "exacta"; source = "Banco Almería (GPS de campo)"
    elif code in mor_by_code:
        lat, lon, source = mor_by_code[code]; precision = "exacta"
    if lat is None:
        coords, region, conf = resolve_region(pais, prov, origen, banco)
        if coords:
            lat, lon = coords; precision = "aproximada"
            source = "Ubicación representativa de la región de origen"
    trees.append(dict(id="Cs"+code, code=code, name=nombre, sex=sexo,
               bank=banco, origin=origen, province=prov, country=pais,
               wild=norm_wild(wild), wild_raw=wild,
               lat=lat, lon=lon, precision=precision,
               coord_source=source, region_label=region, confidence=conf))


# ---- salida ----
import datetime
def keyf(t):
    try: return (0, int(t["code"]))
    except: return (1, t["code"])
trees.sort(key=keyf)
os.makedirs(OUT, exist_ok=True)
meta = dict(generated=datetime.date.today().isoformat(),
            source="Listado muestras ADN (final).xlsx",
            crs="WGS84 (EPSG:4326), grados decimales",
            count=len(trees),
            count_exact=sum(1 for t in trees if t["precision"]=="exacta"),
            count_approx=sum(1 for t in trees if t["precision"]=="aproximada"))
with open(os.path.join(OUT, "arboles.json"), "w", encoding="utf-8") as f:
    json.dump(dict(meta=meta, trees=trees), f, ensure_ascii=False, indent=1)
cols = ["id","code","name","sex","bank","origin","province","country","wild","lat","lon","precision","coord_source","region_label","confidence"]
with open(os.path.join(OUT, "arboles.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader()
    for t in trees: w.writerow(t)
print(f"{len(trees)} árboles  ({meta['count_exact']} exactas, {meta['count_approx']} aproximadas)")
print("correcciones:", len(corrections), "| avisos:", len(warnings))
print("-> data/arboles.json, data/arboles.csv")
