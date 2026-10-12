'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');
const { createMemoryStorage } = require('./helpers');

const { speciesData, species, locationService, validation, catches } = App;
const findSpecies = (id) => speciesData.species.find((item) => item.id === id);

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

test('catálogo: ids únicos, zonas válidas, fuentes citadas y tallas solo en zonas asignadas', () => {
  const ids = speciesData.species.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids duplicados');
  const zoneIds = new Set(speciesData.zones.map((zone) => zone.id));

  speciesData.species.forEach((item) => {
    assert.ok(item.commonName && item.scientificName, `${item.id}: falta nombre`);
    assert.ok(Array.isArray(item.zones) && item.zones.length > 0, `${item.id}: sin zonas`);
    item.zones.forEach((zoneId) => assert.ok(zoneIds.has(zoneId), `${item.id}: zona desconocida ${zoneId}`));
    assert.ok(Array.isArray(item.sources) && item.sources.length > 0, `${item.id}: sin fuentes`);
    Object.keys(item.minSizeCm || {}).forEach((zoneId) =>
      assert.ok(item.zones.includes(zoneId), `${item.id}: talla en zona no asignada ${zoneId}`)
    );
  });
});

test('cada zona tiene especies y al menos un punto de referencia; los puntos apuntan a zonas válidas', () => {
  const zoneIds = speciesData.zones.map((zone) => zone.id);
  zoneIds.forEach((zoneId) => {
    assert.ok(species.getSpeciesForZone(zoneId).length > 0, `zona sin especies: ${zoneId}`);
    assert.ok(speciesData.zoneAnchors.some((anchor) => anchor.zoneId === zoneId), `zona sin punto: ${zoneId}`);
  });
  speciesData.zoneAnchors.forEach((anchor) => assert.ok(zoneIds.includes(anchor.zoneId), anchor.name));
});

test('classifyZone asigna la costa correcta e indica cuándo el lugar está fuera de cobertura', () => {
  assert.equal(species.classifyZone(43.3623, -8.4115).zoneId, 'atlantico_norte');
  assert.equal(species.classifyZone(41.3851, 2.1734).zoneId, 'mediterraneo');
  assert.equal(species.classifyZone(28.1235, -15.4363).zoneId, 'canarias');
  assert.equal(species.classifyZone(36.5271, -6.2886).zoneId, 'atlantico_sur');
  const inland = species.classifyZone(40.4168, -3.7038);
  assert.equal(inland.inCoverage, false);
  assert.ok(inland.distanceKm > 60);
});

test('searchSpecies ignora acentos, busca por alias y nombre científico, y respeta la zona', () => {
  assert.equal(species.searchSpecies('robalo')[0].id, 'lubina');
  assert.equal(species.searchSpecies('dicentrarchus')[0].id, 'lubina');
  const canaryResults = species.searchSpecies('', { zoneId: 'canarias' });
  assert.ok(canaryResults.length > 0);
  assert.ok(canaryResults.every((item) => item.zones.includes('canarias')));
  assert.ok(canaryResults.some((item) => item.id === 'barracuda'));
});

test('findSpeciesByName encuentra por nombre exacto sin distinguir acentos', () => {
  assert.equal(species.findSpeciesByName('Róbalo').id, 'lubina');
  assert.equal(species.findSpeciesByName('Lubina').id, 'lubina');
  assert.equal(species.findSpeciesByName('Pez inventado'), null);
  assert.equal(species.findSpeciesByName(''), null);
});

test('formatMonths ordena los meses del año y maneja listas vacías', () => {
  assert.equal(species.formatMonths([10, 1, 3]), 'ene, mar, oct');
  assert.equal(species.formatMonths([]), 'Sin periodo definido');
});

