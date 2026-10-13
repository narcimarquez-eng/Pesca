'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const App = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const TILE_FOLDER = path.join(ROOT, 'js', 'data', 'tides');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Predictor vendorizado y manifiesto de teselas, como en index.html.
require(path.join(ROOT, 'js', 'vendor', 'tide-predictor.js'));
require(path.join(TILE_FOLDER, 'manifest.js'));

const { tides, utils } = App;

/** Carga en Node las teselas que rodean a un punto (en el navegador lo hace loadStationsNear). */
function loadTilesAround(lat, lon) {
  tides.tileKeysAround(lat, lon).forEach((key) => require(path.join(TILE_FOLDER, `${key}.js`)));
}

/** Solo licencias que permiten el uso comercial: las CC BY-NC 4.0 se excluyen al generar las teselas. */
const ALLOWED_LICENSES = new Set(['cc-by-4.0', 'public domain']);

test('wrapLonIndex lleva los índices de longitud al rango [-18, 18) (antimeridiano)', () => {
  assert.equal(tides.wrapLonIndex(0), 0);
  assert.equal(tides.wrapLonIndex(18), -18);
  assert.equal(tides.wrapLonIndex(-19), 17);
  assert.equal(tides.wrapLonIndex(17), 17);
});

test('tileKeysAround incluye la tesela del punto y solo teselas del manifiesto', () => {
  const keys = tides.tileKeysAround(42.2406, -8.7207);
  assert.ok(keys.includes('4_-1'), `teselas: ${keys.join(', ')}`);
  keys.forEach((key) => assert.ok(App.tideManifest.includes(key), `tesela fuera del manifiesto: ${key}`));
  assert.equal(new Set(keys).size, keys.length, 'hay teselas repetidas');
});

test('describeLicense traduce las licencias de la base de datos', () => {
  assert.equal(tides.describeLicense('cc-by-4.0'), 'CC BY 4.0');
  assert.equal(tides.describeLicense('cc-by-nc-4.0'), 'CC BY-NC 4.0');
  assert.equal(tides.describeLicense('public domain'), 'Dominio público');
});

test('la fuente por defecto es la predicción armónica (sin registro)', () => {
  assert.equal(tides.getSource(), tides.SOURCE_HARMONIC);
});

test('findNearestStation elige una estación cercana a la costa de Vigo', () => {
  loadTilesAround(42.2406, -8.7207);
  const candidates = App.tideTiles['4_-1'];
  const found = tides.findNearestStation(42.2406, -8.7207, candidates);
  assert.ok(found, 'no se encontró estación');
  assert.ok(found.distanceKm < 10, `distancia ${found.distanceKm} km`);
  assert.equal(typeof found.station.name, 'string');
});

test('findNearestStation devuelve null en el interior (Madrid), fuera del radio de 60 km', () => {
  loadTilesAround(40.4168, -3.7038);
  const found = tides.findNearestStation(40.4168, -3.7038, App.tideTiles['4_-1']);
  assert.equal(found, null);
});

test('la predicción de A Coruña tiene pleamares y bajamares plausibles sobre LAT', () => {
  loadTilesAround(43.3623, -8.4115);
  const found = tides.findNearestStation(43.3623, -8.4115, App.tideTiles['4_-1']);
  assert.ok(found && found.distanceKm < 5, 'estación de A Coruña no encontrada');

  const predictor = tides.createStationPredictor(found.station);
  const start = Date.UTC(2026, 9, 12);
  const { heights, extremes } = tides.predictWindow(predictor, start, start + 3 * DAY_MS);

  // Unos cuatro extremos al día: 12 en tres días.
  assert.ok(extremes.length >= 11 && extremes.length <= 13, `extremos: ${extremes.length}`);
  // Alternan pleamar y bajamar.
  assert.ok(extremes.every((extreme, index) => index === 0 || extreme.type !== extremes[index - 1].type));
  // Separación entre extremos cercana a 6 h 12 min (entre 5,5 h y 6,9 h).
  for (let index = 1; index < extremes.length; index += 1) {
    const gapH = (extremes[index].ts - extremes[index - 1].ts) / HOUR_MS;
    assert.ok(gapH > 5.5 && gapH < 6.9, `separación ${gapH.toFixed(2)} h`);
  }
  // Alturas sobre LAT: pleamares por encima de las bajamares y en rango razonable para este puerto.
  const highs = extremes.filter((extreme) => extreme.type === 'high').map((extreme) => extreme.height);
  const lows = extremes.filter((extreme) => extreme.type === 'low').map((extreme) => extreme.height);
  assert.ok(Math.min(...highs) > Math.max(...lows), 'las pleamares deben estar por encima de las bajamares');
  assert.ok(Math.max(...highs) < 5 && Math.min(...lows) > -0.5, `rango ${Math.min(...lows)}..${Math.max(...highs)}`);
  // Serie de alturas cada 10 minutos: 37 puntos en 6 horas, igual que el predictor de referencia.
  const sixHours = predictor.getTimelinePrediction({ start: new Date(start), end: new Date(start + 6 * HOUR_MS), timeFidelity: 600 });
  assert.equal(sixHours.length, 37);
  assert.ok(heights.length > 400, `puntos de altura: ${heights.length}`);
});

