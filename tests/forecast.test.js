'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const App = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const TILE_FOLDER = path.join(ROOT, 'js', 'data', 'tides');
const HOUR_MS = 60 * 60 * 1000;

require(path.join(ROOT, 'js', 'vendor', 'tide-predictor.js'));
require(path.join(TILE_FOLDER, 'manifest.js'));

const { weather, tides, forecast: hourlyForecast } = App;
const CORUNA = { lat: 43.3623, lon: -8.4115 };

/**
 * Respuesta sintética de Open-Meteo: un día pasado y cuatro de pronóstico, en hora
 * local de Madrid (UTC+2 en octubre). Las horas se escriben como texto local.
 */
function syntheticOpenMeteo({ weatherCode = 2, pressureAt = (index) => 1015 + Math.sin(index / 6) } = {}) {
  const start = Date.parse('2026-10-11T00:00:00Z');
  const hours = 120;
  const times = Array.from({ length: hours }, (_, index) => new Date(start + index * HOUR_MS).toISOString().slice(0, 16));
  const series = (fn) => times.map((_, index) => fn(index));
  return {
    timezone: 'Europe/Madrid',
    timezone_abbreviation: 'CEST',
    utc_offset_seconds: 7200,
    elevation: 12,
    current: {
      time: '2026-10-12T12:15',
      temperature_2m: 18,
      apparent_temperature: 17,
      relative_humidity_2m: 70,
      is_day: 1,
      precipitation: 0,
      weather_code: weatherCode,
      cloud_cover: 40,
      pressure_msl: 1015,
      wind_speed_10m: 12,
      wind_direction_10m: 240,
      wind_gusts_10m: 22,
    },
    hourly: {
      time: times,
      temperature_2m: series((index) => 14 + (index % 24) / 3),
      relative_humidity_2m: series(() => 75),
      precipitation: series(() => 0),
      weather_code: series(() => weatherCode),
      cloud_cover: series(() => 50),
      pressure_msl: series((index) => pressureAt(index)),
      wind_speed_10m: series(() => 12),
      wind_direction_10m: series(() => 240),
      wind_gusts_10m: series(() => 22),
      is_day: series((index) => (index % 24 >= 8 && index % 24 <= 20 ? 1 : 0)),
    },
    daily: {
      time: ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'],
      sunrise: Array(5).fill('2026-10-12T08:00'),
      sunset: Array(5).fill('2026-10-12T19:00'),
    },
  };
}

function syntheticForecast(options) {
  return weather.normalizeForecast(syntheticOpenMeteo(options));
}

/** Predictor y estación de La Coruña, cargando sus teselas como hace el navegador. */
function corunaTideState(nowMs) {
  tides.tileKeysAround(CORUNA.lat, CORUNA.lon).forEach((key) => require(path.join(TILE_FOLDER, `${key}.js`)));
  return tides.getLiveTides(CORUNA.lat, CORUNA.lon, '', new Date(nowMs));
}

test('localTimeToMs convierte la hora local del lugar en instante absoluto', () => {
  assert.equal(weather.localTimeToMs('2026-10-12T14:00', 7200), Date.UTC(2026, 9, 12, 12));
  assert.equal(weather.localTimeToMs('2026-10-12T14:00', 0), Date.UTC(2026, 9, 12, 14));
  assert.equal(weather.localTimeToMs('2026-10-12T14:00', undefined), Date.UTC(2026, 9, 12, 14));
  assert.equal(weather.localTimeToMs('no es una hora', 0), null);
});

test('normalizeForecast devuelve la serie horaria completa con la tendencia de presión de cada hora', () => {
  const forecast = syntheticForecast();
  const { hourly } = forecast;
  assert.equal(forecast.utcOffsetSeconds, 7200);
  assert.equal(hourly.times.length, 120);
  Object.values(hourly).forEach((values) => assert.equal(values.length, 120));

  assert.equal(hourly.pressureTrend3hHpa[0], null, 'sin tres horas de historia no hay tendencia');
  const expected = hourly.pressureHpa[50] - hourly.pressureHpa[47];
  assert.ok(Math.abs(hourly.pressureTrend3hHpa[50] - expected) <= 0.05, `tendencia ${hourly.pressureTrend3hHpa[50]}`);
  assert.equal(hourly.windGustsKmh[10], 22);
  assert.equal(hourly.isDay[12], 1);
});