test('parseCoordinates acepta varios formatos y rechaza valores fuera de rango', () => {
  assert.deepEqual(locationService.parseCoordinates('43.36, -8.41'), { lat: 43.36, lon: -8.41 });
  assert.deepEqual(locationService.parseCoordinates('43,36; -8,41'), { lat: 43.36, lon: -8.41 });
  assert.deepEqual(locationService.parseCoordinates('43.36 -8.41'), { lat: 43.36, lon: -8.41 });
  assert.equal(locationService.parseCoordinates('200, 10'), null);
  assert.equal(locationService.parseCoordinates('Vigo'), null);
});

test('buildPlace asigna zona y usa coordenadas como nombre si no hay nombre de lugar', () => {
  const place = locationService.buildPlace({ lat: 43.3623, lon: -8.4115 });
  assert.equal(place.zoneId, 'atlantico_norte');
  assert.equal(place.inCoverage, true);
  assert.match(place.name, /^Punto 43\.362, -8\.412$/);
});

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

test('estimateWeightKg: lubina de 40 cm pesa en torno a 0,7 kg; longitudes no válidas dan null', () => {
  const weight = validation.estimateWeightKg(40, findSpecies('lubina'));
  assert.ok(weight > 0.55 && weight < 0.95, `peso estimado ${weight}`);
  assert.equal(validation.estimateWeightKg(0, findSpecies('lubina')), null);
  assert.equal(validation.estimateWeightKg('abc', findSpecies('lubina')), null);
});

test('lubina atlántica de 30 cm debe devolverse (talla de referencia 36 cm)', () => {
  const result = validation.evaluateCatch({
    species: findSpecies('lubina'),
    zoneId: 'atlantico_norte',
    lengthCm: 30,
    dateTime: new Date(2026, 9, 12),
  });
  assert.equal(result.mustRelease, true);
  assert.equal(result.minSizeCm, 36);
  assert.ok(result.alerts.some((alert) => alert.code === 'below-min-size' && alert.level === 'danger'));
});

test('lubina mediterránea de 30 cm cumple la talla de referencia de 25 cm', () => {
  const result = validation.evaluateCatch({
    species: findSpecies('lubina'),
    zoneId: 'mediterraneo',
    lengthCm: 30,
    dateTime: new Date(2026, 9, 12),
  });
  assert.equal(result.mustRelease, false);
  assert.ok(result.alerts.some((alert) => alert.code === 'legal-size'));
});

test('sin talla confirmada la alerta es informativa, no roja', () => {
  const result = validation.evaluateCatch({
    species: findSpecies('chopa'),
    zoneId: 'mediterraneo',
    lengthCm: 25,
    dateTime: new Date(2026, 9, 12),
  });
  assert.equal(result.mustRelease, false);
  assert.ok(result.alerts.some((alert) => alert.code === 'no-reference-size' && alert.level === 'info'));
});

test('el mero (especie protegida) genera una alerta roja de no retención', () => {
  const result = validation.evaluateCatch({
    species: findSpecies('mero'),
    zoneId: 'mediterraneo',
    lengthCm: 60,
    dateTime: new Date(2026, 9, 12),
  });
  assert.equal(result.mustRelease, true);
  assert.ok(result.alerts.some((alert) => alert.code === 'protected'));
});

test('una veda que coincide con zona y mes obliga a devolver; fuera de ese mes no', () => {
  const species = {
    ...findSpecies('lubina'),
    closedSeasons: [{ zones: ['atlantico_norte'], months: [10], reason: 'prueba' }],
  };
  const inside = validation.evaluateCatch({
    species,
    zoneId: 'atlantico_norte',
    lengthCm: 50,
    dateTime: new Date(2026, 9, 5),
  });
  assert.equal(inside.mustRelease, true);
  assert.ok(inside.alerts.some((alert) => alert.code === 'closed-season'));

  const outside = validation.evaluateCatch({
    species,
    zoneId: 'atlantico_norte',
    lengthCm: 50,
    dateTime: new Date(2026, 6, 5),
  });
  assert.ok(!outside.alerts.some((alert) => alert.code === 'closed-season'));
});

