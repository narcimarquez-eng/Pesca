'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { locationService, species, validation } = App;

test('el código de país se lee de la respuesta de Nominatim en minúsculas', () => {
  const place = locationService.normalizeNominatimPlace({
    name: 'Cascais',
    address: { town: 'Cascais', state: 'Lisboa', country: 'Portugal', country_code: 'PT' },
  });
  assert.equal(place.countryCode, 'pt');
  assert.equal(locationService.normalizeNominatimPlace({ address: {} }).countryCode, null);
});

test('un lugar sin país no recibe zona del catálogo, aunque esté en la costa catalogada', () => {
  const place = locationService.buildPlace({ lat: 43.3623, lon: -8.4115 });
  assert.equal(place.countryCode, null);
  assert.equal(place.zoneId, null);
  assert.equal(place.inCoverage, false);
});

test('en Portugal no se aplican las tallas españolas aunque el punto caiga en el área del catálogo', () => {
  const lisbon = { lat: 38.7223, lon: -9.1393 };
  assert.ok(species.classifyZone(lisbon.lat, lisbon.lon).zoneId, 'el área del catálogo sí lo cubre');
  const place = locationService.buildPlace({ ...lisbon, countryCode: 'pt' });
  assert.equal(place.zoneId, null, 'pero el lugar no tiene referencia');
  assert.equal(place.countryCode, 'pt');
});

test('en España el lugar sigue recibiendo su zona del catálogo', () => {
  const place = locationService.buildPlace({ lat: 28.1235, lon: -15.4363, countryCode: 'es' });
  assert.equal(place.zoneId, 'canarias');
});

test('sin referencia, la captura no recibe alertas de talla, veda ni protección', () => {
  const result = validation.evaluateWithoutReference();
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].code, 'no-reference');
  assert.equal(result.alerts[0].level, 'info');
  assert.equal(result.mustRelease, false);
  assert.equal(result.minSizeCm, null);
});
