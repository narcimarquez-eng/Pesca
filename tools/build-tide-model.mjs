/**
 * Genera los «puntos de modelo» de marea de PescaApp a partir del modelo global EOT20
 * (DGFI-TUM, licencia CC BY 4.0, https://doi.org/10.17882/79489).
 *
 * Para qué: la app predice la marea con la estación más cercana. Donde no hay ninguna
 * estación con licencia de uso comercial cerca, usa estos puntos: las constantes
 * armónicas del modelo en la franja de océano más cercana a la costa.
 *
 * Qué hace:
 * 1. Lee la rejilla de M2 y marca las celdas de océano que tocan tierra (franja costera).
 * 2. Descarta las celdas a menos de SKIP_NEAR_STATION_KM de una estación de la app: ahí
 *    la app siempre usa la estación, así que el punto nunca se usaría.
 * 3. Lee los constituyentes en esas celdas (amplitud en cm → m, fase en grados).
 * 4. Descarta los puntos en los que el predictor no da extremos válidos.
 * 5. Escribe teselas de 5° × 5° (js/data/tides-model/<lat>_<lon>.js) y su manifiesto.
 *
 * Datos: descarga EOT20 de https://www.seanoe.org/data/00683/79489/ y descomprime la
 * carpeta ocean_tides (ficheros <constituyente>_ocean_eot20.nc). Esos ficheros no se
 * versionan; solo se versionan las teselas generadas.
 *
 * Uso: npm run build:tide-model -- ruta/a/EOT20/ocean_tides [--out carpeta]
 * Con --out, las teselas se escriben en otra carpeta (para pruebas).
 */
import { createTidePredictor } from '@neaps/tide-predictor';
import { stations } from '@neaps/tide-database';
import * as h5wasm from 'h5wasm/node';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStationIndex,
  coastalCells,
  decodePoint,
  encodePoint,
  nearestStation,
  normalizeLon,
  oceanMask,
  tileKey,
} from './tide-model-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'js', 'data', 'tides-model');

/** Debe coincidir con config.tides.modelTileSizeDeg en js/config.js. */
const TILE_SIZE_DEG = 5;

/**
 * La app usa una estación si hay alguna a menos de stationMaxDistanceKm (60 km) y, si no,
 * el punto de modelo más cercano a menos de modelMaxDistanceKm (20 km), según js/config.js.
 * Un punto a menos de 60 − 20 = 40 km de una estación nunca se elegiría: cualquier lugar a
 * 20 km de él tiene esa estación a menos de 60 km.
 */
const SKIP_NEAR_STATION_KM = 40;

/** Metadatos comunes de todos los puntos (se guardan una vez por tesela). */
const MODEL_META = Object.freeze({
  model: 'eot20',
  name: 'EOT20',
  source: 'DGFI-TUM',
  sourceUrl: 'https://doi.org/10.17882/79489',
  license: 'cc-by-4.0',
});

/** Escala de las amplitudes a metros según la unidad del fichero (EOT20 usa cm). */
const UNIT_SCALE = Object.freeze({ cm: 0.01, centimeters: 0.01, m: 1, meters: 1, mm: 0.001 });

/** Valor escalar de un atributo HDF5, o undefined. */
function attribute(dataset, name) {
  const attr = dataset.attrs && dataset.attrs[name];
  if (!attr) return undefined;
  const value = attr.value;
  return value !== null && typeof value === 'object' && 'length' in value ? value[0] : value;
}

/**
 * Lee una rejilla de amplitud y fase. Devuelve los valores en orden [lat][lon], la
 * escala de la amplitud a metros y los valores de relleno.
 */