test('waterValueAt busca la hora del dato dentro de la serie marina y devuelve null si no existe', () => {
  const series = { times: ['2026-10-12T14:00'], values: [17.4] };
  assert.equal(weather.waterValueAt(series, '2026-10-12T14:35'), 17.4);
  assert.equal(weather.waterValueAt(series, '2026-10-12T15:00'), null);
  assert.equal(weather.waterValueAt(null, '2026-10-12T14:00'), null);
});

test('la previsión tiene 72 filas, una por hora desde la hora actual, aunque sea tarde', () => {
  const forecast = syntheticForecast();
  const midday = hourlyForecast.buildForecastRows({ forecast, nowMs: Date.UTC(2026, 9, 12, 12, 30) });
  assert.equal(midday.length, 72);
  assert.equal(midday[0].hourText, '14:00', 'empieza en la hora que contiene la hora actual');
  assert.equal(midday[0].isCurrent, true);
  assert.equal(midday[1].isCurrent, false);
  midday.slice(1).forEach((row, index) => {
    assert.equal(row.ts - midday[index].ts, HOUR_MS);
  });
  assert.equal(midday[71].hourText, '13:00', '71 horas después, 15 de octubre a las 13:00');

  const lateEvening = hourlyForecast.buildForecastRows({ forecast, nowMs: Date.UTC(2026, 9, 12, 21, 10) });
  assert.equal(lateEvening.length, 72, 'con 4 días de pronóstico siempre hay 72 horas');
  assert.equal(lateEvening[0].hourText, '23:00');
});

test('cada fila de la previsión lleva tiempo, viento, presión, lluvia y valoración', () => {
  const forecast = syntheticForecast();
  const [first] = hourlyForecast.buildForecastRows({ forecast, nowMs: Date.UTC(2026, 9, 12, 12, 30) });
  assert.equal(first.dateKey, '2026-10-12');
  assert.equal(first.weather.label, 'Parcialmente nublado');
  assert.equal(first.windSpeedKmh, 12);
  assert.equal(first.windGustsKmh, 22);
  assert.equal(first.precipitationMm, 0);
  assert.equal(first.pressureHpa, forecast.hourly.pressureHpa[38]);
  assert.equal(first.pressureTrend3hHpa, forecast.hourly.pressureTrend3hHpa[38]);
  assert.ok(Number.isInteger(first.rating.score));
  assert.ok(first.rating.stars >= 1 && first.rating.stars <= 5);
});

test('sin tabla de mareas el coeficiente es la estimación lunar, y así se indica', () => {
  const rows = hourlyForecast.buildForecastRows({
    forecast: syntheticForecast(),
    nowMs: Date.UTC(2026, 9, 12, 12, 30),
  });
  rows.forEach((row) => {
    assert.equal(row.coefficientSource, hourlyForecast.COEFFICIENT_SOURCE_MOON);
    assert.ok(Number.isInteger(row.coefficient) && row.coefficient >= 20 && row.coefficient <= 130, `coef ${row.coefficient}`);
    assert.equal(row.tide, null, 'sin alturas no hay marea en la fila');
  });
});

test('una tormenta en todas las horas no deja ninguna hora por encima de 1 estrella', () => {
  const rows = hourlyForecast.buildForecastRows({
    forecast: syntheticForecast({ weatherCode: 95 }),
    nowMs: Date.UTC(2026, 9, 12, 12, 30),
  });
  rows.forEach((row) => {
    assert.equal(row.rating.stars, 1);
    assert.ok(row.rating.score <= 20);
  });
  assert.deepEqual(hourlyForecast.pickBestMoments(rows), [], 'ninguna hora llega a 3 estrellas');
});

