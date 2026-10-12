# PescaApp

Asistente web para pesca recreativa: clima, mareas en cualquier costa, fase lunar, índice de actividad, especies de la zona y registro de capturas con comprobación de talla y vedas.

Hecho con HTML, CSS y JavaScript sin frameworks ni dependencias en tiempo de ejecución. Funciona en móvil y en escritorio, con modo claro y oscuro.

> **Aviso legal:** PescaApp es una herramienta orientativa. No sustituye a la normativa oficial. Antes de pescar, consulta la normativa vigente de tu comunidad autónoma o del país donde pesques (tallas mínimas, cupos, vedas y zonas protegidas). Las mareas, el clima, la fase lunar y el índice de actividad son estimaciones. No uses las mareas de PescaApp para navegar.

## Cómo ejecutarla

**Opción recomendada:** sirve la carpeta con un servidor local y abre el enlace en el navegador.

```bash
python3 -m http.server 8080    # o también: npm start
```

Luego abre <http://localhost:8080>. El GPS del navegador exige un contexto seguro (`localhost` o HTTPS).

**Alternativa:** abre `index.html` directamente. Funciona, pero algunos navegadores bloquean la geolocalización en archivos locales. En ese caso usa la búsqueda manual.

Al cargar, la app pide tu ubicación. También puedes escribir un lugar (ciudad, puerto, playa) o unas coordenadas, por ejemplo `43.36, -8.41`.

## Funcionalidades

- **Ubicación:** GPS, búsqueda por nombre o coordenadas. Asigna una zona del catálogo de especies y avisa si estás lejos de la costa catalogada.
- **Clima actual:** temperatura del aire y del agua, viento (km/h y nudos, con dirección), presión con su tendencia de 3 h, humedad, nubosidad, precipitación, amanecer y atardecer.
- **Luna:** fase, iluminación y próxima luna llena o nueva (cálculo propio, sin API).
- **Índice de actividad (0–100):** combina presión, luna, viento y marea, y explica cada factor.
- **Mareas:** altura actual, próximas pleamar y bajamar, gráfica de 24 horas y tabla de extremos. Por defecto usa la **predicción armónica de la estación de marea más cercana**, sin registro ni clave. Como opción, puedes usar WorldTides con una clave gratuita. Se muestra la estación usada, su distancia y su licencia.
- **Especies de la zona:** 17 especies con ficha completa: tallas mínimas por zona, pesos, hábitat, periodos de mayor actividad, cebos, técnicas, restricciones y fuentes.
- **Registro de capturas:** fecha y hora editables, especie con autocompletado, peso, longitud, cebo, técnica, notas y foto. Las capturas pasadas guardan las condiciones de ese momento: datos históricos de Open-Meteo y marea predicha para esa fecha.
- **Validación:** en rojo si la captura está por debajo de la talla mínima de referencia o en veda o protección. Si solo hay longitud, estima el peso con W = a · L^b.
- **Exportación:** JSON (incluye fotos) y CSV (separador `;`, compatible con Excel en español).

## Mareas: cómo funciona

1. La app busca las estaciones de marea de la base de datos en las 9 teselas (de 10° × 10°) alrededor de tu ubicación y elige la más cercana, a menos de 60 km.
2. Con las constantes armónicas de esa estación calcula las pleamares, las bajamares y las alturas cada 10 minutos. Las alturas se expresan sobre LAT (bajamar astronómica) cuando la estación tiene ese dato.
3. La tarjeta de mareas muestra la estación, su distancia, su fuente y su licencia. Si la estación está a más de 20 km, avisa de que la predicción puede desviarse en la costa abierta, estuarios o calas.

**Qué no incluye:** viento, presión ni oleaje. Una tormenta o un viento fuerte pueden alterar la marea real. Tampoco sustituye a las tablas oficiales de tu puerto.

Si la estación más cercana está a más de 60 km (por ejemplo, en el interior), la app no muestra predicción y lo indica.

## APIs y fuentes de datos

