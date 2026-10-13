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

test('un lugar sin país no recibe zona con tallas, aunque esté en la costa catalogada de España', () => {
  const place = locationService.buildPlace({ lat: 43.3623, lon: -8.4115 });
  assert.equal(place.countryCode, null);
  assert.notEqual(place.zoneKind, 'spain');
  assert.equal(species.isRegulatedZone(place.zoneId), false, 'como mucho, una región del mundo sin tallas');
});

test('en Portugal no se aplican las tallas españolas aunque el punto caiga en el área del catálogo', () => {
  const lisbon = { lat: 38.7223, lon: -9.1393 };
  assert.ok(species.classifyZone(lisbon.lat, lisbon.lon).zoneId, 'el área del catálogo sí lo cubre');
  const place = locationService.buildPlace({ ...lisbon, countryCode: 'pt' });
  assert.equal(place.zoneId, 'iberia-atlantica', 'recibe su región del mundo');
  assert.equal(place.zoneKind, 'region');
  assert.equal(species.isRegulatedZone(place.zoneId), false, 'sin tallas de referencia');
  assert.equal(place.countryCode, 'pt');
});

test('en España el lugar sigue recibiendo su zona del catálogo', () => {
  const place = locationService.buildPlace({ lat: 28.1235, lon: -15.4363, countryCode: 'es' });
  assert.equal(place.zoneId, 'canarias');
  assert.equal(place.zoneKind, 'spain');
  assert.equal(species.isRegulatedZone(place.zoneId), true);
});

test('sin referencia, la captura no recibe alertas de talla, veda ni protección', () => {
  const result = validation.evaluateWithoutReference();
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].code, 'no-reference');
  assert.equal(result.alerts[0].level, 'info');
  assert.equal(result.mustRelease, false);
  assert.equal(result.minSizeCm, null);
});

test('el origen de las condiciones se guarda como código y su texto se traduce al mostrarlo', () => {
  const { weather } = App;
  assert.equal(weather.describeConditionsSource('current'), 'Condiciones actuales');
  assert.equal(weather.describeConditionsSource('recent'), 'Open-Meteo (datos recientes)');
  assert.equal(weather.describeConditionsSource('archive'), 'Open-Meteo Historical (archivo)');
  assert.equal(weather.describeConditionsSource('unavailable'), 'No disponibles');
  assert.equal(weather.describeConditionsSource('Texto antiguo'), 'Texto antiguo', 'los registros antiguos se muestran tal cual');
  assert.equal(weather.describeConditionsSource('constructor'), 'constructor', 'una clave del prototipo no cuenta como código');
  assert.equal(weather.describeConditionsSource(null), null);
});