test('la corvina muestra su aviso de normativa específica', () => {
  const result = validation.evaluateCatch({
    species: findSpecies('corvina'),
    zoneId: 'atlantico_sur',
    lengthCm: 60,
    dateTime: new Date(2026, 9, 12),
  });
  assert.ok(result.alerts.some((alert) => alert.code === 'species-note' && alert.level === 'warning'));
});

test('especie fuera del catálogo solo muestra información y no obliga a devolver', () => {
  const result = validation.evaluateCatch({ species: null, zoneId: 'mediterraneo', lengthCm: 10 });
  assert.equal(result.mustRelease, false);
  assert.equal(result.alerts[0].code, 'unknown-species');
});

// ---------------------------------------------------------------------------
// Registro de capturas
// ---------------------------------------------------------------------------

test('createRecord estima el peso cuando solo hay longitud y evalúa la talla', () => {
  const record = catches.createRecord({
    dateTimeText: '2026-10-12T10:30',
    species: findSpecies('lubina'),
    speciesText: 'Lubina',
    zoneId: 'atlantico_norte',
    weightKg: '',
    lengthCm: '40',
  });
  assert.equal(record.weightKg, null);
  assert.ok(record.estimatedWeightKg > 0.55 && record.estimatedWeightKg < 0.95);
  assert.equal(record.assessment.mustRelease, false);
  assert.equal(record.speciesId, 'lubina');
});

test('createRecord rechaza una fecha no válida', () => {
  assert.throws(() => catches.createRecord({ dateTimeText: 'mañana', speciesText: 'Lubina' }), /fecha/);
});

test('toCsv escapa separadores, comillas y saltos de línea, y no exporta fotos', () => {
  const record = catches.createRecord({
    dateTimeText: '2026-10-12T10:30',
    species: null,
    speciesText: 'Pez "raro"; especial',
    zoneId: 'atlantico_norte',
    place: { name: 'Vigo', lat: 42.2, lon: -8.7 },
    weightKg: '1,25',
    lengthCm: '42',
    bait: 'gamba',
    notes: 'línea 1\nlínea 2',
    photo: 'data:image/jpeg;base64,AAAA',
    conditions: null,
  });
  const csv = catches.toCsv([record]);
  assert.ok(csv.startsWith('﻿'), 'falta el BOM UTF-8');
  assert.ok(csv.includes('"Pez ""raro""; especial"'));
  assert.ok(csv.includes('"línea 1\nlínea 2"'));
  assert.ok(csv.includes(';1.25;'), 'el peso debe ir con punto decimal');
  assert.ok(!csv.includes('data:image'));
});

test('toJson devuelve un documento JSON con metadatos y las capturas completas', () => {
  const record = catches.createRecord({ dateTimeText: '2026-10-12T10:30', speciesText: 'Lubina', weightKg: '1' });
  const parsed = JSON.parse(catches.toJson([record]));
  assert.equal(parsed.count, 1);
  assert.equal(parsed.catches[0].id, record.id);
  assert.equal(parsed.app, 'PescaApp');
});

test('addCatch, loadAll y deleteCatch funcionan sobre el almacenamiento local', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage();
  try {
    const record = catches.createRecord({ dateTimeText: '2026-10-12T10:30', speciesText: 'Lubina' });
    assert.equal(catches.addCatch(record).ok, true);
    assert.equal(catches.loadAll().length, 1);
    assert.equal(catches.deleteCatch(record.id), true);
    assert.equal(catches.loadAll().length, 0);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('addCatch informa de fallo cuando el almacenamiento está lleno', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage({ failOnWrite: true });
  try {
    const record = catches.createRecord({ dateTimeText: '2026-10-12T10:30', speciesText: 'Lubina' });
    assert.equal(catches.addCatch(record).ok, false);
  } finally {
    globalThis.localStorage = previous;
  }
});
