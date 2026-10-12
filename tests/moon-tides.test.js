'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { moon, tides } = App;
const DAY_MS = 86400000;

test('luna nueva el 11 de enero de 2024 (≈ 11:57 UTC)', () => {
  const phase = moon.getMoonPhase(new Date(Date.UTC(2024, 0, 11, 12, 0)));
  assert.ok(phase.illuminationPercent <= 2, `iluminación ${phase.illuminationPercent}%`);
  assert.equal(phase.name, 'Luna nueva');
});

test('luna llena el 25 de enero de 2024 (≈ 17:54 UTC)', () => {
  const phase = moon.getMoonPhase(new Date(Date.UTC(2024, 0, 25, 18, 0)));
  assert.ok(phase.illuminationPercent >= 98, `iluminación ${phase.illuminationPercent}%`);
  assert.equal(phase.name, 'Luna llena');
  assert.ok(phase.distanceToSyzygy < 0.02);
});

test('fracción, iluminación y próxima sizigia tienen rangos válidos durante dos meses', () => {
  for (let day = 0; day < 60; day += 3) {
    const phase = moon.getMoonPhase(new Date(Date.UTC(2024, 0, 1) + day * DAY_MS));
    assert.ok(phase.fraction >= 0 && phase.fraction < 1);
    assert.ok(phase.illuminationPercent >= 0 && phase.illuminationPercent <= 100);
    assert.ok(phase.nextSyzygy.daysAway >= 0 && phase.nextSyzygy.daysAway <= 14.8);
    assert.ok(['Luna llena', 'Luna nueva'].includes(phase.nextSyzygy.name));
  }
});

test('coeficiente de marea: máximo unos días después de luna nueva y mínimo en cuadratura', () => {
  const newMoonMs = Date.UTC(2024, 0, 11, 11, 57);
  const springCoefficient = tides.estimateCoefficient(new Date(newMoonMs + 1.5 * DAY_MS));
  const neapCoefficient = tides.estimateCoefficient(new Date(newMoonMs + 7.4 * DAY_MS));
  assert.ok(springCoefficient >= 115, `coeficiente en vivas: ${springCoefficient}`);
  assert.ok(neapCoefficient <= 40, `coeficiente en muertas: ${neapCoefficient}`);
  assert.equal(tides.describeCoefficient(springCoefficient), 'Mareas vivas');
  assert.equal(tides.describeCoefficient(neapCoefficient), 'Mareas muertas');
});

test('normalizeTides ordena los datos, pasa segundos a milisegundos y clasifica los extremos', () => {
  const json = {
    heights: [{ dt: 1000, height: 1.2 }, { dt: 700, height: 0.9 }],
    extremes: [
      { dt: 1000, height: 1.2, type: 'High' },
      { dt: 700, height: 0.9, type: 'Low' },
    ],
    station: 'Vigo',
  };
  const normalized = tides.normalizeTides(json);
  assert.equal(normalized.heights[0].ts, 700000);
  assert.equal(normalized.extremes[0].type, 'low');
  assert.equal(normalized.extremes[1].type, 'high');
  assert.equal(normalized.station, 'Vigo');
});

test('normalizeTides lanza el mensaje de error del servicio', () => {
  assert.throws(() => tides.normalizeTides({ error: 'Invalid key' }), /Invalid key/);
});

test('heightAt interpola dentro de la ventana y no extrapola fuera', () => {
  const heights = [{ ts: 0, height: 1 }, { ts: 3600000, height: 2 }];
  assert.equal(tides.heightAt(heights, 1800000), 1.5);
  assert.equal(tides.heightAt(heights, -1), null);
  assert.equal(tides.heightAt(heights, 3600001), null);
});

test('summarize calcula último extremo, próximas pleamar y bajamar y horas desde el extremo más cercano', () => {
  const now = 10 * 3600000;
  const data = {
    heights: [],
    extremes: [
      { ts: 8 * 3600000, height: 1.0, type: 'low' },
      { ts: 12 * 3600000, height: 3.0, type: 'high' },
      { ts: 18 * 3600000, height: 0.5, type: 'low' },
    ],
  };
  const summary = tides.summarize(data, now);
  assert.equal(summary.lastExtreme.type, 'low');
  assert.equal(summary.nextHigh.height, 3.0);
  assert.equal(summary.nextLow.height, 0.5);
  assert.equal(summary.hoursFromExtreme, 2);
});

test('buildTidesUrl incluye los flags heights y extremes y la clave', () => {
  const url = tides.buildTidesUrl({
    lat: 42.2406,
    lon: -8.7207,
    startSeconds: 1700000000,
    lengthSeconds: 129600,
    apiKey: 'clave-de-prueba',
  });
  assert.match(url, /^https:\/\/www\.worldtides\.info\/api\/v3\?heights&extremes&/);
  assert.match(url, /key=clave-de-prueba/);
  assert.match(url, /start=1700000000/);
  assert.match(url, /length=129600/);
});

test('buildChartGeometry: sin datos devuelve null y sitúa correctamente el instante actual', () => {
  assert.equal(tides.buildChartGeometry({ heights: [], extremes: [] }, { startMs: 0, endMs: 10, nowMs: 5 }), null);
  const data = { heights: [{ ts: 0, height: 1 }, { ts: 10, height: 2 }], extremes: [] };
  const geometry = tides.buildChartGeometry(data, {
    startMs: 0,
    endMs: 10,
    nowMs: 5,
    width: 100,
    height: 100,
    padding: 10,
  });
  assert.equal(geometry.nowX, 50);
});

test('getApiKey prefiere la clave guardada por el usuario y saveApiKey la limpia', () => {
  const { createMemoryStorage } = require('./helpers');
  const previous = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();
  try {
    assert.equal(tides.getApiKey(), '');
    tides.saveApiKey('  mi-clave  ');
    assert.equal(tides.getApiKey(), 'mi-clave');
    tides.saveApiKey('');
    assert.equal(tides.getApiKey(), '');
  } finally {
    globalThis.localStorage = previous;
  }
});
