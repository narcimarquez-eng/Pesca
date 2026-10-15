'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { species } = App;

test('bestNowFirst pone primero las especies de su mejor momento y conserva el orden del resto', () => {
  const list = species.getSpeciesForZone('mediterraneo');
  const ordered = species.bestNowFirst(list, 'dawn');
  const idsOf = (items) => items.map((item) => item.id);
  assert.equal(ordered.length, list.length);
  assert.deepEqual(idsOf(ordered).slice().sort(), idsOf(list).slice().sort());
  const best = list.filter((item) => item.bestTimes.includes('dawn'));
  const rest = list.filter((item) => !item.bestTimes.includes('dawn'));
  assert.ok(best.length > 0 && rest.length > 0, 'hay especies de amanecer y de otros momentos');
  assert.deepEqual(idsOf(ordered), [...idsOf(best), ...idsOf(rest)]);
});

test('bestNowFirst sin momento del día devuelve la lista en su orden', () => {
  const list = species.getSpeciesForZone('canarias');
  assert.deepEqual(species.bestNowFirst(list, null).map((item) => item.id), list.map((item) => item.id));
  assert.notEqual(species.bestNowFirst(list, null), list, 'devuelve una copia');
});
