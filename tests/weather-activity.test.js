'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { weather, activity } = App;

/** Respuesta de prueba con la estructura documentada de Open-Meteo (datos inventados, solo para tests). */
const forecastFixture = {
  timezone: 'Europe/Madrid',
  timezone_abbreviation: 'CEST',
  elevation: 12,
  current: {
    time: '2026-10-12T14:45',
    temperature_2m: 19.5,
    apparent_temperature: 18.7,
    relative_humidity_2m: 64,
    is_day: 1,
    precipitation: 0,
    weather_code: 2,
    cloud_cover: 40,
    pressure_msl: 1016.4,
    wind_speed_10m: 14.2,
    wind_direction_10m: 250,
    wind_gusts_10m: 25.1,
  },
  hourly: {
    time: [
      '2026-10-12T11:00',
      '2026-10-12T12:00',
      '2026-10-12T13:00',
      '2026-10-12T14:00',
      '2026-10-12T15:00',
    ],
    pressure_msl: [1019.0, 1018.5, 1017.8, 1016.9, 1016.1],
  },
  daily: {
    time: ['2026-10-11', '2026-10-12'],
    sunrise: ['2026-10-11T08:01', '2026-10-12T08:02'],
    sunset: ['2026-10-11T19:10', '2026-10-12T19:08'],
  },
};

test('normalizeForecast mapea los campos y calcula la tendencia de presión de 3 h', () => {
  const forecast = weather.normalizeForecast(forecastFixture);
  assert.equal(forecast.observedAt, '2026-10-12T14:45');
  assert.equal(forecast.pressureHpa, 1016.4);
  // Presión actual (1016,4) menos la de hace 3 horas (11:00 → 1019,0).
  assert.equal(forecast.pressureTrend3hHpa, -2.6);
  assert.equal(forecast.windSpeedKmh, 14.2);
  assert.equal(forecast.windDirectionDeg, 250);
  assert.equal(forecast.sunrise, '2026-10-12T08:02');
  assert.equal(forecast.sunset, '2026-10-12T19:08');
  assert.equal(forecast.isDay, true);
});

test('normalizeForecast lanza error si la respuesta no tiene la estructura esperada', () => {
  assert.throws(() => weather.normalizeForecast({}), /formato esperado/);
});

test('describeWeatherCode traduce códigos WMO y maneja valores desconocidos', () => {
  assert.equal(weather.describeWeatherCode(0).label, 'Despejado');
  assert.equal(weather.describeWeatherCode(95).label, 'Tormenta');
  assert.equal(weather.describeWeatherCode(null).label, 'Sin datos');
});

