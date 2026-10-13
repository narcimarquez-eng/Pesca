# PescaApp

Asistente web para pesca recreativa: clima, previsión por horas, mareas en cualquier costa, fase lunar, valoración de condiciones de pesca, especies de la zona y registro de capturas con comprobación de talla y vedas.

Hecho con HTML, CSS y JavaScript sin frameworks ni dependencias en tiempo de ejecución. Funciona en móvil y en escritorio, con modo claro y oscuro.

> **Aviso legal:** PescaApp es una herramienta orientativa. No sustituye a la normativa oficial. Antes de pescar, consulta la normativa vigente de tu comunidad autónoma o del país donde pesques (tallas mínimas, cupos, vedas y zonas protegidas). Las mareas, el clima, la fase lunar y la valoración de condiciones son estimaciones. No uses las mareas de PescaApp para navegar.

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
- **Condiciones de pesca (1–5 estrellas):** valoración a partir de presión, luna, viento y marea, con límites de seguridad por tormenta, lluvia y viento fuerte. Muestra el índice de 0 a 100 y explica cada factor y cada ajuste.
- **Previsión por horas:** tabla de 72 horas, una fila por hora, agrupada en días desplegables. Cada hora muestra el valor central de Open-Meteo y, debajo, el margen entre escenarios (51 miembros del modelo de conjunto ECMWF IFS), además de la probabilidad de lluvia, la altura de marea con su sentido, el coeficiente y la valoración. Destaca los tres mejores momentos.
- **Mareas:** altura actual, próximas pleamar y bajamar, gráfica de 24 horas, **coeficiente de marea de hoy** y una **tabla de los próximos 7 días** con el coeficiente, las pleamares y las bajamares de cada día. Por defecto usa la **predicción armónica de la estación de marea más cercana** y, donde no hay estación, la del **modelo global de mareas EOT20**, sin registro ni clave. Como opción, puedes usar WorldTides con una clave gratuita. Se muestra la estación o el punto del modelo usado, su distancia y su licencia.
- **Especies de la zona:** 17 especies con ficha completa: tallas mínimas por zona, pesos, hábitat, periodos de mayor actividad, cebos, técnicas, restricciones y fuentes.
- **Registro de capturas:** fecha y hora editables, especie con autocompletado, peso, longitud, cebo, técnica, notas y foto. Las capturas pasadas guardan las condiciones de ese momento: datos históricos de Open-Meteo y marea predicha para esa fecha.
- **Validación:** en rojo si la captura está por debajo de la talla mínima de referencia o en veda o protección. Si solo hay longitud, estima el peso con W = a · L^b.
- **Exportación:** JSON (incluye fotos) y CSV (separador `;`, compatible con Excel en español).
- **Idiomas:** la interfaz en 18 idiomas, con selección automática por país y formato de números y fechas por idioma. Ver «Idiomas y países».

## Mareas: cómo funciona

1. La app busca las estaciones de marea de la base de datos en las 9 teselas (de 10° × 10°) alrededor de tu ubicación y elige la más cercana, a menos de 60 km. Solo incluye estaciones de dominio público o CC BY 4.0: las CC BY-NC 4.0, que no permiten el uso comercial, se descartan al generar las teselas.
2. Si no hay ninguna estación a menos de 60 km, usa el punto más cercano del **modelo global de mareas EOT20** (DGFI-TUM, CC BY 4.0) a menos de 20 km. Son las constantes armónicas del modelo en la franja de océano que toca la costa, en una rejilla de 1/8° (unos 14 km).
3. Con esas constantes calcula las pleamares, las bajamares y las alturas cada 10 minutos. Con una estación, las alturas se expresan sobre LAT (bajamar astronómica) si la estación tiene ese dato; con el modelo, sobre el nivel medio del mar.
4. La tarjeta de mareas muestra la estación o el punto del modelo, su distancia, su fuente y su licencia. Si la estación está a más de 20 km, avisa de que la predicción puede desviarse; si es un punto del modelo, avisa de su precisión.
5. **Coeficiente de marea:** para cada día local, la amplitud del día (la pleamar más alta menos la bajamar más baja) se compara con la amplitud media del año de esa estación, con 70 como marea media. Las mareas vivas dan valores altos y las muertas, valores bajos. Es el mismo criterio de las tablas oficiales, aplicado a la estación más cercana, así que puede diferir del coeficiente oficial.

**Precisión del modelo frente a las estaciones.** Se comparó EOT20 con las 6.066 estaciones de la base de datos: 30 días de predicción, sin las ondas de periodo largo (anual, semestral y mensuales).