function readGrid(file) {
  const handle = new h5wasm.File(file, 'r');
  try {
    const lat = Array.from(handle.get('lat').value);
    const lon = Array.from(handle.get('lon').value);
    const amplitudeSet = handle.get('amplitude');
    const phaseSet = handle.get('phase');
    let amplitude = amplitudeSet.value;
    let phase = phaseSet.value;
    const [rows, cols] = amplitudeSet.shape;
    if (rows === lon.length && cols === lat.length && rows !== cols) {
      // Rejilla en orden [lon][lat]: se traspone para trabajar siempre en [lat][lon].
      const transpose = (values) => {
        const out = new Float64Array(values.length);
        for (let j = 0; j < lon.length; j += 1) {
          for (let i = 0; i < lat.length; i += 1) out[i * lon.length + j] = values[j * lat.length + i];
        }
        return out;
      };
      amplitude = transpose(amplitude);
      phase = transpose(phase);
    } else if (rows !== lat.length || cols !== lon.length) {
      throw new Error(`${path.basename(file)}: forma ${rows}×${cols} incompatible con lat ${lat.length} y lon ${lon.length}`);
    }
    const units = String(attribute(amplitudeSet, 'units') || 'cm').trim().toLowerCase();
    if (!(units in UNIT_SCALE)) throw new Error(`${path.basename(file)}: unidad de amplitud desconocida "${units}"`);
    const fills = [
      attribute(amplitudeSet, '_FillValue'),
      attribute(amplitudeSet, 'missing_value'),
      attribute(phaseSet, '_FillValue'),
      attribute(phaseSet, 'missing_value'),
    ].map(Number);
    return { lat, lon, amplitude, phase, scale: UNIT_SCALE[units], fills };
  } finally {
    handle.close();
  }
}

/** Columnas útiles: si la última repite la primera (0° y 360°), se ignora. */
function usableColumns(lon) {
  const step = Math.abs(lon[1] - lon[0]);
  const duplicated = lon.length > 2 && Math.abs(Math.abs(lon[lon.length - 1] - lon[0]) - 360) < step / 2;
  const nLon = duplicated ? lon.length - 1 : lon.length;
  return { nLon, wrapsLon: Math.abs(nLon * step - 360) < step / 2 };
}

/** Comprueba que el predictor produce extremos finitos con estos constituyentes. */
function canPredict(constituents) {
  try {
    const predictor = createTidePredictor(
      constituents.map(([name, amplitude, phase]) => ({ name, amplitude, phase })),
      { offset: false }
    );
    const extremes = predictor.getExtremesPrediction({
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-01-03T00:00:00Z'),
    });
    return extremes.length >= 3 && extremes.every((extreme) => Number.isFinite(extreme.level));
  } catch (error) {
    return false;
  }
}

