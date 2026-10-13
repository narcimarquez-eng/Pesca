'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const App = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const STATION_FOLDER = path.join(ROOT, 'js', 'data', 'tides');
const MODEL_FOLDER = path.join(ROOT, 'js', 'data', 'tides-model');
const DAY_MS = 24 * 60 * 60 * 1000;

// Predictor vendorizado y manifiestos de teselas, como en index.html.
require(path.join(ROOT, 'js', 'vendor', 'tide-predictor.js'));
require(path.join(STATION_FOLDER, 'manifest.js'));
require(path.join(MODEL_FOLDER, 'manifest.js'));

const { tides } = App;
const lib = () => import('../tools/tide-model-lib.mjs');

/** Carga en Node las teselas de estaciones y de modelo alrededor de un punto (en el navegador lo hace la app). */
function loadAround(lat, lon) {
  tides.tileKeysAround(lat, lon).forEach((key) => require(path.join(STATION_FOLDER, `${key}.js`)));
  tides
    .modelTileKeysNear(lat, lon, App.config.tides.modelMaxDistanceKm)
    .forEach((key) => require(path.join(MODEL_FOLDER, `${key}.js`)));
}

test('oceanMask descarta la tierra (ceros), los valores de relleno y los que no son números', async () => {
  const { oceanMask } = await lib();
  const amplitude = [120, 0, 35, NaN, -9999, 80];
  const phase = [80, 0, 0, 10, 20, 400];
  assert.deepEqual(Array.from(oceanMask(amplitude, phase, [-9999])), [1, 0, 0, 0, 0, 1]);
});

test('coastalCells marca solo el océano que toca tierra, con la longitud cíclica si la rejilla da la vuelta', async () => {
  const { coastalCells } = await lib();
  // 3 filas × 4 columnas; tierra en la fila 1, columna 0.
  const mask = Uint8Array.from([1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1]);
  const flat = coastalCells(mask, { nLat: 3, nLon: 4 }).map(({ i, j }) => `${i},${j}`);
  assert.deepEqual(flat, ['0,0', '0,1', '1,1', '2,0', '2,1']);
  const wrapped = coastalCells(mask, { nLat: 3, nLon: 4, wrapsLon: true }).map(({ i, j }) => `${i},${j}`);
  assert.deepEqual(wrapped, ['0,0', '0,1', '0,3', '1,1', '1,3', '2,0', '2,1', '2,3']);
});

test('nearestStation encuentra la estación más cercana dentro del radio, también al otro lado del antimeridiano', async () => {
  const { buildStationIndex, nearestStation } = await lib();
  const index = buildStationIndex([
    { id: 'este', lat: 0, lon: 179.9 },
    { id: 'oeste', lat: 0, lon: -179.8 },
    { id: 'lejos', lat: 10, lon: 0 },
  ]);
  // A -179,98°: 0,12° hasta 179,9° (unos 13 km) y 0,18° hasta -179,8° (unos 20 km).
  const found = nearestStation(index, 0, -179.98, 50);
  assert.equal(found.station.id, 'este');
  assert.ok(found.distanceKm > 12 && found.distanceKm < 15, `distancia ${found.distanceKm} km`);
  assert.equal(nearestStation(index, 5, 0, 100), null, 'nada a menos de 100 km');
});

test('encodePoint y decodePoint conservan amplitudes y fases redondeadas y omiten las de menos de 2 mm', async () => {
  const { encodePoint, decodePoint } = await lib();
  const point = encodePoint(43.625, 354.375, [1.2345, 0.0015, 0.4], [77.6, 10, -30.2]);
  assert.deepEqual(point, [43.625, -5.625, 1235, 0, 400, 78, 0, 330]);
  assert.deepEqual(decodePoint(point, ['M2', 'MF', 'S2']), [
    ['M2', 1.235, 78],
    ['S2', 0.4, 330],
  ]);
});

