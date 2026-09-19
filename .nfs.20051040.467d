# Notas sobre el curado de coordenadas

Este documento resume cómo se han obtenido y estandarizado las coordenadas a partir del Excel `Listado muestras ADN (final).xlsx`. Para regenerar los datos: `python3 tools/build_data.py` (necesita el Excel en la carpeta raíz del proyecto y el paquete `openpyxl`).

## Fuentes dentro del Excel

- **`Listado común`** — lista maestra de los 359 árboles. Columna A (`Código de extracción`) → identificador `Cs` + código (p. ej. `073` → `Cs073`).
- **`Banco Almería`** — coordenadas de campo (columna *Ubicación*).
- **`Marruecos_coord_correctas`** — coordenadas correctas de Marruecos (las que se usan).
- **`Datos Marruecos Hasna`** — solo se usa para enlazar `Sample Code` con el código de extracción y para rellenar los pocos puntos que faltan en la hoja de correctas.

Todo se estandariza a **WGS84, grados decimales**.

## Precisión

- **exacta** — GPS de campo (Almería) o coordenadas geográficas de Marruecos.
- **aproximada** — accesión de colección de la que solo se conoce país/provincia/localidad de origen; se sitúa en un punto representativo de esa región.

Recuento: **359 árboles → 117 exactas, 242 aproximadas**.

## Almería

La columna *Ubicación* mezcla decimal (`36.931, -1.991`) y grados-minutos-segundos (`36°51'29.7"N 2°28'52.8"W`); el parser admite ambos. Correcciones aplicadas:

- Comas decimales en la longitud (`-2,197` → `-2.197`).
- Un punto sobrante al final de una coordenada.
- **Cinco longitudes con signo positivo corregidas a negativo** (Almería está al oeste del meridiano): códigos `553` (Partaloa) y `554–557` (Berja).

Dos entradas de Almería no tienen coordenada de campo (`060 Matias`, sin par de coordenadas; `558 Río aguas`, sin fila en la hoja) y quedan como aproximadas a nivel de provincia.

## Marruecos

Se prioriza **`Marruecos_coord_correctas`** (28 muestras). Los 7 códigos que no están en esa hoja (`526, 533, 538, 539, 544, 545, 546`) se rellenan interpretando `Datos Marruecos Hasna`, descartando las filas que solo traen UTM (`X=… / Y=…`). El enlace entre hojas es `código de extracción = Sample Code + 515`.

## Ubicaciones aproximadas

Se resuelven con una tabla región → punto representativo (`tools/build_data.py`, diccionarios `LOCALITIES` / `PROVINCES` / `COUNTRIES`):

- Localidades concretas del Algarve (Tavira, Benafim, Paderne…) con mayor detalle.
- Provincias españolas e internacionales por su centro aproximado.
- Accesiones de CAJAMAR sin origen conocido → estación de Las Palmerillas (El Ejido), marcadas como *origen desconocido*.

Si quieres afinar alguna región, edita esos diccionarios y vuelve a ejecutar el script.

## Solapamiento

Muchas accesiones comparten el mismo punto representativo (p. ej. 30 de Mallorca). Para que no se apilen, la web (1) agrupa los puntos cercanos en clústeres que se abren al hacer zoom y (2) separa en una pequeña espiral determinista los que caen exactamente en el mismo sitio. La posición individual de un punto aproximado es, por tanto, indicativa.
