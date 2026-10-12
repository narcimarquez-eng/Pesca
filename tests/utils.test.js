'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');
const { createMemoryStorage } = require('./helpers');

const { utils } = App;

test('toFiniteNumber acepta coma decimal y rechaza valores vacíos o no numéricos', () => {
  assert.equal(utils.toFiniteNumber('1,5'), 1.5);
  assert.equal(utils.toFiniteNumber(' 2.25 '), 2.25);
  assert.equal(utils.toFiniteNumber(0), 0);
  assert.equal(utils.toFiniteNumber(''), null);
  assert.equal(utils.toFiniteNumber('abc'), null);
  assert.equal(utils.toFiniteNumber(null), null);
});

test('interpolateTable interpola entre puntos y fija los extremos', () => {
  const table = [[0, 0], [10, 1], [20, 0.5]];
  assert.equal(utils.interpolateTable(table, -5), 0);
  assert.equal(utils.interpolateTable(table, 5), 0.5);
  assert.equal(utils.interpolateTable(table, 15), 0.75);
  assert.equal(utils.interpolateTable(table, 99), 0.5);
});

test('cardinalDirection indica desde dónde sopla el viento', () => {
  assert.equal(utils.cardinalDirection(0), 'N');
  assert.equal(utils.cardinalDirection(90), 'E');
  assert.equal(utils.cardinalDirection(225), 'SO');
  assert.equal(utils.cardinalDirection(359), 'N');
  assert.equal(utils.cardinalDirection(-90), 'O');
  assert.equal(utils.cardinalDirection(null), '—');
});

test('distanceKm: Madrid-Barcelona ronda los 505 km', () => {
  const distance = utils.distanceKm(40.4168, -3.7038, 41.3851, 2.1734);
  assert.ok(distance > 495 && distance < 515, `distancia calculada: ${distance}`);
});

test('kmhToKnots y formatNumber usan el formato español', () => {
  assert.equal(Math.round(utils.kmhToKnots(18.52) * 100) / 100, 10);
  assert.equal(utils.formatNumber(12.5, 2, 'kg'), '12,50 kg');
  assert.equal(utils.formatNumber(null, 1), '—');
});

test('escapeHtml neutraliza caracteres especiales', () => {
  assert.equal(
    utils.escapeHtml('<b>"x" & \'y\'</b>'),
    '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;'
  );
  assert.equal(utils.escapeHtml(undefined), '');
});

test('normalizeText quita acentos, mayúsculas y espacios sobrantes', () => {
  assert.equal(utils.normalizeText('  Róbalo  '), 'robalo');
});

test('fechas: ida y vuelta del formato datetime-local y diferencias de días', () => {
  const date = utils.parseDateTimeString('2026-10-12T21:05');
  assert.equal(utils.toDateTimeString(date), '2026-10-12T21:05');
  assert.equal(utils.toDateString(date), '2026-10-12');
  assert.equal(utils.parseDateTimeString('no es una fecha'), null);
  assert.equal(utils.daysBetweenDateStrings('2026-10-01', '2026-10-12'), 11);
  assert.equal(utils.shiftDateString('2026-03-01', -1), '2026-02-28');
});

test('buildUrl une listas con comas y omite los valores vacíos', () => {
  const url = utils.buildUrl('https://example.test/api', { a: 1, b: ['x', 'y'], c: null, d: '' });
  assert.equal(url, 'https://example.test/api?a=1&b=x,y');
});

test('almacenamiento y caché: lectura, escritura, caducidad y borrado solo del prefijo', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();
  try {
    assert.equal(utils.storage.write('prueba', { valor: 3 }), true);
    assert.deepEqual(utils.storage.read('prueba', null), { valor: 3 });

    utils.cache.set('clave', { dato: 1 });
    assert.deepEqual(utils.cache.get('clave', 60000), { dato: 1 });
    // Con una antigüedad máxima negativa, cualquier entrada está caducada.
    assert.equal(utils.cache.get('clave', -1), null);

    globalThis.localStorage.setItem('otra-app', 'intacta');
    utils.storage.clearAll();
    assert.equal(globalThis.localStorage.getItem('otra-app'), 'intacta');
    assert.equal(utils.storage.read('prueba', 'vacío'), 'vacío');
  } finally {
    globalThis.localStorage = previous;
  }
});

test('storage.write devuelve false si el almacenamiento está lleno', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage({ failOnWrite: true });
  try {
    assert.equal(utils.storage.write('grande', [1, 2, 3]), false);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('describeError traduce los errores de red a un mensaje comprensible', () => {
  assert.match(utils.describeError(new TypeError('Failed to fetch')), /No se pudo conectar/);
  assert.equal(utils.describeError(new Error('Algo falló')), 'Algo falló');
});