test('getHarmonicWindow devuelve la estación, su licencia y la referencia de alturas', async () => {
  const lat = 43.3623;
  const lon = -8.4115;
  loadTilesAround(lat, lon);
  const startMs = Date.UTC(2026, 9, 12);
  const result = await tides.getHarmonicWindow({ lat, lon, startMs, endMs: startMs + 2 * DAY_MS });
  assert.ok(result.heights.length > 0 && result.extremes.length > 0);
  assert.equal(result.station.distanceKm < 5, true);
  assert.match(result.station.referenceLabel, /LAT/);
  assert.ok(['CC BY 4.0', 'Dominio público'].includes(result.station.licenseLabel));
  assert.equal(result.coversStartMs, startMs);
});

test('getHarmonicWindow lanza el código no-station cuando no hay estación cerca', async () => {
  loadTilesAround(40.4168, -3.7038);
  await assert.rejects(
    tides.getHarmonicWindow({ lat: 40.4168, lon: -3.7038, startMs: Date.UTC(2026, 9, 12), endMs: Date.UTC(2026, 9, 13) }),
    (error) => error.code === 'no-station' && /60 km/.test(error.message)
  );
});

test('getHistoricalTides devuelve la marea de una captura pasada sin necesidad de clave', async () => {
  const lat = 43.3623;
  const lon = -8.4115;
  loadTilesAround(lat, lon);
  const catchTime = new Date(Date.UTC(2025, 5, 1, 10, 30));
  const tideWindow = await tides.getHistoricalTides(lat, lon, '', catchTime);
  assert.ok(tideWindow, 'no se devolvió ventana de marea');
  assert.ok(tideWindow.station && tideWindow.station.name);
  const snapshot = tides.buildTideSnapshot(tideWindow, catchTime.getTime(), 90);
  assert.equal(typeof snapshot.heightM, 'number');
  assert.equal(snapshot.station.name, tideWindow.station.name);
});

test('todas las teselas generadas son válidas: id únicos, licencias de uso comercial y ubicación coherente', () => {
  const files = fs.readdirSync(TILE_FOLDER).filter((file) => /^-?\d+_-?\d+\.js$/.test(file));
  assert.equal(files.length, App.tideManifest.length, 'el manifiesto no coincide con los archivos');
  const ids = new Set();
  let stations = 0;
  for (const file of files) {
    const key = file.replace(/\.js$/, '');
    require(path.join(TILE_FOLDER, file));
    const [latIndex, lonIndex] = key.split('_').map(Number);
    for (const station of App.tideTiles[key]) {
      stations += 1;
      assert.ok(!ids.has(station.id), `id repetido: ${station.id}`);
      ids.add(station.id);
      assert.ok(ALLOWED_LICENSES.has(station.license), `licencia no reconocida: ${station.license}`);
      assert.equal(Math.floor(station.lat / 10), latIndex, `latitud fuera de la tesela: ${station.id}`);
      assert.equal(Math.floor(station.lon / 10), lonIndex, `longitud fuera de la tesela: ${station.id}`);
      assert.ok(station.constituents.length >= 3, `pocos constituyentes: ${station.id}`);
      if (station.datum) {
        assert.ok(Number.isFinite(station.datum.LAT) && Number.isFinite(station.datum.MSL), station.id);
      }
    }
  }
  assert.ok(stations > 5800, `estaciones: ${stations}`);
});