/** Constituyentes que conoce el predictor (velocidad y argumentos astronómicos). */
function predictorKnows(name) {
  return Boolean(createTidePredictor.constituents && name in createTidePredictor.constituents);
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const outputDir = outIndex === -1 ? OUTPUT_DIR : path.resolve(args[outIndex + 1]);
  const folder = args.find((arg, position) => !arg.startsWith('--') && (outIndex === -1 || position !== outIndex + 1));
  if (!folder) {
    console.error('Uso: npm run build:tide-model -- ruta/a/EOT20/ocean_tides [--out carpeta]');
    process.exit(1);
  }
  await h5wasm.ready;

  const files = (await readdir(folder)).filter((name) => /_ocean_eot20\.nc$/i.test(name)).sort();
  const constituentFiles = [];
  for (const file of files) {
    const name = file.split('_')[0].toUpperCase();
    if (predictorKnows(name)) constituentFiles.push({ name, file: path.join(folder, file) });
    else console.warn(`El predictor no conoce ${name}: se omite.`);
  }
  if (!constituentFiles.some((item) => item.name === 'M2')) throw new Error(`No hay fichero M2 en ${folder}`);

  // 1. Franja costera a partir de M2.
  const m2 = readGrid(constituentFiles.find((item) => item.name === 'M2').file);
  const { nLon, wrapsLon } = usableColumns(m2.lon);
  const stride = m2.lon.length;
  const mask = oceanMask(m2.amplitude, m2.phase, m2.fills);
  const coast = coastalCells(mask, { nLat: m2.lat.length, nLon, stride, wrapsLon });

  // 2. Fuera las celdas junto a una estación de la app (mismo filtro de licencia que build-tide-data).
  const appStations = stations
    .filter(
      (station) =>
        station.kind === 'tide' &&
        Array.isArray(station.harmonic_constituents) &&
        station.harmonic_constituents.length > 0 &&
        !(station.license && station.license.commercial_use === false)
    )
    .map((station) => ({ lat: station.latitude, lon: station.longitude }));
  const index = buildStationIndex(appStations);
  const selected = coast.filter(({ i, j }) => !nearestStation(index, m2.lat[i], normalizeLon(m2.lon[j]), SKIP_NEAR_STATION_KM));

  // 3. Constituyentes en las celdas elegidas.
  const names = constituentFiles.map((item) => item.name);
  const amplitudes = selected.map(() => new Array(names.length).fill(0));
  const phases = selected.map(() => new Array(names.length).fill(0));
  constituentFiles.forEach(({ name, file }, k) => {
    const grid = name === 'M2' ? m2 : readGrid(file);
    if (grid.lat.length !== m2.lat.length || grid.lon.length !== m2.lon.length) {
      throw new Error(`${path.basename(file)}: la rejilla no coincide con la de M2`);
    }
    const valid = oceanMask(grid.amplitude, grid.phase, grid.fills);
    selected.forEach(({ i, j }, n) => {
      const cell = i * stride + j;
      if (!valid[cell]) return;
      amplitudes[n][k] = grid.amplitude[cell] * grid.scale;
      phases[n][k] = grid.phase[cell];
    });
    console.log(`Leído ${name}`);
  });

  // 4 y 5. Puntos válidos agrupados en teselas.
  const tiles = new Map();
  let rejected = 0;
  selected.forEach(({ i, j }, n) => {
    const point = encodePoint(m2.lat[i], m2.lon[j], amplitudes[n], phases[n]);
    if (!canPredict(decodePoint(point, names))) {
      rejected += 1;
      return;
    }
    const key = tileKey(point[0], point[1], TILE_SIZE_DEG);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(point);
  });

  await mkdir(outputDir, { recursive: true });
  for (const file of await readdir(outputDir)) {
    if (file.endsWith('.js')) await rm(path.join(outputDir, file));
  }
  const header = [
    '/* Generado por tools/build-tide-model.mjs. No editar a mano.',
    ' * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.',
    ' * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.',
    ' * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.',
    ' */',
  ].join('\n');
  const keys = [...tiles.keys()].sort();
  let totalBytes = 0;
  for (const key of keys) {
    const tile = { ...MODEL_META, constituents: names, points: tiles.get(key) };
    const body = `${header}
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles[${JSON.stringify(key)}] = ${JSON.stringify(tile)};
})(typeof window !== 'undefined' ? window : globalThis);
`;
    totalBytes += Buffer.byteLength(body);
    await writeFile(path.join(outputDir, `${key}.js`), body, 'utf8');
  }
  const manifest = `${header}
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelManifest = Object.freeze(${JSON.stringify(keys)});
})(typeof window !== 'undefined' ? window : globalThis);
`;
  await writeFile(path.join(outputDir, 'manifest.js'), manifest, 'utf8');

  const pointCount = [...tiles.values()].reduce((sum, list) => sum + list.length, 0);
  console.log(`Constituyentes: ${names.join(', ')}`);
  console.log(`Celdas costeras: ${coast.length}; junto a una estación (omitidas): ${coast.length - selected.length}`);
  console.log(`Descartadas por el predictor: ${rejected}`);
  console.log(`Puntos incluidos: ${pointCount} en ${keys.length} teselas (${(totalBytes / 1e6).toFixed(2)} MB).`);
}

await main();