- Cerca de la costa abierta (estación a menos de 10 km de la franja del modelo), el error mediano es de unos 10 cm de altura y 24 minutos en la hora de pleamar y bajamar. En el 10 % de los casos peores, unos 40 cm y 2 horas.
- Una estación a menos de 60 km acierta más que el modelo en la mayoría de los casos; el modelo solo gana a partir de unos 60 km. Por eso la app solo usa el modelo cuando no hay estación.
- A más de 20 km de la franja del modelo (estuarios y ríos), el error mediano sube a 48 cm y casi 2 horas. Por eso no se usa más lejos.
- En los lugares que perdieron su estación no comercial y no tienen otra a menos de 60 km (121, de los que el modelo cubre 112), el error mediano es de 2 cm y 34 minutos, casi siempre en mares con poca marea; con marea grande, 5 cm y 4 minutos. En España: Gijón, Bilbao, San Cibrao y Huelva, unos 5 cm y 3–4 minutos; Avilés, 10 cm y 7 minutos; Canarias, de 3 a 9 cm. Sevilla, río arriba, queda sin predicción.

**Qué no incluye:** viento, presión ni oleaje. Una tormenta o un viento fuerte pueden alterar la marea real. Tampoco sustituye a las tablas oficiales de tu puerto.

Si no hay ninguna estación a menos de 60 km ni punto del modelo a menos de 20 km (por ejemplo, en el interior o río arriba), la app no muestra predicción y lo indica.

## Previsión y valoración: cómo se calculan

La previsión central usa la serie horaria de Open-Meteo: cuatro días (hoy y los tres siguientes), más el día anterior para la tendencia de presión. La tabla muestra una fila por hora desde la hora actual, durante 72 horas, en la hora local del lugar.

**Escenarios.** Cada miembro del modelo de conjunto ECMWF IFS (51) es un escenario posible. Para cada hora, el margen de temperatura, viento y rachas va del percentil 10 al 90 de los escenarios, y siempre incluye el valor central. La probabilidad de lluvia es el porcentaje de escenarios con al menos 0,1 mm en esa hora. La valoración también tiene margen: cada escenario se valora con su propio viento, lluvia y presión, mientras que el código de tiempo, la luna y la marea son los de la previsión central. Los escenarios se guardan solo en la memoria de la página, porque pesan demasiado para localStorage.

Para cada hora se calcula el índice de actividad (0–100) con estos pesos:

| Factor | Peso | Qué mira |
|---|---|---|
| Presión | 30 % | Nivel (ideal entre 1010 y 1020 hPa) y tendencia de las últimas 3 horas |
| Luna | 20 % | Mareas vivas (luna nueva o llena) frente a mareas muertas |
| Viento | 25 % | Cuanto más flojo, mejor |
| Marea | 25 % | Altura respecto al extremo más cercano y coeficiente |

Si falta un dato, su peso se reparte entre los factores disponibles. Después se aplican límites de seguridad. No se compensan con los buenos factores:

| Condición | Ajuste |
|---|---|
| Tormenta (códigos WMO 95, 96 y 99) | Máximo 20 puntos |
| Lluvia intensa (4 mm o más en la última hora) | −30 puntos |
| Lluvia (1 mm o más en la última hora) | −10 puntos |
| Viento de 40 km/h o más, o rachas de 50 km/h o más | Máximo 25 puntos |

Las estrellas salen de la puntuación final: 5 desde 80 puntos, 4 desde 65, 3 desde 50, 2 desde 35 y 1 por debajo. Los mejores momentos son las horas con más puntuación de al menos 3 estrellas, separadas al menos 6 horas.

**Límites de la valoración.** Es una heurística. Los pesos y los umbrales son criterio propio y no están calibrados con datos de capturas, así que no garantiza ninguna pesca. Los límites de tormenta, lluvia y viento fuerte son de seguridad, pero PescaApp no sustituye a los avisos oficiales (por ejemplo, AEMET en España). Consúltalos antes de salir.

La marea de la previsión es la predicción armónica, que llega 75 horas hacia delante. Con WorldTides, las alturas solo llegan a 33 horas, y las horas fuera de ese tramo muestran «—». El coeficiente de cada hora es el del día local de la estación. Si no hay tabla de marea, se usa la estimación por fase lunar y la celda lo marca como «aprox.».

## Idiomas y países

PescaApp se muestra en el idioma que corresponde, por este orden:

1. El que elijas en Ajustes. «Automático» es la opción por defecto.
2. Si es automático, el idioma del país del lugar. El país viene de Nominatim (`country_code`).
3. Si el país no tiene idioma en la aplicación, el idioma del navegador.
4. Si nada encaja, inglés.