test('tileKey usa la tesela que contiene el punto, también con coordenadas negativas', async () => {
  const { tileKey } = await lib();
  assert.equal(tileKey(43.6, -5.7, 5), '8_-2');
  assert.equal(tileKey(-0.1, 359.9, 5), '-1_-1');
});

test('modelTileKeysNear: una tesela lejos del borde, varias cerca y al cruzar el antimeridiano', () => {
  const saved = App.tideModelManifest;
  App.tideModelManifest = ['8_-2', '8_-3', '9_-2', '9_-3', '0_35', '0_-36'];
  try {
    assert.deepEqual(tides.modelTileKeysNear(42.5, -7.5, 20), ['8_-2']);
    assert.deepEqual(tides.modelTileKeysNear(44.95, -9.99, 20).sort(), ['8_-2', '8_-3', '9_-2', '9_-3']);
    assert.deepEqual(tides.modelTileKeysNear(2, 179.95, 20).sort(), ['0_-36', '0_35']);
  } finally {
    App.tideModelManifest = saved;
  }
});

test('modelPointsOf convierte los puntos en estaciones sin datum, con la fuente y la licencia del modelo', () => {
  App.tideModelTiles = App.tideModelTiles || {};
  App.tideModelTiles.prueba = {
    model: 'eot20',
    name: 'EOT20',
    source: 'DGFI-TUM',
    sourceUrl: 'https://doi.org/10.17882/79489',
    license: 'cc-by-4.0',
    constituents: ['M2', 'S2', 'K1'],
    points: [[43.625, -5.625, 1290, 0, 75, 88, 0, 70]],
  };
  try {
    const [point] = tides.modelPointsOf('prueba');
    assert.equal(point.id, 'eot20/43.625/-5.625');
    assert.equal(point.model, 'eot20');
    assert.equal(point.datum, null);
    assert.equal(point.tz, null);
    assert.deepEqual(point.constituents, [
      ['M2', 1.29, 88],
      ['K1', 0.075, 70],
    ]);
    const described = tides.describeStation(point, 7.2);
    assert.equal(described.isModel, true);
    assert.equal(described.licenseLabel, 'CC BY 4.0');
    assert.match(described.referenceLabel, /nivel medio/);
  } finally {
    delete App.tideModelTiles.prueba;
  }
});

test('Gijón no tiene estación libre a menos de 60 km: usa el punto de EOT20 con la hora de la península', async () => {
  const gijon = { lat: 43.545, lon: -5.663 };
  loadAround(gijon.lat, gijon.lon);
  const { station, distanceKm, predictor } = await tides.resolveHarmonicStation(gijon.lat, gijon.lon, { countryCode: 'es' });
  assert.equal(station.model, 'eot20');
  assert.ok(distanceKm <= App.config.tides.modelMaxDistanceKm, `distancia ${distanceKm} km`);
  assert.equal(station.tz, 'Europe/Madrid');
  const start = Date.UTC(2026, 9, 13);
  const { extremes } = tides.predictWindow(predictor, start, start + 2 * DAY_MS);
  assert.ok(extremes.length >= 7 && extremes.length <= 9, `extremos: ${extremes.length}`);
  const highs = extremes.filter((extreme) => extreme.type === 'high').map((extreme) => extreme.height);
  const lows = extremes.filter((extreme) => extreme.type === 'low').map((extreme) => extreme.height);
  // Marea del Cantábrico: más de 2 m entre pleamar y bajamar a mediados de octubre.
  assert.ok(Math.max(...highs) - Math.min(...lows) > 2, `rango ${Math.min(...lows)}..${Math.max(...highs)}`);
});

test('En el sur de Tenerife usa EOT20 con la hora de Canarias, no la de la península', async () => {
  const losCristianos = { lat: 28.05, lon: -16.72 };
  loadAround(losCristianos.lat, losCristianos.lon);
  const { station } = await tides.resolveHarmonicStation(losCristianos.lat, losCristianos.lon, { countryCode: 'es' });
  assert.equal(station.model, 'eot20');
  assert.equal(station.tz, 'Atlantic/Canary');
});

