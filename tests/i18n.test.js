'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('./helpers');

const { i18n } = App;

test('en castellano, t() devuelve el texto original y sustituye los marcadores', () => {
  assert.equal(i18n.t('Índice  de  actividad'), 'Índice  de  actividad', 'conserva los espacios del original');
  assert.equal(i18n.t('Presión de {value} hPa', { value: 1015 }), 'Presión de 1015 hPa');
  assert.equal(i18n.t('Sin {missing}', {}), 'Sin {missing}', 'un marcador sin valor se deja tal cual');
});

test('con un idioma activo usa su traducción y, si falta, la inglesa, y si no hay ninguna, el original', async () => {
  i18n.register('en', { 'Índice de actividad': 'Activity index', 'Sin datos': 'No data' });
  i18n.register('fr', { 'Índice de actividad': 'Indice d’activité', 'Presión de {value} hPa': 'Pression de {value} hPa' });
  assert.equal(await i18n.setLocale('fr', { countryCode: 'FR' }), 'fr');
  assert.equal(i18n.t('Índice de actividad'), 'Indice d’activité');
  assert.equal(i18n.t('Sin datos'), 'No data', 'falta en francés: se usa inglés');
  assert.equal(i18n.t('Texto sin traducir'), 'Texto sin traducir', 'y si tampoco está en inglés, el original');
  assert.equal(i18n.t('Presión de {value} hPa', { value: 1012 }), 'Pression de 1012 hPa');
});

test('las claves ignoran los espacios repetidos al buscar la traducción', async () => {
  i18n.register('fr', { 'Dos  espacios   aquí': 'Deux espaces ici' });
  await i18n.setLocale('fr');
  assert.equal(i18n.t('Dos espacios aquí'), 'Deux espaces ici');
  assert.equal(i18n.t('Dos\n   espacios aquí'), 'Deux espaces ici');
});

test('resolveLocale: el elegido a mano, luego el país del lugar, luego el navegador, y por último inglés', () => {
  assert.equal(i18n.resolveLocale({ preferred: 'fr', countryCode: 'ES', browserLanguages: ['de-DE'] }), 'fr');
  assert.equal(i18n.resolveLocale({ preferred: 'auto', countryCode: 'PT', browserLanguages: ['en-US'] }), 'pt');
  assert.equal(i18n.resolveLocale({ preferred: 'auto', countryCode: 'ES' }), 'es');
  assert.equal(i18n.resolveLocale({ preferred: 'auto', countryCode: 'US', browserLanguages: ['fr-FR'] }), 'fr');
  assert.equal(i18n.resolveLocale({ preferred: 'auto', countryCode: 'SG', browserLanguages: ['zh-TW'] }), 'en');
  assert.equal(i18n.resolveLocale({ preferred: 'auto', browserLanguages: ['zh-CN', 'en'] }), 'zh-Hans');
  assert.equal(i18n.resolveLocale({ preferred: 'xx' }), 'en', 'un idioma desconocido no se acepta');
  assert.equal(i18n.resolveLocale({}), 'en');
});

test('los países de habla hispana, portuguesa, francesa, árabe y china tienen su idioma', () => {
  assert.equal(i18n.localeForCountry('mx'), 'es');
  assert.equal(i18n.localeForCountry('BR'), 'pt');
  assert.equal(i18n.localeForCountry('SN'), 'fr');
  assert.equal(i18n.localeForCountry('EG'), 'ar');
  assert.equal(i18n.localeForCountry('CN'), 'zh-Hans');
  assert.equal(i18n.localeForCountry('NO'), null, 'Noruega no tiene catálogo: decide el navegador o inglés');
  assert.equal(i18n.localeForCountry(null), null);
});

test('intlLocale combina el idioma con la convención del país', async () => {
  i18n.register('pt', {});
  assert.equal(await i18n.setLocale('pt', { countryCode: 'PT' }), 'pt');
  assert.equal(i18n.intlLocale(), 'pt-PT');
  await i18n.setLocale('pt', { countryCode: 'BR' });
  assert.equal(i18n.intlLocale(), 'pt-BR');
  await i18n.setLocale('es');
  assert.equal(i18n.intlLocale(), 'es-ES');
});

test('el árabe se escribe de derecha a izquierda y es el único idioma con esa dirección', async () => {
  i18n.register('ar', {});
  await i18n.setLocale('ar');
  assert.equal(i18n.direction(), 'rtl');
  assert.equal(Object.values(i18n.LOCALES).filter((locale) => locale.dir === 'rtl').length, 1);
  await i18n.setLocale('es');
  assert.equal(i18n.direction(), 'ltr');
});

test('un idioma sin catálogo se sustituye por inglés, y el selector ofrece todos los idiomas', async () => {
  assert.equal(await i18n.setLocale('xx'), 'en');
  const codes = i18n.localeOptions().map((option) => option.code);
  assert.ok(codes.includes('es') && codes.includes('en') && codes.includes('zh-Hans'));
});

/** Carga cada catálogo de js/i18n/ en un entorno aislado, igual que tools/i18n-check.mjs. */
function loadCatalogs() {
  const folder = path.join(__dirname, '..', 'js', 'i18n');
  const catalogs = {};
  for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.js'))) {
    let registered = null;
    const sandbox = { PescaApp: { i18n: { register: (code, messages) => { registered = { code, messages }; } } } };
    vm.runInNewContext(fs.readFileSync(path.join(folder, file), 'utf8'), sandbox, { filename: file });
    assert.equal(registered.code, path.basename(file, '.js'), `${file} debe registrarse con su mismo nombre`);
    catalogs[registered.code] = registered.messages;
  }
  return catalogs;
}

/** Marcadores {nombre} de un texto, ordenados, para comparar el original con la traducción. */
const markersOf = (text) => [...text.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort().join(' ');

test('todos los catálogos tienen las claves del inglés, sin textos vacíos y con los mismos marcadores', () => {
  const catalogs = loadCatalogs();
  const keys = Object.keys(catalogs.en).sort();
  assert.ok(keys.length > 0, 'el catálogo inglés no está vacío');
  for (const [code, messages] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(messages).sort(), keys, `${code}: claves distintas de las del inglés`);
    for (const key of keys) {
      assert.notEqual(messages[key].trim(), '', `${code}: texto vacío en «${key}»`);
      assert.equal(markersOf(messages[key]), markersOf(key), `${code}: marcadores distintos en «${key}»`);
    }
  }
});

test('cada idioma de LOCALES, salvo el castellano, tiene su catálogo', () => {
  const catalogs = loadCatalogs();
  for (const code of Object.keys(i18n.LOCALES).filter((locale) => locale !== 'es')) {
    assert.ok(catalogs[code], `falta js/i18n/${code}.js`);
  }
});

test('tools/i18n-check.mjs pasa: todos los textos del código tienen traducción en cada idioma', () => {
  const checker = path.join(__dirname, '..', 'tools', 'i18n-check.mjs');
  const run = spawnSync(process.execPath, [checker], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout);
});