Al cambiar de idioma o de lugar, se vuelven a pintar todos los textos, también los dinámicos. Los
textos sin traducción se muestran en inglés. El texto de origen es el castellano, así que la versión
en castellano no cambia.

**Idiomas disponibles:** castellano, inglés, francés, portugués, alemán, italiano, neerlandés, polaco,
ruso, turco, árabe, hindi, indonesio, japonés, coreano, chino simplificado, tailandés y vietnamita. El
árabe se muestra de derecha a izquierda.

**Traducciones automáticas.** Las traducciones de los idiomas que no son castellano se han generado
con IA y no han sido revisadas por hablantes nativos. Revísalas antes de publicar, sobre todo el aviso
legal y los textos de seguridad.

**Qué no se traduce ni se aplica fuera de España**

- Las tallas mínimas, las vedas, las protecciones y el catálogo de especies y zonas existen solo para
  España. En otros países la app dice que no hay referencia y no aplica reglas de otro lugar.
- Un lugar cuyo país no se conoce tampoco tiene referencia de tallas, aunque esté cerca de la costa
  catalogada.
- Los nombres de especies y de zonas del catálogo siguen en castellano.
- Las unidades son métricas (km/h, hPa, °C, cm, kg).
- Los datos de mareas, el tiempo y la luna son los mismos en todo el mundo.

**Cómo añadir un idioma**

1. Crea `js/i18n/<código>.js` con `PescaApp.i18n.register('<código>', { … })`, con una entrada por cada
   texto que devuelva `node tools/i18n-check.mjs --keys ruta.json`.
2. Añade el idioma a `LOCALES` y a `COUNTRIES_BY_LOCALE` en `js/i18n.js`.
3. Comprueba los marcadores y la cobertura con `node tools/i18n-check.mjs`.

El comprobador extrae las claves de las llamadas `t(…)` y `mark(…)` de `js/*.js` y de los elementos
`data-i18n` de `index.html`, y avisa si una traducción cambia los marcadores `{nombre}`.

## APIs y fuentes de datos

| Servicio | Uso | Clave | Notas |
|---|---|---|---|
| Open-Meteo `api.open-meteo.com/v1/forecast` | Clima actual, horario, amanecer y atardecer, histórico reciente | No | Gratuita para uso no comercial |
| Open-Meteo `marine-api.open-meteo.com/v1/marine` | Temperatura de la superficie del agua | No | Opcional: si no hay dato, se indica |
| Open-Meteo `archive-api.open-meteo.com/v1/archive` | Condiciones de capturas de hace más de 8 días | No | Datos ERA5 con algunos días de retraso |
| Nominatim (OpenStreetMap) | Geocodificación inversa y búsqueda de lugares | No | Máximo 1 petición por segundo. Caché de 30 días |
| Base de datos Neaps (`@neaps/tide-database`) | Constantes armónicas de estaciones de marea, incluidas en `js/data/tides/` | No | Código MIT. Solo estaciones de dominio público o CC BY 4.0; cada una indica su fuente y su licencia |
| Modelo global de mareas EOT20 (DGFI-TUM) | Constantes armónicas en la franja costera, incluidas en `js/data/tides-model/` | No | CC BY 4.0. Solo donde no hay estación a menos de 60 km |
| WorldTides v3 `worldtides.info/api/v3` | Alturas y extremos de marea (opcional) | Sí (gratuita, con registro) | Solo si la eliges en Ajustes. Caché de 12 horas |

La app no tiene servidor propio ni cuentas de usuario. Tus datos (capturas, ubicación, claves) se quedan en tu navegador (localStorage).

**Estado de verificación:** en el entorno donde se desarrolló no fue posible llamar en vivo a Open-Meteo, Nominatim ni WorldTides. Sus parámetros se escribieron según su documentación pública, y las pruebas automáticas usan respuestas de prueba con esa misma estructura. Antes de confiar en la app, comprueba en tu navegador que el clima y la temperatura del agua llegan.

## Atribución y licencias

Los datos de marea provienen de dos fuentes:

- La base de datos pública [`@neaps/tide-database`](https://github.com/openwatersio/tide-database), que recoge constantes armónicas de estaciones de marea de varias fuentes (entre ellas TICON-4, NOAA, UHSLC, IEO y Kartverket, según la estación). Solo se incluyen estaciones de **dominio público o CC BY 4.0**. Las **CC BY-NC 4.0** (282 en la base de datos, marcadas con `commercial_use: false` porque su proveedor de origen restringe el uso comercial) se descartan al generar las teselas.
- El modelo global de mareas **EOT20** de DGFI-TUM (Hart-Davis, M. G. et al., 2021, *EOT20: a global ocean tide model from multi-mission satellite altimetry*, Earth System Science Data 13, 3869–3884, https://doi.org/10.5194/essd-13-3869-2021; datos en SEANOE, https://doi.org/10.17882/79489), con licencia **CC BY 4.0**.

La app:

- Muestra en la tarjeta de mareas la fuente y la licencia de la estación o del punto del modelo usado, con enlace a la fuente.
- Incluye en el pie de página la atribución general.
- Con estas dos fuentes, los datos de marea permiten el uso comercial, citando su origen. Otros servicios tienen sus propias condiciones: por ejemplo, la API gratuita de Open-Meteo es para uso no comercial (ver la tabla de APIs).
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

Los datos de marea ya están en el repositorio (`js/data/tides/`, unos 5,5 MB, y `js/data/tides-model/`, unos 7,6 MB) y la app no necesita npm para funcionar. Solo hace falta regenerarlos si cambia la base de datos Neaps o el modelo:

```bash
npm install                # instala las herramientas de desarrollo (fijadas por versión)
npm run build:vendor       # reempaqueta el predictor en js/vendor/tide-predictor.js
npm run build:tides        # regenera las teselas y el manifiesto en js/data/tides/
npm run build:tide-model -- ruta/a/EOT20/ocean_tides   # regenera los puntos del modelo en js/data/tides-model/
npm test
```

`build:tides` descarta las estaciones sin uso comercial (`commercial_use: false`), las que el predictor no puede reproducir y las que tienen menos de tres constituyentes. Descarta también los constituyentes con amplitud menor de 2 mm, que no cambian las predicciones de forma apreciable.

Para `build:tide-model`, descarga EOT20 de [SEANOE](https://www.seanoe.org/data/00683/79489/) (unos 2 GB) y descomprime `ocean_tides.zip`; esos ficheros no se versionan. La herramienta toma la franja de océano que toca la costa (celdas de 1/8° con alguna vecina de tierra) y descarta las que tienen una estación a menos de 40 km: la app usa una estación hasta 60 km y el modelo hasta 20 km, así que esos puntos nunca se usarían. Guarda los 17 constituyentes de EOT20 por punto, con la amplitud en milímetros y la fase en grados enteros (cambia la predicción menos de 1 cm). Resultado: unos 55.500 puntos en teselas de 5° × 5°; cada consulta descarga solo la de su zona (10 KB de media).

## Estructura

```
index.html              Estructura de la página
css/styles.css          Estilos (paleta marina, modo oscuro, diseño responsive)
js/config.js            URLs de las APIs, clave opcional, cachés, radio de estaciones y teselas
js/i18n.js              Idioma de la interfaz: t(), catálogos bajo demanda, país e idioma que corresponde
js/i18n/                Catálogos de traducción, uno por idioma (inglés siempre cargado)
js/utils.js             Utilidades: números, fechas, red, caché y almacenamiento
js/moon.js              Fase lunar (cálculo propio)
js/data/species-data.js Catálogo de especies, zonas y puntos de costa (fuentes citadas)
js/data/tides/          Teselas de constantes armónicas de estaciones y manifiesto (generados)
js/data/tides-model/    Teselas de puntos del modelo global EOT20 y manifiesto (generados)
js/vendor/              Predictor armónico empaquetado (MIT)
js/species.js           Búsqueda de especies y asignación de zona
js/location.js          GPS, búsqueda de lugares y Nominatim
js/weather.js           Open-Meteo: previsión central, escenarios, temperatura del agua e histórico
js/tides.js             Mareas: predicción armónica por estación o punto del modelo, WorldTides opcional y coeficiente
js/activity.js          Índice de actividad (0–100), valoración de 1 a 5 estrellas y ajustes de seguridad
js/forecast.js          Previsión por horas: filas cada hora, márgenes de escenarios y mejores momentos
js/validation.js        Talla mínima, vedas, protección y peso estimado
js/catches.js           Registro de capturas, exportación y reducción de fotos
js/app.js               Controlador de la interfaz
tools/                  Scripts de mantenimiento: build-tide-data.mjs, build-tide-model.mjs (con tide-model-lib.mjs), build-vendor.mjs e i18n-check.mjs
tests/                  Pruebas unitarias (node:test)
```

Los archivos se cargan con `<script>` clásicos, en orden, sin módulos ES. Así funcionan también abriendo `index.html` directamente. Las teselas de marea se cargan bajo demanda, solo las de la zona donde estás.

## Pruebas

```bash
npm test
```

Ejecuta 136 pruebas unitarias (Node 18 o superior): fase lunar, coeficiente (incluida su correlación con la fase lunar), mareas (predicción armónica, puntos del modelo EOT20 y WorldTides), zonas horarias de las estaciones y de los puntos del modelo, elección entre estación y modelo (Vigo, Gijón, sur de Tenerife y Sevilla), predicción de A Coruña, integridad de todas las teselas de estaciones y del modelo, parseo de respuestas, índice de actividad, valoración de pesca, previsión por horas, escenarios y percentiles, idiomas, catálogos de traducción (mismas claves y marcadores que el inglés) y comprobador de textos, validación de tallas y vedas, catálogo, zonas y exportación CSV/JSON.

## Limitaciones conocidas

- **Mareas:** la predicción armónica es astronómica. No incluye viento, presión ni oleaje, y puede diferir en puertos, estuarios y calas. Cerca de la estación (menos de 20 km) suele ser más fiable que lejos. Donde no hay estación, el modelo EOT20 suele desviarse unos 10 cm y 25 minutos en costa abierta, y bastante más en rías, estuarios y bahías; sus alturas van sobre el nivel medio del mar, no sobre LAT. No se ha comparado todavía con las tablas oficiales de un puerto concreto: compara antes de fiarte.
- **Tallas y vedas:** son referencias orientativas. La talla de pesca recreativa depende de la comunidad autónoma. Varias especies no tienen talla confirmada y ninguna tiene vedas registradas todavía.
- **Coeficiente de marea:** con la predicción armónica es una estimación de la amplitud del día frente a la media del año de la estación. Puede diferir del coeficiente oficial de las tablas. Si usas WorldTides, el coeficiente cae a una estimación por fase lunar.
- **Luna:** cálculo de luna media (error de unas horas). Para horas exactas de salida y puesta de la Luna, usa un cálculo astronómico completo.
- **Escenarios:** el margen indica cuánto puede variar la previsión según el modelo de conjunto; no es una probabilidad calibrada. Si Open-Meteo cambia el formato de las variables de cada miembro, la tabla sigue mostrando solo la previsión central y lo indica.
- **Valoración de pesca:** es una heurística y no garantiza capturas. Sus pesos y límites no están calibrados con datos de capturas. La previsión pierde precisión con los días: las horas más lejanas son orientativas.
- **Pesos estimados:** el error habitual es de ±30 %.
- **Zonas de especies:** el catálogo cubre sobre todo la costa española y tiene pocas especies en Canarias. El agua dulce y el interior no están incluidos.
- **Fotos:** se guardan en localStorage reducidas a 800 px. El navegador limita este espacio (unos 5 MB). Si no cabe, la captura se guarda sin foto.
- **Idiomas:** las traducciones distintas del castellano son automáticas y no están revisadas por hablantes nativos. El catálogo de especies, las tallas y las vedas siguen en castellano y solo existen para España.
- **Datos locales:** las capturas solo existen en este navegador. Exporta el JSON para tener copias de seguridad.

## Fuentes y créditos

- Datos meteorológicos: [Open-Meteo](https://open-meteo.com) (licencia CC BY 4.0).
- Geocodificación: [Nominatim](https://nominatim.org) y © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
- Constantes armónicas de marea: [`@neaps/tide-database`](https://github.com/openwatersio/tide-database) (código MIT; solo estaciones de dominio público o CC BY 4.0, cada una con su fuente).
- Modelo global de mareas: [EOT20](https://doi.org/10.17882/79489) de DGFI-TUM (Hart-Davis, M. G. et al., 2021, [Earth System Science Data 13, 3869–3884](https://doi.org/10.5194/essd-13-3869-2021); CC BY 4.0).
- Predictor armónico: [`@neaps/tide-predictor`](https://github.com/openwatersio/neaps) (MIT).
- Mareas opcionales: [WorldTides](https://www.worldtides.info) (requiere clave propia).
- Nombres científicos, tallas máximas y hábitat: [FishBase](https://www.fishbase.se) y [FAO FishFinder](https://www.fao.org/fishery/en/species).
- Normativa de referencia (consultada el 12/10/2026, según fuentes públicas): Reglamento (CE) n.º 850/98, anexo XII; Real Decreto 560/1995; Real Decreto 1615/2005; Real Decreto 347/2011; Reglamento (UE) 2019/1241 y Reglamento (UE) 2024/491. Las referencias concretas aparecen en el campo `sources` de cada especie.