| Servicio | Uso | Clave | Notas |
|---|---|---|---|
| Open-Meteo `api.open-meteo.com/v1/forecast` | Clima actual, horario, amanecer y atardecer, histórico reciente | No | Gratuita para uso no comercial |
| Open-Meteo `marine-api.open-meteo.com/v1/marine` | Temperatura de la superficie del agua | No | Opcional: si no hay dato, se indica |
| Open-Meteo `archive-api.open-meteo.com/v1/archive` | Condiciones de capturas de hace más de 8 días | No | Datos ERA5 con algunos días de retraso |
| Nominatim (OpenStreetMap) | Geocodificación inversa y búsqueda de lugares | No | Máximo 1 petición por segundo. Caché de 30 días |
| Base de datos Neaps (`@neaps/tide-database`) | Constantes armónicas de estaciones de marea, incluidas en `js/data/tides/` | No | Código MIT. Cada estación indica su fuente y su licencia |
| WorldTides v3 `worldtides.info/api/v3` | Alturas y extremos de marea (opcional) | Sí (gratuita, con registro) | Solo si la eliges en Ajustes. Caché de 12 horas |

La app no tiene servidor propio ni cuentas de usuario. Tus datos (capturas, ubicación, claves) se quedan en tu navegador (localStorage).

**Estado de verificación:** en el entorno donde se desarrolló no fue posible llamar en vivo a Open-Meteo, Nominatim ni WorldTides. Sus parámetros se escribieron según su documentación pública, y las pruebas automáticas usan respuestas de prueba con esa misma estructura. Antes de confiar en la app, comprueba en tu navegador que el clima y la temperatura del agua llegan.

## Atribución y licencias

