'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const App = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const TILE_FOLDER = path.join(ROOT, 'js', 'data', 'tides');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

require(path.join(ROOT, 'js', 'vendor', 'tide-predictor.js'));
require(path.join(TILE_FOLDER, 'manifest.js'));

const { tides } = App;
const CORUNA = { lat: 43.3623, lon: -8.4115, tz: 'Europe/Madrid' };

/** Carga en Node las teselas que rodean a un punto (en el navegador lo hace loadStationsNear). */
function loadTilesAround(lat, lon) {
  tides.tileKeysAround(lat, lon).forEach((key) => require(path.join(TILE_FOLDER, `${key}.js`)));
}

/** Estación de La Coruña (la de la base de datos aceptada por el control de calidad). */
function corunaPredictor() {
  loadTilesAround(CORUNA.lat, CORUNA.lon);
  const found = tides.findNearestStation(CORUNA.lat, CORUNA.lon, App.tideTiles['4_-1']);
  return { station: found.station, predictor: tides.createStationPredictor(found.station) };
}

test('localDateKey usa la fecha local de la estación, no la del instante en UTC', () => {
  // 23:30 UTC del 12 de octubre son las 01:30 del 13 en Madrid (UTC+2 en octubre).
  assert.equal(tides.localDateKey(Date.UTC(2026, 9, 12, 23, 30), 'Europe/Madrid'), '2026-10-13');
  assert.equal(tides.localDateKey(Date.UTC(2026, 9, 12, 23, 30), 'UTC'), '2026-10-12');
});

test('una zona horaria no válida cae a la del dispositivo sin lanzar error', () => {
  assert.equal(tides.safeTimeZone('Zona/Inventada'), undefined);
  assert.match(tides.localDateKey(Date.UTC(2026, 9, 12), 'Zona/Inventada'), /^\d{4}-\d{2}-\d{2}$/);
});

test('groupExtremesByDay calcula la amplitud del día como pleamar más alta menos bajamar más baja', () => {
  const day = [
    { ts: Date.UTC(2026, 9, 12, 4), height: 3.5, type: 'high' },
    { ts: Date.UTC(2026, 9, 12, 10), height: 0.6, type: 'low' },
    { ts: Date.UTC(2026, 9, 12, 16), height: 3.1, type: 'high' },
    { ts: Date.UTC(2026, 9, 12, 22), height: 0.9, type: 'low' },
  ];
  const [group] = tides.groupExtremesByDay(day, 'UTC');
  assert.equal(group.key, '2026-10-12');
  assert.ok(Math.abs(group.amplitudeM - 2.9) < 1e-9, `amplitud ${group.amplitudeM}`);
});

test('coefficientFor sitúa 70 en la marea media y escala proporcionalmente', () => {
  assert.equal(tides.coefficientFor(2.5, 2.5), 70);
  assert.equal(tides.coefficientFor(5, 2.5), 140);
  assert.equal(tides.coefficientFor(null, 2.5), null);
  assert.equal(tides.coefficientFor(2, 0), null);
});

test('la marea media de La Coruña ronda 2,5 m y la tabla diaria tiene 7 días con coeficientes', () => {
  const { predictor, station } = corunaPredictor();
  const nowMs = Date.UTC(2026, 9, 12, 12);
  const daily = tides.buildDailyTable(predictor, { timeZone: station.tz, stationId: station.id, nowMs });
  assert.ok(daily.meanAmplitudeM > 2.0 && daily.meanAmplitudeM < 3.2, `media ${daily.meanAmplitudeM}`);
  assert.equal(daily.days.length, tides.DAILY_TABLE_DAYS);
  assert.equal(daily.todayCoefficient, daily.days[0].coefficient);
  daily.days.forEach((day) => {
    assert.match(day.dateKey, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isInteger(day.coefficient) && day.coefficient >= 20 && day.coefficient <= 130, `coef ${day.coefficient}`);
    assert.ok(day.extremes.length >= 3, `extremos del día ${day.dateKey}: ${day.extremes.length}`);
  });
  // Los días son consecutivos y empiezan por hoy en la zona de la estación.
  assert.equal(daily.days[0].dateKey, tides.localDateKey(nowMs, station.tz));
});

