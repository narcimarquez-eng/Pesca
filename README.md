# PescaApp

Asistente web para pesca recreativa en España: clima, mareas, fase lunar, índice de actividad, especies de la zona y registro de capturas con comprobación de talla y vedas.

Hecho con HTML, CSS y JavaScript sin frameworks ni dependencias. Funciona en móvil y en escritorio, con modo claro y oscuro.

> **Aviso legal:** PescaApp es una herramienta orientativa. No sustituye a la normativa oficial. Antes de pescar, consulta la normativa vigente de tu comunidad autónoma (tallas mínimas, cupos, vedas y zonas protegidas). Las mareas, el clima, la fase lunar y el índice de actividad son estimaciones.

## Cómo ejecutarla

**Opción recomendada:** sirve la carpeta con un servidor local y abre el enlace en el navegador.

```bash
python3 -m http.server 8080    # o también: npm start
```

Luego abre <http://localhost:8080>. El GPS del navegador exige un contexto seguro (`localhost` o HTTPS).

**Alternativa:** abre `index.html` directamente. Funciona, pero algunos navegadores bloquean la geolocalización en archivos locales. En ese caso usa la búsqueda manual.

Al cargar, la app pide tu ubicación. También puedes escribir un lugar (ciudad, puerto, playa) o unas coordenadas, por ejemplo `43.36, -8.41`.

## Funcionalidades

- **Ubicación:** GPS, búsqueda por nombre o coordenadas. Asigna una zona del catálogo y avisa si estás lejos de la costa catalogada.
- **Clima actual:** temperatura del aire y del agua, viento (km/h y nudos, con dirección), presión con su tendencia de 3 h, humedad, nubosidad, precipitación, amanecer y atardecer.
- **Luna:** fase, iluminación y próxima luna llena o nueva (cálculo propio, sin API).
- **Índice de actividad (0–100):** combina presión, luna, viento y marea, y explica cada factor.
- **Mareas:** altura actual, próximas pleamar y bajamar, gráfica de 24 horas y coeficiente aproximado. Las alturas requieren una clave gratuita de WorldTides (ver más abajo).
- **Especies de la zona:** 17 especies con ficha completa: tallas mínimas por zona, pesos, hábitat, periodos de mayor actividad, cebos, técnicas, restricciones y fuentes.
- **Registro de capturas:** fecha y hora editables, especie con autocompletado, peso, longitud, cebo, técnica, notas y foto. Las capturas pasadas guardan las condiciones de ese momento (datos históricos de Open-Meteo y marea de WorldTides si hay clave).
- **Validación:** en rojo si la captura está por debajo de la talla mínima o en veda o protección. Si solo hay longitud, estima el peso con W = a · L^b.
- **Exportación:** JSON (incluye fotos) y CSV (separador `;`, compatible con Excel en español).

## APIs utilizadas

| Servicio | Uso | Clave | Notas |
|---|---|---|---|
| Open-Meteo `api.open-meteo.com/v1/forecast` | Clima actual, horario, amanecer y atardecer, histórico reciente | No | Gratuita para uso no comercial |
| Open-Meteo `marine-api.open-meteo.com/v1/marine` | Temperatura de la superficie del agua | No | Opcional: si no hay dato, se indica |
| Open-Meteo `archive-api.open-meteo.com/v1/archive` | Condiciones de capturas de hace más de 8 días | No | Datos ERA5 con algunos días de retraso |
| Nominatim (OpenStreetMap) | Geocodificación inversa y búsqueda de lugares | No | Máximo 1 petición por segundo. Caché de 30 días |
| WorldTides v3 `worldtides.info/api/v3` | Alturas y extremos de marea | **Sí** (gratuita, con registro) | Créditos limitados por plan. La app guarda la respuesta 12 horas |

La app solo usa estas APIs desde el navegador. No hay servidor propio ni cuentas de usuario, y los datos del usuario se quedan en su navegador (localStorage).

**Estado de verificación:** en el entorno donde se desarrolló no fue posible llamar en vivo a estos servicios, así que los nombres de parámetros y variables se escribieron según su documentación pública. Las pruebas automáticas usan respuestas de prueba con esa misma estructura. Antes de confiar en la app, comprueba que los datos llegan en tu navegador, sobre todo la temperatura del agua y las mareas. Si algo no aparece, revisa `js/weather.js` y `js/tides.js`.

## Clave de WorldTides (mareas)

1. Regístrate gratis en <https://www.worldtides.info> y copia tu clave.
2. En la app, pulsa **⚙️ Ajustes**, pega la clave en *Clave de WorldTides* y guarda. Se guarda solo en tu navegador.
3. Alternativa para desarrolladores: pégala en `worldTidesApiKey` de `js/config.js`. No subas la clave a un repositorio público.

Sin clave, la app muestra igualmente el coeficiente de marea aproximado.

## Añadir una especie

Edita `js/data/species-data.js` y añade un objeto al array `species`:

```js
{
  id: 'especie-ejemplo',            // identificador único, sin espacios
  commonName: 'Especie de ejemplo',
  scientificName: 'Genus species',
  aliases: ['Nombre alternativo'],  // se usan en la búsqueda
  family: 'Familia',
  zones: ['mediterraneo'],          // zonas donde aparece (ids de `zones`)
  habitat: 'Descripción del hábitat.',
  depthRangeM: [0, 50],
  averageWeightKg: 0.5,             // orientativo
  maxWeightKg: 3,                   // orientativo
  maxLengthCm: 60,                  // orientativo
  peakMonths: [5, 6, 7],           // meses de mayor actividad (1 = enero)
  peakNote: 'Primavera y verano.',
  baits: ['Gamba', 'Señuelos de superficie'],
  techniques: ['Spinning desde orilla'],
  minSizeCm: { mediterraneo: 25 }, // talla mínima por zona; {} si no hay dato confirmado
  minSizeNote: 'Cómo se obtuvo la talla y qué confirmar.',
  protected: false,
  closedSeasons: [                 // vedas, opcional
    { zones: ['mediterraneo'], months: [4, 5], reason: 'periodo de freza', source: 'Norma X (BOE)' },
  ],
  restrictions: 'Cupos y tallas según la normativa autonómica.',
  sources: ['Fuente de la información'],
}
```

Las tallas que no tengan una fuente clara deben quedar vacías (`{}` o `null`): la app mostrará "sin dato confirmado" en lugar de un valor inventado. Si una especie tiene una relación longitud-peso propia, añade `lengthWeight: { a, b, source }`.

## Añadir una zona o una costa

1. En `zones`, añade la zona con `id`, `name`, `regions` y `regulationNote`.
2. En `zoneAnchors`, añade uno o varios puntos costeros con `zoneId`, `name`, `lat` y `lon`. Cada ubicación se asigna a la zona del punto más cercano. Si está a más de `maxZoneDistanceKm` (60 km por defecto), la app avisa de que el catálogo puede no ser representativo.
3. Añade el id de la zona a los `zones` de las especies que se pescan allí.
4. Ejecuta `npm test`. Las pruebas comprueban que los ids existen y que las tallas solo se asignan a zonas de cada especie.

## Estructura

```
index.html              Estructura de la página
css/styles.css          Estilos (paleta marina, modo oscuro, diseño responsive)
js/config.js            URLs de las APIs, clave opcional, cachés y parámetros
js/utils.js             Utilidades: números, fechas, red, caché y almacenamiento
js/moon.js              Fase lunar (cálculo propio)
js/data/species-data.js Catálogo de especies, zonas y puntos de costa (fuentes citadas)
js/species.js           Búsqueda de especies y asignación de zona
js/location.js          GPS, búsqueda de lugares y Nominatim
js/weather.js           Open-Meteo: clima, temperatura del agua e histórico
js/tides.js             WorldTides y coeficiente aproximado
js/activity.js          Índice de actividad (0–100) con explicación
js/validation.js        Talla mínima, vedas, protección y peso estimado
js/catches.js           Registro de capturas, exportación y reducción de fotos
js/app.js               Controlador de la interfaz
tests/                  Pruebas unitarias (node:test)
```

Los archivos se cargan con `<script>` clásicos, en orden, sin módulos ES. Así funcionan también abriendo `index.html` directamente.

## Pruebas

```bash
npm test
```

Ejecuta 57 pruebas unitarias (Node 18 o superior, sin dependencias): fase lunar, coeficiente, mareas, parseo de respuestas, índice de actividad, validación de tallas y vedas, catálogo, zonas y exportación CSV/JSON.

## Limitaciones conocidas

- **Tallas y vedas:** son referencias orientativas. La talla de pesca recreativa depende de la comunidad autónoma. Varias especies no tienen talla confirmada y ninguna tiene vedas registradas todavía. Consulta siempre la normativa vigente.
- **Mareas:** las alturas vienen de WorldTides. Open-Meteo no ofrece alturas de marea. El coeficiente de la app se estima con la fase lunar y no es el coeficiente oficial de las tablas.
- **Luna:** cálculo de luna media (error de unas horas). Para horas exactas de salida y puesta de la Luna, usa un cálculo astronómico completo.
- **Índice de actividad:** es una heurística. No garantiza capturas.
- **Pesos estimados:** el error habitual es de ±30 %.
- **Zonas:** el catálogo cubre la costa española; el agua dulce y el interior no están incluidos.
- **Fotos:** se guardan en localStorage reducidas a 800 px. El navegador limita este espacio (unos 5 MB). Si no cabe, la captura se guarda sin foto.
- **Datos locales:** las capturas solo existen en este navegador. Exporta el JSON para tener copias de seguridad.

## Fuentes y créditos

- Datos meteorológicos: [Open-Meteo](https://open-meteo.com) (licencia CC BY 4.0).
- Geocodificación: [Nominatim](https://nominatim.org) y © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
- Mareas: [WorldTides](https://www.worldtides.info) (requiere clave propia).
- Nombres científicos, tallas máximas y hábitat: [FishBase](https://www.fishbase.se) y [FAO FishFinder](https://www.fao.org/fishery/en/species).
- Normativa de referencia (consultada el 12/10/2026, según fuentes públicas): Reglamento (CE) n.º 850/98, anexo XII; Real Decreto 560/1995; Real Decreto 1615/2005; Real Decreto 347/2011; Reglamento (UE) 2019/1241 y Reglamento (UE) 2024/491. Las referencias concretas aparecen en el campo `sources` de cada especie.
