# AlgarroMap: Mapa Interactivo

[![Mantenido por Aaron Gálvez Salido](https://img.shields.io/badge/Mantenido%20por-Aaron%20G%C3%A1lvez%20Salido-blue)](mailto:ags408@ual.es) [![AlgarroMap](https://img.shields.io/badge/Web-AlgarroMap-orange)](https://aarongs1999.github.io/AlgarroMapv2/)

Este repositorio contiene el mapa interactivo **AlgarroMap**, que muestra la localización de los árboles de algarrobo (*Ceratonia siliqua*) muestreados en el proyecto de secuenciación. Es una aplicación web estática, sin servidor, publicada en GitHub Pages.

## Descripción del Proyecto

AlgarroMap tiene como objetivo situar en un mapa los algarrobos muestreados por el grupo de investigación **BIO-359: Genómica Evolutiva de Plantas (PlantEVOLGEN)**, cuyo director es **Lorenzo Carretero Paulet**. Esta versión recoge todas las muestras del listado (España, Marruecos, Portugal y otros orígenes), distinguiendo entre los árboles con **coordenadas de campo exactas** (Almería y Marruecos) y las **accesiones de colección**, de las que solo se conoce la región de origen y que se sitúan en un punto representativo de esa región.

## Uso del mapa

* **Buscar y filtrar**: por nombre o código, y por país/región o banco de procedencia.
* **Puntos**: en verde los de coordenada exacta (GPS) y en ámbar los de ubicación aproximada.
* **Fichas**: los árboles de Almería que tienen ficha muestran un botón para abrirla al pulsar el punto.
* **Idioma**: interfaz en español o inglés.
* Arriba a la izquierda hay un acceso directo a este repositorio de GitHub.

## Mantenimiento y Contacto

* **Aaron Gálvez Salido**
    * Estudiante de Doctorado
    * Grupo de investigación: **BIO-359: Genómica Evolutiva de Plantas (PlantEVOLGEN)**
    * Correo de contacto: [ags408@ual.es](mailto:ags408@ual.es)

## Contenido del Repositorio

* **`data/arboles.json`**: datos que lee la web (fuente de verdad), con la información de cada árbol y su coordenada en WGS84.
* **`data/arboles.csv`**: los mismos datos en formato CSV.
* **`Fichas/`**: fichas con información detallada de los individuos muestreados en Almería.
* **`index.html`, `styles.css`, `app.js`**: la aplicación web (mapa, filtros, búsqueda y fichas), basada en la librería [Leaflet](https://leafletjs.com).
* **`vendor/`**: Leaflet y Leaflet.markercluster incluidos en el repositorio (sin depender de CDNs externos).
* **`tools/build_data.py`**: script que regenera y estandariza los datos a partir del Excel de muestreo.

**Cartografía base**: imágenes de satélite de Esri World Imagery, con etiquetas de lugares.

## Agradecimientos

Este trabajo fue financiado por la ayuda PID2023-146207OB-I00 del Ministerio de Ciencia, Innovación y Universidades (MCIU), la Agencia Estatal de Investigación (AEI) / 10.13039/501100011033 y el Fondo Social Europeo Plus (FSE+), a través del proyecto "El modelo agrícola de Almería ante el cambio global. Propuestas desde la genómica de la agrobiodiversidad" (OrphanEvolGen).
