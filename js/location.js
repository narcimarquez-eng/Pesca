/**
 * Ubicación del usuario: geolocalización del navegador, búsqueda manual por
 * nombre o coordenadas, y geocodificación inversa con Nominatim (OpenStreetMap).
 *
 * Uso de Nominatim: una petición por acción del usuario y caché de 30 días.
 * Nominatim pide no superar una petición por segundo y no hacer uso masivo.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const LOCATION_KEY = 'location';

  /** Patrones aceptados para coordenadas: "43.36, -8.41", "43,36; -8,41" o "43.36 -8.41". */
  const COORDINATE_PATTERNS = [
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
    /^\s*(-?\d+(?:,\d+)?)\s*;\s*(-?\d+(?:,\d+)?)\s*$/,
    /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/,
  ];

  const GEO_ERROR_MESSAGES = {
    1: 'Has denegado el permiso de ubicación. Puedes escribir el lugar manualmente.',
    2: 'No se pudo determinar tu posición. Revisa el GPS o la conexión.',
    3: 'Se agotó el tiempo para obtener tu ubicación. Inténtalo de nuevo.',
  };

  function loadSavedPlace() {
    return PescaApp.utils.storage.read(LOCATION_KEY, null);
  }

  function savePlace(place) {
    return PescaApp.utils.storage.write(LOCATION_KEY, place);
  }

  function clearSavedPlace() {
    PescaApp.utils.storage.remove(LOCATION_KEY);
  }

  /** Interpreta un texto como coordenadas. Devuelve { lat, lon } o null si no son válidas. */
  function parseCoordinates(text) {
    const source = String(text || '');
    const utils = PescaApp.utils;
    for (const pattern of COORDINATE_PATTERNS) {
      const match = pattern.exec(source);
      if (match) {
        const lat = utils.toFiniteNumber(match[1]);
        const lon = utils.toFiniteNumber(match[2]);
        if (lat === null || lon === null) return null;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        return { lat, lon };
      }
    }
    return null;
  }

  /** Pide la posición al navegador. Rechaza con un mensaje en castellano si falla. */
  function requestBrowserPosition() {
    return new Promise((resolve, reject) => {
      const geolocation = root.navigator && root.navigator.geolocation;
      if (!geolocation) {
        reject(new Error('Este navegador no permite obtener tu ubicación. Escribe el lugar manualmente.'));
        return;
      }
      geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracyM: position.coords.accuracy,
          }),
        (error) => reject(new Error(GEO_ERROR_MESSAGES[error.code] || 'No se pudo obtener tu ubicación.')),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 }
      );
    });
  }

  /** Convierte la respuesta de Nominatim en un lugar con nombre legible. */
  function normalizeNominatimPlace(json) {
    const address = (json && json.address) || {};
    const locality = address.town || address.city || address.village || address.municipality || null;
    return {
      name: (json && json.name) || locality || address.county || null,
      locality,
      // En España, "state" es la comunidad autónoma.
      region: address.state || address.region || null,
      country: address.country || null,
      countryCode: address.country_code ? String(address.country_code).toLowerCase() : null,
    };
  }

  /** Geocodificación inversa: coordenadas → nombre del lugar. Usa caché de 30 días. */
  async function reverseGeocode(lat, lon) {
    const utils = PescaApp.utils;
    const config = PescaApp.config;
    const cacheKey = `geo:${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = utils.cache.get(cacheKey, config.cacheMs.geocoding);
    if (cached) return cached;

    const url = utils.buildUrl(config.endpoints.nominatimReverse, {
      format: 'jsonv2',
      lat: lat.toFixed(5),
      lon: lon.toFixed(5),
      zoom: 12,
      addressdetails: 1,
      'accept-language': config.language,
    });
    const json = await utils.fetchJson(url);
    const place = normalizeNominatimPlace(json);
    utils.cache.set(cacheKey, place);
    return place;
  }

  /** Búsqueda de lugares (ciudad, puerto, playa…) en todo el mundo. */
  async function searchPlaces(query) {
    const utils = PescaApp.utils;
    const config = PescaApp.config;
    const url = utils.buildUrl(config.endpoints.nominatimSearch, {
      q: query,
      format: 'jsonv2',
      limit: 5,
      addressdetails: 1,
      'accept-language': config.language,
    });
    const list = await utils.fetchJson(url);
    return (Array.isArray(list) ? list : [])
      .map((item) => {
        const normalized = normalizeNominatimPlace(item);
        return {
          name: normalized.name || item.display_name || query,
          locality: normalized.locality,
          region: normalized.region,
          countryCode: normalized.countryCode,
          lat: Number(item.lat),
          lon: Number(item.lon),
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
  }

  /**
   * Crea el objeto de ubicación que guarda la app: coordenadas, nombre, zona
   * del catálogo y cobertura.
   */
  function buildPlace({ lat, lon, name = null, locality = null, region = null, countryCode = null, source = 'manual' }) {
    // El catálogo de especies, las tallas y las vedas son de España. Solo se asigna zona en España:
    // en otro país, o si no se sabe el país, no hay referencia aunque la costa esté cerca.
    const zone = countryCode === 'es' ? PescaApp.species.classifyZone(lat, lon) : null;
    const fallbackName = `Punto ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    return {
      name: name || fallbackName,
      locality,
      region,
      lat: PescaApp.utils.round(lat, 5),
      lon: PescaApp.utils.round(lon, 5),
      source,
      savedAt: new Date().toISOString(),
      countryCode,
      zoneId: zone ? zone.zoneId : null,
      zoneName: zone ? zone.zoneName : null,
      anchorName: zone ? zone.anchorName : null,
      zoneDistanceKm: zone ? zone.distanceKm : null,
      inCoverage: zone ? zone.inCoverage : false,
    };
  }

  /**
   * Crea un lugar a partir de coordenadas. Si Nominatim falla, el lugar se crea
   * igualmente con las coordenadas como nombre.
   */
  async function placeFromCoordinates(lat, lon, source = 'manual') {
    let geo = null;
    try {
      geo = await reverseGeocode(lat, lon);
    } catch (error) {
      geo = null;
    }
    return buildPlace({
      lat,
      lon,
      name: geo ? geo.name : null,
      locality: geo ? geo.locality : null,
      region: geo ? geo.region : null,
      countryCode: geo ? geo.countryCode : null,
      source,
    });
  }

  PescaApp.locationService = Object.freeze({
    loadSavedPlace,
    savePlace,
    clearSavedPlace,
    parseCoordinates,
    requestBrowserPosition,
    normalizeNominatimPlace,
    reverseGeocode,
    searchPlaces,
    buildPlace,
    placeFromCoordinates,
  });
})(typeof window !== 'undefined' ? window : globalThis);
