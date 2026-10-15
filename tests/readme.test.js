'use strict';

// Las cifras del README deben coincidir con el catálogo: si cambian las especies o las regiones,
// hay que actualizar también el texto del README.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const App = require('./helpers');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const spain = App.speciesData.species;
const world = App.speciesWorld.species;
const countInZone = (zoneId) => spain.filter((item) => item.zones.includes(zoneId)).length;

test('el README da las mismas cifras de especies, zonas y regiones que el catálogo', () => {
  const match = readme.match(
    /(\d+) especies en España \((\d+) en el Atlántico norte y el Cantábrico, (\d+) en el golfo de Cádiz, (\d+) en el Mediterráneo y (\d+) en Canarias\) y (\d+) más en (\d+) regiones del resto del mundo/
  );
  assert.ok(match, 'la frase de especies no aparece en README.md');
  const [total, north, south, med, canary, more, regions] = match.slice(1).map(Number);
  assert.equal(total, spain.length, 'especies en España');
  assert.equal(north, countInZone('atlantico_norte'), 'Atlántico norte y Cantábrico');
  assert.equal(south, countInZone('atlantico_sur'), 'golfo de Cádiz');
  assert.equal(med, countInZone('mediterraneo'), 'Mediterráneo');
  assert.equal(canary, countInZone('canarias'), 'Canarias');
  assert.equal(more, world.length, 'especies del resto del mundo');
  assert.equal(regions, App.speciesWorld.regions.length, 'regiones del mundo');
});

test('el README indica cuántos nombres científicos se han comprobado', () => {
  const names = new Set([...spain, ...world].map((item) => item.scientificName));
  const match = readme.match(/Los (\d+) nombres científicos se han comprobado/);
  assert.ok(match, 'la frase de nombres científicos no aparece en README.md');
  assert.equal(Number(match[1]), names.size);
});
