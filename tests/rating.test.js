'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { activity } = App;

/** Condiciones ideales: presión estable de 1015 hPa, luna nueva o llena, viento flojo y marea en plena corriente. */
const CALM = {
  pressureHpa: 1015,
  pressureTrend3hHpa: 0,
  moonDistanceToSyzygy: 0,
  windSpeedKmh: 5,
  windGustsKmh: 8,
  precipitationMm: 0,
  weatherCode: 1,
  hoursFromTideExtreme: 3,
  tideCoefficient: 70,
};

test('condiciones ideales dan 100 puntos y 5 estrellas sin ajustes', () => {
  const rating = activity.computeFishingRating(CALM);
  assert.equal(rating.score, 100);
  assert.equal(rating.baseScore, 100);
  assert.equal(rating.stars, 5);
  assert.equal(rating.label, 'Excelente');
  assert.deepEqual(rating.adjustments, []);
  assert.match(rating.summary, /^Sin ajustes de seguridad: no hay tormenta, lluvia ni viento fuerte\.$/);
});

test('ratingFor reparte las estrellas en los umbrales 80, 65, 50 y 35', () => {
  const expected = [
    [100, 5, 'Excelente'],
    [80, 5, 'Excelente'],
    [79, 4, 'Buena'],
    [65, 4, 'Buena'],
    [64, 3, 'Aceptable'],
    [50, 3, 'Aceptable'],
    [49, 2, 'Floja'],
    [35, 2, 'Floja'],
    [34, 1, 'Mala'],
    [0, 1, 'Mala'],
  ];
  expected.forEach(([score, stars, label]) => {
    assert.deepEqual(activity.ratingFor(score), { stars, label }, `puntuación ${score}`);
  });
  assert.deepEqual(activity.ratingFor(null), { stars: null, label: 'Sin datos' });
});

test('una tormenta limita la valoración a 20 puntos aunque el resto sea ideal', () => {
  [95, 96, 99].forEach((weatherCode) => {
    const rating = activity.computeFishingRating({ ...CALM, weatherCode });
    assert.equal(rating.score, 20, `código ${weatherCode}`);
    assert.equal(rating.stars, 1);
    assert.equal(rating.adjustments[0].key, 'storm');
    assert.equal(rating.adjustments[0].effect, 'máximo 20');
    assert.equal(rating.baseScore, 100, 'el índice base se conserva para la explicación');
  });
});

test('la lluvia resta puntos: 10 con lluvia moderada y 30 con lluvia intensa', () => {
  const light = activity.computeFishingRating({ ...CALM, precipitationMm: 1 });
  assert.equal(light.score, 90);
  assert.equal(light.adjustments[0].key, 'rain');
  assert.equal(light.adjustments[0].effect, '−10');

  const heavy = activity.computeFishingRating({ ...CALM, precipitationMm: 4 });
  assert.equal(heavy.score, 70);
  assert.equal(heavy.stars, 4);
  assert.equal(heavy.adjustments[0].key, 'heavy-rain');
  assert.equal(heavy.adjustments[0].effect, '−30');

  const drizzle = activity.computeFishingRating({ ...CALM, precipitationMm: 0.4 });
  assert.equal(drizzle.score, 100, 'menos de 1 mm no se penaliza');
});

test('el viento fuerte o las rachas peligrosas limitan a 25 puntos', () => {
  const strong = activity.computeFishingRating({ ...CALM, windSpeedKmh: 40 });
  assert.equal(strong.score, 25);
  assert.equal(strong.stars, 1);
  assert.equal(strong.adjustments[0].key, 'strong-wind');

  const gusts = activity.computeFishingRating({ ...CALM, windSpeedKmh: 10, windGustsKmh: 50 });
  assert.equal(gusts.score, 25);

  const breeze = activity.computeFishingRating({ ...CALM, windSpeedKmh: 10, windGustsKmh: 45 });
  assert.equal(breeze.score, 100, 'rachas de 45 km/h no limitan');
});

test('varios ajustes se suman y el tope más bajo manda', () => {
  const rating = activity.computeFishingRating({ ...CALM, precipitationMm: 4, windSpeedKmh: 40 });
  assert.equal(rating.score, 25, 'lluvia intensa (−30) y viento fuerte (máximo 25)');
  assert.deepEqual(
    rating.adjustments.map((item) => item.key),
    ['heavy-rain', 'strong-wind']
  );
  assert.match(rating.summary, /Ajustes de seguridad: lluvia intensa \(−30\), viento fuerte \(máximo 25\)\./);
});

test('sin ningún dato la valoración es "Sin datos" y no tiene estrellas', () => {
  const rating = activity.computeFishingRating({});
  assert.equal(rating.score, null);
  assert.equal(rating.stars, null);
  assert.equal(rating.label, 'Sin datos');
  assert.match(rating.summary, /No hay datos suficientes/);
});

test('con pocos datos se valora con lo disponible y el resumen lo indica', () => {
  const rating = activity.computeFishingRating({ windSpeedKmh: 5 });
  assert.equal(rating.score, 100, 'solo el viento: su puntuación se reparte entre todo el peso');
  assert.equal(rating.stars, 5);
  assert.ok(rating.missing.includes('Presión atmosférica'));
  assert.match(rating.summary, /Sin datos de: presión atmosférica, fase lunar, marea\./);
});

test('la tormenta no se compensa con buenos factores ni con la marea', () => {
  const stormy = activity.computeFishingRating({ ...CALM, weatherCode: 95, tideCoefficient: 110 });
  assert.ok(stormy.score <= 20);
  assert.ok(stormy.stars <= 1);
});