test('Sevilla, a 65 km río arriba de la franja del modelo, sigue sin predicción armónica', async () => {
  const sevilla = { lat: 37.389, lon: -5.984 };
  loadAround(sevilla.lat, sevilla.lon);
  await assert.rejects(tides.resolveHarmonicStation(sevilla.lat, sevilla.lon, { countryCode: 'es' }), (error) => error.code === 'no-station');
});

test('Junto a una estación (Vigo) se usa la estación, no el modelo', async () => {
  const vigo = { lat: 42.2406, lon: -8.7207 };
  loadAround(vigo.lat, vigo.lon);
  const { station } = await tides.resolveHarmonicStation(vigo.lat, vigo.lon, { countryCode: 'es' });
  assert.equal(station.model, undefined);
  assert.equal(station.license === 'cc-by-4.0' || station.license === 'public domain', true);
});

test('modelTimeZone: con país conocido solo toma estaciones de ese país; sin país, la más cercana', () => {
  const stations = [
    { lat: 42.24, lon: -8.73, country: 'ES', tz: 'Europe/Madrid', constituents: [['M2', 1, 0], ['S2', 0.3, 0], ['K1', 0.1, 0]] },
    { lat: 38.7, lon: -9.4, country: 'PT', tz: 'Europe/Lisbon', constituents: [['M2', 1, 0], ['S2', 0.3, 0], ['K1', 0.1, 0]] },
  ];
  // Viana do Castelo: más cerca de Vigo (España) que de Lisboa, pero es Portugal.
  assert.equal(tides.modelTimeZone(41.69, -8.85, stations, 'pt'), 'Europe/Lisbon');
  assert.equal(tides.modelTimeZone(41.69, -8.85, stations, null), 'Europe/Madrid');
  assert.equal(tides.modelTimeZone(41.69, -8.85, stations, 'ma'), null, 'sin estaciones de ese país: la del dispositivo');
});

test('todas las teselas de modelo son válidas: manifiesto, ubicación, licencia y constituyentes conocidos', () => {
  const files = fs.readdirSync(MODEL_FOLDER).filter((file) => /^-?\d+_-?\d+\.js$/.test(file));
  assert.equal(files.length, App.tideModelManifest.length, 'el manifiesto no coincide con los archivos');
  const known = App.vendor.createTidePredictor.constituents;
  let points = 0;
  for (const file of files) {
    const key = file.replace(/\.js$/, '');
    require(path.join(MODEL_FOLDER, file));
    const tile = App.tideModelTiles[key];
    const [latIndex, lonIndex] = key.split('_').map(Number);
    assert.equal(tile.license, 'cc-by-4.0', key);
    tile.constituents.forEach((name) => assert.ok(name in known, `constituyente desconocido: ${name}`));
    const count = tile.constituents.length;
    for (const point of tile.points) {
      points += 1;
      assert.equal(point.length, 2 + 2 * count, `${key}: longitud del punto`);
      assert.equal(Math.floor(point[0] / 5), latIndex, `${key}: latitud fuera de la tesela`);
      assert.equal(Math.floor(point[1] / 5), lonIndex, `${key}: longitud fuera de la tesela`);
      const amplitudes = point.slice(2, 2 + count);
      const phases = point.slice(2 + count);
      assert.ok(amplitudes.filter((value) => value > 0).length >= 3, `${key}: pocos constituyentes`);
      assert.ok(amplitudes.every((value) => Number.isInteger(value) && value >= 0), `${key}: amplitud no válida`);
      assert.ok(phases.every((value) => Number.isInteger(value) && value >= 0 && value < 360), `${key}: fase no válida`);
    }
  }
  assert.ok(points > 50000, `puntos: ${points}`);
});