test('buildHistoryRequest usa el modelo reciente para la última semana y el archivo para fechas antiguas', () => {
  const recent = weather.buildHistoryRequest(42.2, -8.7, '2026-10-09', '2026-10-12');
  assert.match(recent.url, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(recent.url, /past_days=5/);

  const old = weather.buildHistoryRequest(42.2, -8.7, '2025-06-01', '2026-10-12');
  assert.match(old.url, /archive-api\.open-meteo\.com\/v1\/archive/);
  assert.match(old.url, /start_date=2025-05-31/);
  assert.match(old.url, /end_date=2025-06-01/);
});

test('normalizeHistorySnapshot toma exactamente la hora de la captura', () => {
  const json = {
    hourly: {
      time: ['2025-06-01T10:00', '2025-06-01T11:00', '2025-06-01T12:00', '2025-06-01T13:00'],
      pressure_msl: [1010, 1011, 1012, 1013.5],
      temperature_2m: [18, 19, 20, 21],
      wind_speed_10m: [5, 6, 7, 8],
      wind_direction_10m: [90, 100, 110, 120],
      relative_humidity_2m: [70, 70, 70, 70],
      precipitation: [0, 0, 0, 0.2],
      weather_code: [1, 1, 2, 61],
      cloud_cover: [10, 20, 30, 80],
    },
  };
  const snapshot = weather.normalizeHistorySnapshot(json, '2025-06-01T13:00', 'archivo');
  assert.equal(snapshot.airTemperatureC, 21);
  assert.equal(snapshot.pressureHpa, 1013.5);
  // 13:00 menos 3 h (10:00 → 1010,0).
  assert.equal(snapshot.pressureTrend3hHpa, 3.5);
  assert.equal(snapshot.windDirectionDeg, 120);
  assert.equal(snapshot.precipitationMm, 0.2);
  assert.throws(() => weather.normalizeHistorySnapshot(json, '2025-06-01T14:00', 'x'), /no tiene datos/);
});

test('extractWaterTemperature devuelve null si no hay dato para la hora', () => {
  assert.equal(
    weather.extractWaterTemperature({ hourly: { time: [], sea_surface_temperature: [] } }, '2026-10-12T14:00'),
    null
  );
  assert.equal(
    weather.extractWaterTemperature(
      { hourly: { time: ['2026-10-12T14:00'], sea_surface_temperature: [17.4] } },
      '2026-10-12T14:45'
    ),
    17.4
  );
});

test('computePressureTrend sin suficiente historia devuelve null', () => {
  assert.equal(weather.computePressureTrend([1010, 1011], 1, 1011), null);
});

test('índice de actividad: condiciones buenas puntúan alto y malas, bajo', () => {
  const good = activity.computeActivityIndex({
    pressureHpa: 1015,
    pressureTrend3hHpa: -1.5,
    moonDistanceToSyzygy: 0.01,
    windSpeedKmh: 6,
    hoursFromTideExtreme: 3,
    tideCoefficient: 100,
  });
  const bad = activity.computeActivityIndex({
    pressureHpa: 1040,
    pressureTrend3hHpa: 5,
    moonDistanceToSyzygy: 0.25,
    windSpeedKmh: 45,
    hoursFromTideExtreme: 0.2,
    tideCoefficient: 40,
  });
  assert.ok(good.score >= 80, `puntuación buena: ${good.score}`);
  assert.ok(bad.score < 50, `puntuación mala: ${bad.score}`);
  assert.ok(good.score > bad.score);
});

test('índice de actividad sin datos de marea reparte el peso entre los factores disponibles', () => {
  const result = activity.computeActivityIndex({
    pressureHpa: 1015,
    pressureTrend3hHpa: 0,
    moonDistanceToSyzygy: 0.2,
    windSpeedKmh: 12,
    hoursFromTideExtreme: null,
  });
  assert.equal(result.factors.length, 3);
  assert.ok(result.missing.includes('Marea'));
  const shareTotal = result.factors.reduce((sum, factor) => sum + factor.sharePercent, 0);
  assert.ok(shareTotal >= 99 && shareTotal <= 101, `reparto total ${shareTotal}%`);
});

test('índice de actividad sin ningún dato devuelve null y nivel "Sin datos"', () => {
  const result = activity.computeActivityIndex({});
  assert.equal(result.score, null);
  assert.equal(result.level, 'Sin datos');
});

test('describeLevel respeta los límites de cada nivel', () => {
  assert.equal(activity.describeLevel(64), 'Muy baja');
  assert.equal(activity.describeLevel(65), 'Baja');
  assert.equal(activity.describeLevel(75), 'Moderada');
  assert.equal(activity.describeLevel(82), 'Buena');
  assert.equal(activity.describeLevel(90), 'Muy buena');
});

test('cada factor incluye una explicación en castellano y la bajada rápida se describe', () => {
  const result = activity.computeActivityIndex({
    pressureHpa: 1008,
    pressureTrend3hHpa: -4,
    moonDistanceToSyzygy: 0.02,
    windSpeedKmh: 25,
    hoursFromTideExtreme: 1.5,
    tideCoefficient: 100,
  });
  result.factors.forEach((factor) => assert.ok(factor.explanation.length > 10, factor.key));
  const pressure = result.factors.find((factor) => factor.key === 'pressure');
  assert.match(pressure.explanation, /bajada rápida/);
  assert.match(result.summary, /^Índice \d+\/100/);
});
