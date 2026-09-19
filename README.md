# AlgarroMap

Mapa web de las localizaciones de los algarrobos (*Ceratonia siliqua*) muestreados en el proyecto de secuenciación. Aplicación estática, sin dependencias de servidor, pensada para publicarse en GitHub Pages.

*Web map of the sampled carob trees for the sequencing project. Static site, ready for GitHub Pages. Bilingual ES/EN.*

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube el contenido de esta carpeta (el Excel de origen queda excluido por `.gitignore`).
2. En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. La web queda en `https://<usuario>.github.io/<repo>/`.

## Ver en local

Al leer los datos con `fetch`, hace falta servir la carpeta por HTTP (abrir `index.html` con doble clic no basta):

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```

## Estructura

```
index.html          página principal
styles.css          estilo (modo claro/oscuro automático)
app.js              lógica: carga de datos, mapa, filtros, búsqueda
data/arboles.json   datos que lee la web (fuente de verdad)
data/arboles.csv    los mismos datos en CSV
vendor/             Leaflet 1.9.4 + MarkerCluster (incluidos, sin CDN)
NOTAS_DATOS.md      cómo se han curado las coordenadas
```

## Datos

Cada árbol lleva: identificador `Csxxx`, nombre, sexo, banco de procedencia, origen/provincia, país, tipo (silvestre/cultivado), coordenada en WGS84 (grados decimales) y su **precisión**:

- **exacta** — GPS de campo (Almería) o coordenadas de Marruecos.
- **aproximada** — accesión de colección de la que solo se conoce la región de origen; se ubica en un punto representativo de esa región.

Para regenerar los datos desde el Excel, ver `NOTAS_DATOS.md`.

## Créditos

Cartografía base: © OpenStreetMap, © CARTO y Esri World Imagery. Librería de mapa: [Leaflet](https://leafletjs.com) y [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster).
