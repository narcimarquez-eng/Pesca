'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { utils, weather, activity, forecast: hourlyForecast, config } = App;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Respuesta sintética del modelo de conjunto: el control (sin sufijo) y `members` miembros
 * ("_member01", ...). Cada escenario se distingue por un desplazamiento `m`.
 */
function syntheticEnsembleJson({ members = 3, stepHours = 1, hours = 24 } = {}) {
  const start = Date.parse('2026-10-12T00:00:00Z');
  const times = Array.from({ length: hours / stepHours }, (_, index) =>
    new Date(start + index * stepHours * HOUR_MS).toISOString().slice(0, 16)
  );
  const json = { timezone: 'Europe/Madrid', utc_offset_seconds: 7200, hourly: { time: times } };
  for (let m = 0; m <= members; m += 1) {
    const suffix = m === 0 ? '' : `_member${String(m).padStart(2, '0')}`;
    json.hourly[`temperature_2m${suffix}`] = times.map((_, index) => 10 + m + index / 10);
    json.hourly[`precipitation${suffix}`] = times.map(() => (m === 2 ? 0.5 : 0));
    json.hourly[`wind_speed_10m${suffix}`] = times.map(() => 10 * m);
    json.hourly[`wind_gusts_10m${suffix}`] = times.map(() => 20 + m);
    json.hourly[`pressure_msl${suffix}`] = times.map(() => 1010 + m);
  }
  return json;
}

/** Previsión central sintética de 120 horas (un día pasado y cuatro de pronóstico), en hora de Madrid. */
function syntheticForecast() {
  const start = Date.parse('2026-10-11T00:00:00Z');
  const times = Array.from({ length: 120 }, (_, index) => new Date(start + index * HOUR_MS).toISOString().slice(0, 16));
  const constant = (value) => times.map(() => value);
  return weather.normalizeForecast({
    timezone: 'Europe/Madrid',
    utc_offset_seconds: 7200,
    current: {
      time: '2026-10-12T12:15',
      temperature_2m: 12,
      apparent_temperature: 11,
      relative_humidity_2m: 70,
      is_day: 1,
      precipitation: 0,
      weather_code: 2,
      cloud_cover: 40,
      pressure_msl: 1012,
      wind_speed_10m: 15,
      wind_direction_10m: 240,
      wind_gusts_10m: 20,
    },
    hourly: {
      time: times,
      temperature_2m: constant(12),
      relative_humidity_2m: constant(70),
      precipitation: constant(0),
      weather_code: constant(2),
      cloud_cover: constant(40),
      pressure_msl: constant(1012),
      wind_speed_10m: constant(15),
      wind_direction_10m: constant(240),
      wind_gusts_10m: constant(20),
      is_day: times.map((_, index) => (index % 24 >= 8 && index % 24 <= 20 ? 1 : 0)),
    },
    daily: { time: [], sunrise: [], sunset: [] },
  });
}

