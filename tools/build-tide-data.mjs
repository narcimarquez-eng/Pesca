/**
 * Genera las teselas de datos de marea de PescaApp a partir de la base de datos
 * pública @neaps/tide-database (código MIT; cada estación indica su fuente y su
 * licencia).
 *
 * Qué hace:
 * 1. Toma las estaciones de marea aceptadas por el control de calidad de la base de datos.
 * 2. Descarta las que no permiten uso comercial (license.commercial_use === false): son
 *    las CC BY-NC 4.0 cuyos datos de origen lo restringen. Así todas las estaciones
 *    incluidas son de dominio público o CC BY 4.0.
 * 3. Descarta las que no pueden reproducir una predicción válida con el predictor.
 * 4. Reduce cada estación a sus constituyentes armónicos significativos.
 * 5. Agrupa las estaciones en teselas de 10° × 10° (js/data/tides/<lat>_<lon>.js) y
 *    escribe un manifiesto con las teselas existentes (js/data/tides/manifest.js).
 *
 * Uso: npm run build:tides
 * Los archivos generados se versionan en el repositorio; la app no necesita npm.
 */
import { createTidePredictor } from '@neaps/tide-predictor';
import { stations } from '@neaps/tide-database';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'js', 'data', 'tides');

/** Debe coincidir con config.tides.tileSizeDeg en js/config.js. */
const TILE_SIZE_DEG = 10;

/** Constituyentes con amplitud menor de 2 mm no cambian las predicciones de forma apreciable. */
const MIN_AMPLITUDE_M = 0.002;

const round = (value, decimals) => Number(value.toFixed(decimals));

/** Estaciones cuya licencia permite el uso comercial (dominio público o CC BY 4.0). */
const allowsCommercialUse = (station) => !(station.license && station.license.commercial_use === false);
const tileIndex = (value) => Math.floor(value / TILE_SIZE_DEG);

function toPredictorConstituents(constituents) {
  return constituents.map(([name, amplitude, phase]) => ({ name, amplitude, phase }));
}

function predictorOffset(datum) {
  return datum ? round(datum.MSL - datum.LAT, 3) : false;
}

/** Comprueba que el predictor produce una serie de extremos finita para esta estación. */
function canPredict(station) {
  try {
    const predictor = createTidePredictor(toPredictorConstituents(station.constituents), {
      offset: predictorOffset(station.datum),
    });
    const extremes = predictor.getExtremesPrediction({
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-01-03T00:00:00Z'),
    });
    return extremes.length >= 3 && extremes.every((extreme) => Number.isFinite(extreme.level));
  } catch (error) {
    return false;
  }
}

function compactStation(station) {
  const datums = station.datums || {};
  const hasDatum = typeof datums.LAT === 'number' && typeof datums.MSL === 'number';
  return {
    id: station.id,
    name: station.name,
    lat: round(station.latitude, 4),
    lon: round(station.longitude, 4),
    country: station.country_code || null,
    tz: station.timezone || null,
    source: station.source && station.source.name ? station.source.name : 'Fuente no indicada',
    sourceUrl: station.source && station.source.url ? station.source.url : null,
    license: station.license && station.license.type ? station.license.type : 'desconocida',
    datum: hasDatum ? { LAT: round(datums.LAT, 3), MSL: round(datums.MSL, 3) } : null,
    constituents: station.harmonic_constituents
      .filter((item) => Math.abs(item.amplitude) >= MIN_AMPLITUDE_M)
      .map((item) => [item.name, round(item.amplitude, 4), round(item.phase, 2)]),
  };
}

async function main() {
  const tideStations = stations.filter(
    (station) =>
      station.kind === 'tide' &&
      Array.isArray(station.harmonic_constituents) &&
      station.harmonic_constituents.length > 0
  );
  const candidates = tideStations.filter(allowsCommercialUse);

  const tiles = new Map();
  let rejected = 0;
  for (const station of candidates) {
    const compact = compactStation(station);
    if (compact.constituents.length < 3 || !canPredict(compact)) {
      rejected += 1;
      continue;
    }
    const key = `${tileIndex(compact.lat)}_${tileIndex(compact.lon)}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(compact);
  }

  // Regenera la carpeta completa para no dejar teselas antiguas.
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const file of await readdir(OUTPUT_DIR)) {
    if (file.endsWith('.js')) await rm(path.join(OUTPUT_DIR, file));
  }

  const header = [
    '/* Generado por tools/build-tide-data.mjs. No editar a mano.',
    ' * Constantes armónicas de estaciones de marea: base de datos @neaps/tide-database (código MIT).',
    ' * Cada estación indica su fuente y su licencia (CC BY 4.0 o dominio público).',
    ' * Ver el README, apartado "Atribución y licencias".',
    ' */',
  ].join('\n');

  const keys = [...tiles.keys()].sort();
  let totalBytes = 0;
  for (const key of keys) {
    const body = `${header}
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideTiles = PescaApp.tideTiles || {};
  PescaApp.tideTiles[${JSON.stringify(key)}] = ${JSON.stringify(tiles.get(key))};
})(typeof window !== 'undefined' ? window : globalThis);
`;
    totalBytes += Buffer.byteLength(body);
    await writeFile(path.join(OUTPUT_DIR, `${key}.js`), body, 'utf8');
  }

  const manifest = `${header}
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideManifest = Object.freeze(${JSON.stringify(keys)});
})(typeof window !== 'undefined' ? window : globalThis);
`;
  await writeFile(path.join(OUTPUT_DIR, 'manifest.js'), manifest, 'utf8');

  const stationCount = [...tiles.values()].reduce((sum, list) => sum + list.length, 0);
  console.log(`Estaciones de marea: ${tideStations.length}; sin uso comercial (excluidas): ${tideStations.length - candidates.length}`);
  console.log(`Estaciones candidatas: ${candidates.length}`);
  console.log(`Descartadas por el predictor o por tener pocos constituyentes: ${rejected}`);
  console.log(`Estaciones incluidas: ${stationCount} en ${keys.length} teselas (${(totalBytes / 1e6).toFixed(2)} MB).`);
}

await main();
