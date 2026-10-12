/**
 * Acceso al catálogo de especies: zonas, búsquedas y asignación de una
 * ubicación a la zona más cercana del catálogo.
 *
 * Los datos viven en js/data/species-data.js. Este módulo solo los consulta.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function catalog() {
    return PescaApp.speciesData;
  }

  function getZones() {
    return catalog().zones.slice();
  }

  function getZoneById(zoneId) {
    return catalog().zones.find((zone) => zone.id === zoneId) || null;
  }

  function getSpeciesList() {
    return catalog().species.slice();
  }

  function getSpeciesById(speciesId) {
    return catalog().species.find((species) => species.id === speciesId) || null;
  }

  /** Especies de una zona, ordenadas por nombre común en castellano. */
  function getSpeciesForZone(zoneId) {
    return getSpeciesList()
      .filter((species) => species.zones.includes(zoneId))
      .sort((a, b) => a.commonName.localeCompare(b.commonName, 'es'));
  }

  /**
   * Busca especies por nombre común, científico o alias (sin acentos ni mayúsculas).
   * Prioriza las coincidencias que empiezan por el texto buscado.
   *
   * @param {string} query Texto escrito por el usuario.
   * @param {{zoneId?: string|null, limit?: number}} [options]
   */
  function searchSpecies(query, options = {}) {
    const { zoneId = null, limit = 10 } = options;
    const utils = PescaApp.utils;
    const needle = utils.normalizeText(query);
    const pool = zoneId ? getSpeciesForZone(zoneId) : getSpeciesList();

    if (!needle) return pool.slice(0, limit);

    const ranked = [];
    pool.forEach((species) => {
      const names = [species.commonName, species.scientificName, ...(species.aliases || [])].map(
        utils.normalizeText
      );
      const startsWithNeedle = names.some((name) => name.startsWith(needle));
      const containsNeedle = names.some((name) => name.includes(needle));
      if (startsWithNeedle || containsNeedle) {
        ranked.push({ species, rank: startsWithNeedle ? 0 : 1 });
      }
    });

    return ranked
      .sort((a, b) => a.rank - b.rank || a.species.commonName.localeCompare(b.species.commonName, 'es'))
      .slice(0, limit)
      .map((item) => item.species);
  }

  /** Busca una especie por nombre exacto (común, científico o alias). Devuelve null si no existe. */
  function findSpeciesByName(name) {
    const utils = PescaApp.utils;
    const needle = utils.normalizeText(name);
    if (!needle) return null;
    return (
      getSpeciesList().find((species) =>
        [species.commonName, species.scientificName, ...(species.aliases || [])].some(
          (candidate) => utils.normalizeText(candidate) === needle
        )
      ) || null
    );
  }

  /**
   * Asigna unas coordenadas a la zona del punto de referencia más cercano.
   * `inCoverage` indica si la distancia a ese punto es razonable para usar el catálogo.
   */
  function classifyZone(lat, lon) {
    const utils = PescaApp.utils;
    let best = null;
    catalog().zoneAnchors.forEach((anchor) => {
      const distance = utils.distanceKm(lat, lon, anchor.lat, anchor.lon);
      if (!best || distance < best.distanceKm) {
        best = { anchor, distanceKm: distance };
      }
    });

    if (!best) {
      return { zoneId: null, zoneName: null, anchorName: null, distanceKm: null, inCoverage: false };
    }

    const zone = getZoneById(best.anchor.zoneId);
    return {
      zoneId: best.anchor.zoneId,
      zoneName: zone ? zone.name : best.anchor.zoneId,
      anchorName: best.anchor.name,
      distanceKm: utils.round(best.distanceKm, 1),
      inCoverage: best.distanceKm <= PescaApp.config.maxZoneDistanceKm,
    };
  }

  /** Lista de meses en abreviatura, en orden del año. Ejemplo: [10, 11, 1] → "ene, oct, nov". */
  function formatMonths(months) {
    if (!Array.isArray(months) || months.length === 0) return 'Sin periodo definido';
    return [...months]
      .sort((a, b) => a - b)
      .map((month) => MONTH_NAMES[month - 1])
      .join(', ');
  }

  PescaApp.species = Object.freeze({
    getZones,
    getZoneById,
    getSpeciesList,
    getSpeciesById,
    getSpeciesForZone,
    searchSpecies,
    findSpeciesByName,
    classifyZone,
    formatMonths,
  });
})(typeof window !== 'undefined' ? window : globalThis);
