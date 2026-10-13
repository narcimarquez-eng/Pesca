'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { species, locationService, i18n } = App;
const HOOK = /^(\d{1,2}|\d{1,2}\/0)(–(\d{1,2}|\d{1,2}\/0))?$/;
const hookValue = (size) => (size.endsWith('/0') ? 100 + Number(size.slice(0, -2)) : 100 - Number(size));

test('todas las fichas usan códigos del vocabulario, nombres en castellano e inglés y anzuelos válidos', () => {
  const { VOCAB } = species;
  const all = species.getSpeciesList();
  assert.ok(all.length >= 250, `especies: ${all.length}`);
  const ids = all.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
  for (const item of all) {
    const where = `${item.id} (${item.scientificName})`;
    assert.ok(item.names && item.names.es && item.names.en, `${where}: nombres`);
    assert.match(item.scientificName, /^[A-Z][a-z]+ [a-z]+/, `${where}: nombre científico`);
    for (const [field, kind] of [['habitats', 'habitats'], ['techniques', 'techniques'], ['baits', 'baits'], ['bestTimes', 'bestTimes'], ['hookStyles', 'hookStyles'], ['alerts', 'alerts']]) {
      (item[field] || []).forEach((code) => assert.ok(code in VOCAB[kind], `${where}: ${field} desconocido "${code}"`));
    }
    ['habitats', 'techniques', 'baits', 'bestTimes'].forEach((field) => assert.ok(item[field] && item[field].length, `${where}: falta ${field}`));
    let lastKg = 0;
    let lastHook = -Infinity;
    (item.hooks || []).forEach((hook, index) => {
      assert.match(hook.size, HOOK, `${where}: anzuelo "${hook.size}"`);
      const parts = hook.size.split('–').map(hookValue);
      assert.ok(parts[0] <= parts[parts.length - 1], `${where}: anzuelo de menor a mayor`);
      assert.ok(parts[parts.length - 1] >= lastHook, `${where}: el anzuelo crece con el peso`);
      lastHook = parts[parts.length - 1];
      if (index < item.hooks.length - 1) {
        assert.ok(hook.maxKg > lastKg, `${where}: tramos de peso crecientes`);
        lastKg = hook.maxKg;
      }
    });
    assert.ok(item.zones.length > 0, `${where}: sin zonas ni regiones`);
  }
});

test('todas las zonas de España y regiones del mundo tienen especies y puntos de referencia', () => {
  const zones = species.getZones();
  const regions = zones.filter((zone) => zone.kind === 'region');
  assert.ok(regions.length >= 30, `regiones: ${regions.length}`);
  for (const zone of zones) {
    assert.ok(species.getSpeciesForZone(zone.id).length >= (zone.kind === 'region' ? 10 : 20), `zona con pocas especies: ${zone.id}`);
    assert.ok(species.zoneLabel(zone.id), `zona sin nombre: ${zone.id}`);
  }
  for (const region of App.speciesWorld.regions) {
    assert.ok(region.anchors.length >= 5, `${region.id}: pocos puntos`);
    region.species.forEach((id) => assert.ok(species.getSpeciesById(id), `${region.id}: especie sin ficha ${id}`));
  }
});

test('classifyRegion asigna cada costa del mundo a su región', () => {
  const cases = [
    ['Lisboa', 38.7, -9.4, 'iberia-atlantica'],
    ['Marsella', 43.29, 5.36, 'mediterraneo-occidental'],
    ['Atenas (El Pireo)', 37.94, 23.64, 'mediterraneo-oriental'],
    ['Brighton', 50.82, -0.14, 'islas-britanicas'],
    ['Bergen', 60.39, 5.32, 'escandinavia-atlantica'],
    ['Ciudad del Cabo', -33.92, 18.42, 'africa-austral'],
    ['Dubái', 25.27, 55.29, 'golfo-persico-arabigo'],
    ['Tokio', 35.62, 139.78, 'asia-oriental'],
    ['Sídney', -33.86, 151.21, 'australia-templada'],
    ['Honolulu', 21.3, -157.86, 'pacifico-insular'],
    ['San Francisco', 37.8, -122.42, 'pacifico-nororiental'],
    ['Miami', 25.77, -80.13, 'atlantico-sureste-eeuu'],
    ['Lima (El Callao)', -12.05, -77.15, 'pacifico-sudamericano'],
    ['Río de Janeiro', -22.97, -43.18, 'brasil'],
    ['Mar del Plata', -38.0, -57.55, 'atlantico-sudoccidental'],
  ];
  for (const [name, lat, lon, expected] of cases) {
    const result = species.classifyRegion(lat, lon);
    assert.equal(result.zoneId, expected, `${name}: ${result.zoneId}`);
    assert.ok(result.inCoverage, `${name}: fuera de cobertura (${result.distanceKm} km)`);
  }
  assert.equal(species.classifyRegion(47.92, 106.92).inCoverage, false, 'Ulán Bator, lejos de cualquier costa');
});

test('fuera de España el lugar recibe su región, sin tallas; lejos de la costa, nada', () => {
  const tokyo = locationService.buildPlace({ lat: 35.62, lon: 139.78, countryCode: 'jp' });
  assert.equal(tokyo.zoneId, 'asia-oriental');
  assert.equal(tokyo.zoneKind, 'region');
  assert.equal(species.isRegulatedZone(tokyo.zoneId), false);
  const inland = locationService.buildPlace({ lat: 47.92, lon: 106.92, countryCode: 'mn' });
  assert.equal(inland.zoneId, null);
});

test('el nombre de la especie sigue al idioma y la búsqueda encuentra nombres en otros idiomas', async () => {
  const lubina = species.getSpeciesById('lubina');
  assert.equal(species.findSpeciesByName(lubina.names.en).id, 'lubina');
  assert.equal(species.findSpeciesByName('Dicentrarchus labrax').id, 'lubina');
  i18n.register('en', {});
  await i18n.setLocale('en');
  assert.equal(species.displayName(lubina), lubina.names.en);
  await i18n.setLocale('es');
  assert.equal(species.displayName(lubina), lubina.names.es);
});

test('hookRows convierte los tramos de anzuelo en filas desde 0 kg hasta piezas mayores', () => {
  const rows = species.hookRows({ hooks: [{ maxKg: 0.5, size: '8–4' }, { maxKg: 2, size: '2–1/0' }, { maxKg: null, size: '2/0–4/0' }] });
  assert.deepEqual(rows, [
    { fromKg: 0, toKg: 0.5, size: '8–4' },
    { fromKg: 0.5, toKg: 2, size: '2–1/0' },
    { fromKg: 2, toKg: null, size: '2/0–4/0' },
  ]);
  assert.deepEqual(species.hookRows({}), []);
});
