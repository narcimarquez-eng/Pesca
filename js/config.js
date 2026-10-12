/**
 * Configuración central de PescaApp.
 *
 * Aquí viven las URLs de las APIs, la clave opcional de WorldTides, los tiempos
 * de caché y otros parámetros. Cambia los valores en un único sitio.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const MINUTE_MS = 60 * 1000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;

  PescaApp.config = Object.freeze({
    appName: 'PescaApp',
    version: '1.0.0',

    /**
     * Endpoints de las APIs. Open-Meteo y Nominatim son gratuitas y no piden clave.
     * Nota: en el entorno de desarrollo no se pudo llamar a estos servicios en
     * vivo, así que los nombres de parámetros y variables deben comprobarse la
     * primera vez que se ejecute la app con conexión.
     */
    endpoints: Object.freeze({
      forecast: 'https://api.open-meteo.com/v1/forecast',
      ensemble: 'https://ensemble-api.open-meteo.com/v1/ensemble',
      marine: 'https://marine-api.open-meteo.com/v1/marine',
      archive: 'https://archive-api.open-meteo.com/v1/archive',
      nominatimReverse: 'https://nominatim.openstreetmap.org/reverse',
      nominatimSearch: 'https://nominatim.openstreetmap.org/search',
      worldTides: 'https://www.worldtides.info/api/v3',
    }),

    /**
     * Clave gratuita de WorldTides (requiere registro en worldtides.info).
     * Puedes pegarla aquí o introducirla desde la app, donde se guarda en el
     * localStorage del navegador. No subas tu clave a un repositorio público.
     * Sin clave, la app muestra el coeficiente de marea estimado pero no las
     * alturas ni los extremos de marea.
     */
    worldTidesApiKey: '',

    /** Idioma de los nombres de lugar que devuelve Nominatim. */
    language: 'es',

    /** Tiempos de caché por tipo de dato, en milisegundos. */
    cacheMs: Object.freeze({
      forecast: 15 * MINUTE_MS,
      marine: HOUR_MS,
      tides: 12 * HOUR_MS,
      geocoding: 30 * DAY_MS,
      history: 30 * DAY_MS,
    }),

    /** Tiempo máximo de espera para cada petición de red. */
    requestTimeoutMs: 15000,

    /**
     * Distancia máxima (km) a un punto de referencia costero para considerar que
     * la ubicación está dentro de la cobertura del catálogo de especies.
     */
    maxZoneDistanceKm: 60,

    /**
     * Mareas. stationMaxDistanceKm: distancia máxima a una estación de marea para
     * predecir con sus constantes armónicas. tileSizeDeg debe coincidir con el valor
     * de tools/build-tide-data.mjs; tileFolder es la carpeta de las teselas generadas.
     */
    tides: Object.freeze({
      stationMaxDistanceKm: 60,
      tileSizeDeg: 10,
      tileFolder: 'js/data/tides/',
    }),

    /** Ajustes de las fotos de las capturas (se guardan en localStorage en base64). */
    photo: Object.freeze({
      maxSidePx: 800,
      jpegQuality: 0.7,
      maxInputBytes: 15 * 1024 * 1024,
    }),

    /** Prefijo de las claves de localStorage, para no mezclarlas con otras apps. */
    storagePrefix: 'pescaapp.v1.',
  });
})(typeof window !== 'undefined' ? window : globalThis);