test('la temperatura del agua de la serie marina aparece en la fila de la hora correspondiente', () => {
  const forecast = syntheticForecast();
  const waterSeries = { times: forecast.hourly.times.slice(), values: forecast.hourly.times.map((_, index) => 16 + index / 100) };
  const [first] = hourlyForecast.buildForecastRows({
    forecast,
    waterSeries,
    nowMs: Date.UTC(2026, 9, 12, 12, 30),
  });
  assert.equal(first.waterTemperatureC, 16 + 38 / 100);
});

test('tideAtTime interpola la altura, indica si sube o baja y las horas desde el extremo', () => {
  const start = Date.UTC(2026, 9, 12, 0);
  const heights = Array.from({ length: 61 }, (_, index) => ({ ts: start + index * 600000, height: 1 + index / 60 }));
  const state = { heights, extremes: [{ ts: start + 10 * HOUR_MS, height: 2, type: 'high' }] };

  const rising = hourlyForecast.tideAtTime(state, start + 5 * HOUR_MS);
  assert.ok(Math.abs(rising.heightM - 1.5) < 0.01, `altura ${rising.heightM}`);
  assert.equal(rising.trend, 'rising');
  assert.equal(rising.hoursFromExtreme, 5);

  assert.equal(hourlyForecast.tideAtTime(state, start + 11 * HOUR_MS), null, 'fuera de la ventana');
  assert.equal(hourlyForecast.tideAtTime(null, start), null);

  const falling = { heights: heights.map((point) => ({ ts: point.ts, height: 2 - point.height + 1 })), extremes: [] };
  assert.equal(hourlyForecast.tideAtTime(falling, start + 2 * HOUR_MS).trend, 'falling');
});

test('pickBestMoments elige las mejores horas separadas al menos 6 h y con 3 estrellas o más', () => {
  const base = Date.UTC(2026, 9, 12, 0);
  const row = (hour, score, stars) => ({ ts: base + hour * HOUR_MS, rating: { score, stars } });
  const rows = [
    row(0, 70, 4),
    row(3, 90, 5),
    row(6, 88, 5),
    row(9, 72, 4),
    row(12, 60, 3),
    row(18, 85, 5),
    row(21, 30, 1),
    row(24, null, null),
  ];
  const best = hourlyForecast.pickBestMoments(rows);
  assert.deepEqual(
    best.map((item) => (item.ts - base) / HOUR_MS),
    [3, 9, 18],
    'las horas de 0 y 6 h están a menos de 6 h de la de 3 h; la de 12 h se queda fuera por el límite de tres; la de 21 h no llega a 3 estrellas'
  );
  assert.equal(hourlyForecast.pickBestMoments(rows.slice(6)).length, 0);
});

test('con la predicción armónica, cada hora de las 72 h tiene marea y coeficiente del día de la estación', () => {
  const nowMs = Date.UTC(2026, 9, 12, 12, 30);
  return corunaTideState(nowMs).then((tideState) => {
    assert.equal(tideState.coversEndMs - nowMs, 75 * HOUR_MS);
    assert.equal(tideState.station.timeZone, 'Europe/Madrid');

    const rows = hourlyForecast.buildForecastRows({
      forecast: syntheticForecast(),
      tideState,
      nowMs,
    });
    assert.equal(rows.length, 72);
    rows.forEach((row) => {
      assert.ok(row.tide !== null, `marea en ${row.dateKey} ${row.hourText}`);
      assert.ok(Number.isFinite(row.tide.heightM));
      assert.ok(Number.isFinite(row.tide.hoursFromExtreme));
      assert.equal(row.coefficientSource, hourlyForecast.COEFFICIENT_SOURCE_HARMONIC);
    });
    assert.notEqual(rows[0].rating.label, 'Sin datos', 'con marea, la valoración tiene datos');
  });
});
