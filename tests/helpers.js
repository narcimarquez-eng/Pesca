/**
 * Carga los módulos de PescaApp en el mismo orden que index.html.
 * app.js no se carga aquí porque depende del DOM.
 */
'use strict';

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_FILES = [
  'js/config.js',
  'js/utils.js',
  'js/moon.js',
  'js/data/species-data.js',
  'js/species.js',
  'js/location.js',
  'js/weather.js',
  'js/tides.js',
  'js/activity.js',
  'js/validation.js',
  'js/catches.js',
];

MODULE_FILES.forEach((file) => require(path.join(ROOT, file)));

/** Almacenamiento en memoria con la misma interfaz que localStorage. */
function createMemoryStorage({ failOnWrite = false } = {}) {
  const data = new Map();
  return {
    get length() {
      return data.size;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (failOnWrite) {
        throw new Error('QuotaExceededError (simulado)');
      }
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

module.exports = globalThis.PescaApp;
module.exports.createMemoryStorage = createMemoryStorage;
