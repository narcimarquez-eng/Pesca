'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { sun } = App;
const MADRID = { lat: 40.4168, lon: -3.7038 };

test('elevación del sol en Madrid el 21 de junio: 73° a mediodía solar y en el horizonte al amanecer', () => {
  // Altura máxima esperada: 90 − 40,42 + 23,44 = 73,0°. Mediodía solar hacia las 12:14 UTC.
  assert.ok(Math.abs(sun.solarElevation(Date.UTC(2026, 5, 21, 12, 14), MADRID.lat, MADRID.lon) - 73.0) < 0.3);
  // Salida del sol a las 06:44 hora local (04:44 UTC): el centro del disco, sin refracción, a unos −0,8°.
  assert.ok(Math.abs(sun.solarElevation(Date.UTC(2026, 5, 21, 4, 44), MADRID.lat, MADRID.lon) + 0.83) < 0.4);
});

test('en el ecuador, el sol pasa casi por el cénit en el equinoccio; en el polo norte, noche en diciembre', () => {
  assert.ok(sun.solarElevation(Date.UTC(2026, 2, 20, 12, 7), 0, 0) > 89);
  assert.ok(sun.solarElevation(Date.UTC(2026, 11, 21, 12), 89.9, 0) < -20);
});

test('lightPeriod: noche, amanecer, día y atardecer en Vigo un día de octubre', () => {
  const vigo = { lat: 42.24, lon: -8.72 };
  const at = (hour, minute = 0) => sun.lightPeriod(Date.UTC(2026, 9, 13, hour, minute), vigo.lat, vigo.lon);
  assert.equal(at(3), 'night');
  assert.equal(at(6, 15), 'dawn', 'la salida del sol es hacia las 06:20 UTC');
  assert.equal(at(12), 'day');
  assert.equal(at(17, 30), 'dusk', 'la puesta es hacia las 17:35 UTC');
  assert.equal(at(20), 'night');
});