Los datos de marea provienen de la base de datos pública [`@neaps/tide-database`](https://github.com/openwatersio/tide-database), que recoge constantes armónicas de estaciones de marea de varias fuentes (entre ellas TICON-4, NOAA, UHSLC, Copernicus Marine e IEO, según la estación). La app:

- Muestra en la tarjeta de mareas la fuente y la licencia de la estación usada, con enlace a la fuente.
- Incluye en el pie de página la atribución general.
- Respeta las licencias: las estaciones **CC BY-NC 4.0** solo pueden usarse sin fines comerciales. PescaApp es una herramienta gratuita y no comercial. Si alguna vez se cobrara por ella o se usara comercialmente, habría que retirar esas estaciones.
- El predictor armónico ([`@neaps/tide-predictor`](https://github.com/openwatersio/neaps), MIT) se incluye empaquetado en `js/vendor/tide-predictor.js`, con su aviso de licencia en la cabecera.

## Clave de WorldTides (opcional)

No necesitas ninguna clave para las mareas. Si prefieres WorldTides:

1. Regístrate gratis en <https://www.worldtides.info> y copia tu clave.
2. En la app, pulsa **⚙️ Ajustes**, elige *Fuente de las mareas: WorldTides* y pega la clave en *Clave de WorldTides*. Se guarda solo en tu navegador.
3. Alternativa para desarrolladores: pégala en `worldTidesApiKey` de `js/config.js`. No subas la clave a un repositorio público.

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

## Mantenimiento de los datos de marea

Los datos de marea ya están en el repositorio (`js/data/tides/`, unos 5,6 MB) y la app no necesita npm para funcionar. Solo hace falta regenerarlos si cambia la base de datos Neaps:

```bash
npm install                # instala las herramientas de desarrollo (fijadas por versión)
npm run build:vendor       # reempaqueta el predictor en js/vendor/tide-predictor.js
npm run build:tides        # regenera las teselas y el manifiesto en js/data/tides/
npm test
```

`build:tides` descarta las estaciones que el predictor no puede reproducir y las que tienen menos de tres constituyentes. Descarta también los constituyentes con amplitud menor de 2 mm, que no cambian las predicciones de forma apreciable.

## Estructura

```
index.html              Estructura de la página
css/styles.css          Estilos (paleta marina, modo oscuro, diseño responsive)
js/config.js            URLs de las APIs, clave opcional, cachés, radio de estaciones y teselas
js/utils.js             Utilidades: números, fechas, red, caché y almacenamiento
js/moon.js              Fase lunar (cálculo propio)
js/data/species-data.js Catálogo de especies, zonas y puntos de costa (fuentes citadas)
js/data/tides/          Teselas de constantes armónicas y manifiesto (generados)
js/vendor/              Predictor armónico empaquetado (MIT)
js/species.js           Búsqueda de especies y asignación de zona
js/location.js          GPS, búsqueda de lugares y Nominatim
js/weather.js           Open-Meteo: clima, temperatura del agua e histórico
js/tides.js             Mareas: predicción armónica por estación, WorldTides opcional y coeficiente
js/activity.js          Índice de actividad (0–100) con explicación
js/validation.js        Talla mínima, vedas, protección y peso estimado
js/catches.js           Registro de capturas, exportación y reducción de fotos
js/app.js               Controlador de la interfaz
tools/                  Scripts de mantenimiento: build-tide-data.mjs y build-vendor.mjs
tests/                  Pruebas unitarias (node:test)
```

Los archivos se cargan con `<script>` clásicos, en orden, sin módulos ES. Así funcionan también abriendo `index.html` directamente. Las teselas de marea se cargan bajo demanda, solo las de la zona donde estás.

## Pruebas

```bash
npm test
```

Ejecuta 68 pruebas unitarias (Node 18 o superior): fase lunar, coeficiente, mareas (predicción armónica y WorldTides), selección de estación, predicción de A Coruña, integridad de todas las teselas, parseo de respuestas, índice de actividad, validación de tallas y vedas, catálogo, zonas y exportación CSV/JSON.

## Limitaciones conocidas

- **Mareas:** la predicción armónica es astronómica. No incluye viento, presión ni oleaje, y puede diferir en puertos, estuarios y calas. Cerca de la estación (menos de 20 km) suele ser más fiable que lejos. No se ha comparado todavía con las tablas oficiales de un puerto concreto: compara antes de fiarte.
- **Tallas y vedas:** son referencias orientativas. La talla de pesca recreativa depende de la comunidad autónoma. Varias especies no tienen talla confirmada y ninguna tiene vedas registradas todavía.
- **Coeficiente de marea:** es una estimación por fase lunar, no el coeficiente oficial de las tablas.
- **Luna:** cálculo de luna media (error de unas horas). Para horas exactas de salida y puesta de la Luna, usa un cálculo astronómico completo.
- **Índice de actividad:** es una heurística. No garantiza capturas.
- **Pesos estimados:** el error habitual es de ±30 %.
- **Zonas de especies:** el catálogo cubre sobre todo la costa española y tiene pocas especies en Canarias. El agua dulce y el interior no están incluidos.
- **Fotos:** se guardan en localStorage reducidas a 800 px. El navegador limita este espacio (unos 5 MB). Si no cabe, la captura se guarda sin foto.
- **Datos locales:** las capturas solo existen en este navegador. Exporta el JSON para tener copias de seguridad.

## Fuentes y créditos

- Datos meteorológicos: [Open-Meteo](https://open-meteo.com) (licencia CC BY 4.0).
- Geocodificación: [Nominatim](https://nominatim.org) y © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
- Constantes armónicas de marea: [`@neaps/tide-database`](https://github.com/openwatersio/tide-database) (código MIT; cada estación con su licencia: CC BY 4.0, CC BY-NC 4.0 o dominio público).
- Predictor armónico: [`@neaps/tide-predictor`](https://github.com/openwatersio/neaps) (MIT).
- Mareas opcionales: [WorldTides](https://www.worldtides.info) (requiere clave propia).
- Nombres científicos, tallas máximas y hábitat: [FishBase](https://www.fishbase.se) y [FAO FishFinder](https://www.fao.org/fishery/en/species).
- Normativa de referencia (consultada el 12/10/2026, según fuentes públicas): Reglamento (CE) n.º 850/98, anexo XII; Real Decreto 560/1995; Real Decreto 1615/2005; Real Decreto 347/2011; Reglamento (UE) 2019/1241 y Reglamento (UE) 2024/491. Las referencias concretas aparecen en el campo `sources` de cada especie.