test('quantile usa interpolación lineal entre valores (método R-7)', () => {
  assert.equal(utils.quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.ok(Math.abs(utils.quantile([1, 2, 3, 4, 5], 0.1) - 1.4) < 1e-9);
  assert.ok(Math.abs(utils.quantile([1, 2, 3, 4, 5], 0.9) - 4.6) < 1e-9);
  assert.equal(utils.quantile([7], 0.9), 7);
  assert.equal(utils.quantile([], 0.5), null);
  assert.equal(utils.quantile([null, '3', 'x', 5], 0.5), 4, 'ignora lo que no es número y acepta texto numérico');
});

test('la URL de escenarios pide el modelo de conjunto, hora local y cuatro días', () => {
  const url = weather.buildEnsembleUrl(42.2406, -8.7207);
  assert.ok(url.startsWith(`${config.endpoints.ensemble}?`));
  assert.match(url, /models=ecmwf_ifs025/);
  assert.match(url, /forecast_days=4/);
  assert.match(url, /timezone=auto/);
  assert.match(url, /hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,pressure_msl/);
});

test('normalizeEnsemble agrupa el control y los miembros en escenarios con sus variables', () => {
  const ensemble = weather.normalizeEnsemble(syntheticEnsembleJson({ members: 3 }));
  assert.equal(ensemble.members.length, 4, 'control más tres miembros');
  assert.equal(ensemble.times.length, 24);
  assert.equal(ensemble.utcOffsetSeconds, 7200);
  ensemble.members.forEach((member) => {
    assert.deepEqual(Object.keys(member).sort(), [
      'precipitationMm',
      'pressureHpa',
      'temperatureC',
      'windGustsKmh',
      'windSpeedKmh',
    ]);
  });
  const firstHour = ensemble.members.map((member) => member.temperatureC[0]).sort((a, b) => a - b);
  assert.deepEqual(firstHour, [10, 11, 12, 13]);
});

test('normalizeEnsemble lleva los pasos de 3 horas a una rejilla de una hora interpolando', () => {
  const ensemble = weather.normalizeEnsemble(syntheticEnsembleJson({ members: 1, stepHours: 3, hours: 12 }));
  assert.equal(ensemble.times.length, 10, 'de 00:00 a 09:00, una fila por hora');
  const control = ensemble.members.find((member) => member.temperatureC[0] === 10);
  assert.ok(Math.abs(control.temperatureC[1] - (10 + 0.1 / 3)) < 1e-9, `01:00 interpolada: ${control.temperatureC[1]}`);
  assert.equal(control.temperatureC[3], 10.1, '03:00 es un dato original');
});

test('normalizeEnsemble lanza error si la respuesta no trae horas ni escenarios', () => {
  assert.throws(() => weather.normalizeEnsemble({}), /no devolvió horas/);
  assert.throws(
    () => weather.normalizeEnsemble({ hourly: { time: ['2026-10-12T00:00'] } }),
    /no devolvió escenarios/
  );
});

test('marginOf amplía el margen para incluir el valor central', () => {
  const widened = hourlyForecast.marginOf([10, 11, 12, 13, 14], 20);
  assert.ok(Math.abs(widened.low - 10.4) < 1e-9);
  assert.equal(widened.high, 20, 'el valor central queda dentro del margen');

  const exact = hourlyForecast.marginOf([1, 2, 3], null);
  assert.ok(Math.abs(exact.low - 1.2) < 1e-9 && Math.abs(exact.high - 2.8) < 1e-9);
  assert.equal(hourlyForecast.marginOf([], 5), null);
});

test('summarizeScenarios da la probabilidad de lluvia y márgenes que incluyen el valor central', () => {
  const ensemble = weather.normalizeEnsemble(syntheticEnsembleJson({ members: 4 }));
  const result = hourlyForecast.summarizeScenarios({
    ensemble,
    index: 0,
    central: { temperatureC: 12, windSpeedKmh: 15, windGustsKmh: 20, stars: 3 },
    weatherCode: 1,
    moonDistance: 0.1,
    hoursFromTideExtreme: 2,
    tideCoefficient: 80,
  });
  assert.equal(result.count, 5);
  assert.equal(result.rainChancePercent, 20, 'uno de cinco escenarios llueve');
  assert.ok(Math.abs(result.temperatureC.low - 10.4) < 1e-9);
  assert.ok(Math.abs(result.temperatureC.high - 13.6) < 1e-9);
  assert.ok(Math.abs(result.windSpeedKmh.low - 4) < 1e-9, `viento bajo ${result.windSpeedKmh.low}`);
  assert.equal(result.windSpeedKmh.high, 36);
  assert.ok(result.rating.low <= 3 && result.rating.high >= 3, 'el margen de estrellas incluye la central');
});

test('fishingScore da la misma puntuación que computeFishingRating en combinaciones de datos aleatorias', () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let n = 0; n < 300; n += 1) {
    const input = {
      pressureHpa: random() < 0.1 ? null : 990 + random() * 40,
      pressureTrend3hHpa: random() < 0.2 ? null : -8 + random() * 16,
      moonDistanceToSyzygy: random() < 0.1 ? null : random() * 0.25,
      windSpeedKmh: random() < 0.1 ? null : random() * 70,
      windGustsKmh: random() < 0.2 ? null : random() * 90,
      precipitationMm: random() < 0.2 ? null : random() * 6,
      weatherCode: [0, 2, 61, 95, 96][Math.floor(random() * 5)],
      hoursFromTideExtreme: random() < 0.1 ? null : random() * 6,
      tideCoefficient: random() < 0.1 ? null : 20 + random() * 100,
    };
    assert.equal(activity.fishingScore(input), activity.computeFishingRating(input).score, JSON.stringify(input));
  }
});

test('con escenarios, cada hora de la previsión lleva su margen; sin ellos, no', () => {
  const forecast = syntheticForecast();
  const nowMs = Date.UTC(2026, 9, 12, 12, 30);
  const withScenarios = hourlyForecast.buildForecastRows({
    forecast,
    ensemble: weather.normalizeEnsemble(syntheticEnsembleJson({ members: 4, hours: 96 })),
    nowMs,
  });
  assert.equal(withScenarios.length, 72);
  withScenarios.forEach((row) => {
    assert.ok(row.scenarios, `margen en ${row.dateKey} ${row.hourText}`);
    assert.equal(row.scenarios.count, 5);
    assert.equal(row.scenarios.rainChancePercent, 20);
    assert.ok(row.scenarios.temperatureC.low <= row.airTemperatureC);
    assert.ok(row.scenarios.temperatureC.high >= row.airTemperatureC);
    assert.ok(row.scenarios.rating.low <= row.rating.stars && row.scenarios.rating.high >= row.rating.stars);
  });

  const withoutScenarios = hourlyForecast.buildForecastRows({ forecast, nowMs });
  withoutScenarios.forEach((row) => assert.equal(row.scenarios, null));
});