test('el coeficiente armónico del año tiene media 70 y sigue el ciclo de mareas vivas y muertas', () => {
  const { predictor } = corunaPredictor();
  const center = Date.UTC(2026, 9, 12, 12);
  const days = tides
    .groupExtremesByDay(tides.predictExtremes(predictor, center - 182 * DAY_MS, center + 183 * DAY_MS), CORUNA.tz)
    .filter((day) => day.amplitudeM !== null);
  const meanAmplitude = days.reduce((sum, day) => sum + day.amplitudeM, 0) / days.length;
  const harmonic = days.map((day) => tides.coefficientFor(day.amplitudeM, meanAmplitude));
  const approx = days.map((day) => tides.estimateCoefficient(new Date(Date.parse(`${day.key}T12:00:00Z`))));

  const average = harmonic.reduce((sum, value) => sum + value, 0) / harmonic.length;
  assert.ok(Math.abs(average - 70) < 1, `media del coeficiente: ${average}`);
  assert.ok(Math.min(...harmonic) < 40 && Math.max(...harmonic) > 95, 'debe haber mareas muertas y vivas');

  // Correlación con la estimación por fase lunar: ambas siguen el mismo ciclo de 14,8 días.
  const n = harmonic.length;
  const meanH = average;
  const meanA = approx.reduce((sum, value) => sum + value, 0) / n;
  let covariance = 0;
  let varianceH = 0;
  let varianceA = 0;
  for (let index = 0; index < n; index += 1) {
    covariance += (harmonic[index] - meanH) * (approx[index] - meanA);
    varianceH += (harmonic[index] - meanH) ** 2;
    varianceA += (approx[index] - meanA) ** 2;
  }
  const correlation = covariance / Math.sqrt(varianceH * varianceA);
  assert.ok(correlation > 0.6, `correlación con la fase lunar: ${correlation.toFixed(3)}`);
});

test('la vista en vivo lleva el coeficiente de hoy y la tabla diaria', async () => {
  loadTilesAround(CORUNA.lat, CORUNA.lon);
  const now = new Date(Date.UTC(2026, 9, 12, 12));
  // Sin clave ni ajuste guardado, la fuente por defecto es la predicción armónica.
  const live = await tides.getLiveTides(CORUNA.lat, CORUNA.lon, '', now);
  assert.equal(live.method, tides.SOURCE_HARMONIC);
  assert.equal(live.station.timeZone, 'Europe/Madrid');
  assert.ok(live.heights.length > 100);
  assert.equal(live.daily.days.length, tides.DAILY_TABLE_DAYS);
  assert.equal(live.coefficient, live.daily.todayCoefficient);
  assert.ok(Number.isInteger(live.coefficient));
});

test('buildTideSnapshot toma el coeficiente armónico cuando la ventana lo trae', () => {
  const now = Date.UTC(2026, 9, 12, 12);
  const tideWindow = {
    heights: [{ ts: now - HOUR_MS, height: 1 }, { ts: now + HOUR_MS, height: 2 }],
    extremes: [{ ts: now + 2 * HOUR_MS, height: 3, type: 'high' }],
    coefficient: 88,
    station: null,
  };
  const snapshot = tides.buildTideSnapshot(tideWindow, now);
  assert.equal(snapshot.coefficient, 88);
  assert.equal(snapshot.coefficientSource, 'harmonic');

  const withoutCoefficient = tides.buildTideSnapshot({ ...tideWindow, coefficient: undefined }, now);
  assert.equal(withoutCoefficient.coefficient, null);
  assert.equal(withoutCoefficient.coefficientSource, null);
});

test('la fuente del coeficiente se guarda como código y su texto se traduce al mostrarlo', () => {
  assert.equal(tides.COEFFICIENT_SOURCE.HARMONIC, 'harmonic');
  assert.equal(tides.describeCoefficientSource('harmonic'), 'predicción armónica');
  assert.equal(tides.describeCoefficientSource('predicción armónica'), 'predicción armónica', 'registros antiguos');
  assert.equal(tides.describeCoefficientSource('moon'), 'fase lunar (aprox.)');
  assert.equal(tides.describeCoefficientSource('fase lunar (aprox.)'), 'fase lunar (aprox.)');
  assert.equal(tides.describeCoefficientSource(null), null);
});
