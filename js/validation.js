/**
 * Validación de capturas: talla mínima de referencia, vedas y protección, y
 * estimación del peso a partir de la longitud (W = a · L^b).
 *
 * Las alertas tienen un nivel:
 * - 'danger'  (rojo): debe devolverse o hay un problema grave.
 * - 'warning' (ámbar): conviene revisarlo.
 * - 'ok'      (verde): cumple lo comprobado.
 * - 'info'    (azul): dato que falta o aviso general.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  /** Exponente de la relación longitud-peso para peces de cuerpo alargado. */
  const DEFAULT_LENGTH_WEIGHT_EXPONENT = 3;

  /** Coeficiente genérico: W (kg) = 0,00001 · L^3 (L en cm). Da unos 0,64 kg para 40 cm. */
  const DEFAULT_LENGTH_WEIGHT_COEFFICIENT = 0.00001;

  /**
   * Relación longitud-peso de una especie. Prioridad:
   * 1) species.lengthWeight, si existe (dato propio con su fuente).
   * 2) Calibración con la longitud y el peso máximos orientativos (b = 3).
   * 3) Aproximación genérica.
   */
  function getLengthWeightRelation(species) {
    if (species && species.lengthWeight && Number.isFinite(species.lengthWeight.a) && Number.isFinite(species.lengthWeight.b)) {
      return {
        a: species.lengthWeight.a,
        b: species.lengthWeight.b,
        source: species.lengthWeight.source || 'Dato propio de la especie',
      };
    }
    if (species && species.maxLengthCm > 0 && species.maxWeightKg > 0) {
      return {
        a: species.maxWeightKg / species.maxLengthCm ** DEFAULT_LENGTH_WEIGHT_EXPONENT,
        b: DEFAULT_LENGTH_WEIGHT_EXPONENT,
        source: 'Calibrada con la longitud y el peso máximos orientativos',
      };
    }
    return {
      a: DEFAULT_LENGTH_WEIGHT_COEFFICIENT,
      b: DEFAULT_LENGTH_WEIGHT_EXPONENT,
      source: 'Aproximación genérica para peces de cuerpo alargado',
    };
  }

  /** Estima el peso en kg a partir de la longitud en cm. Devuelve null si la longitud no es válida. */
  function estimateWeightKg(lengthCm, species) {
    const length = PescaApp.utils.toFiniteNumber(lengthCm);
    if (!(length > 0)) return null;
    const relation = getLengthWeightRelation(species);
    return relation.a * length ** relation.b;
  }

  /** Talla mínima de referencia en cm para una zona. Devuelve null si no hay dato confirmado. */
  function getMinSizeCm(species, zoneId) {
    if (!species || !species.minSizeCm || !zoneId) return null;
    const value = species.minSizeCm[zoneId];
    return Number.isFinite(value) ? value : null;
  }

  /** Veda aplicable a la especie en la zona y en el mes indicado, o null si no hay ninguna. */
  function findClosedSeason(species, zoneId, month) {
    if (!species || !Array.isArray(species.closedSeasons)) return null;
    return (
      species.closedSeasons.find(
        (season) =>
          Array.isArray(season.months) &&
          season.months.includes(month) &&
          (!Array.isArray(season.zones) || season.zones.includes(zoneId))
      ) || null
    );
  }

  /**
   * Comprueba una captura y devuelve las alertas en castellano.
   *
   * @param {object} input
   * @param {object|null} input.species Especie del catálogo (o null si no está).
   * @param {string|null} input.zoneId Zona de la captura.
   * @param {number|null} input.lengthCm Longitud en cm (opcional).
   * @param {Date} [input.dateTime] Fecha de la captura (para el mes de la veda).
   */
  function evaluateCatch({ species = null, zoneId = null, lengthCm = null, dateTime = new Date() } = {}) {
    const length = PescaApp.utils.toFiniteNumber(lengthCm);
    const alerts = [];

    if (!species) {
      alerts.push({
        level: 'info',
        code: 'unknown-species',
        message: 'Especie fuera del catálogo: no se pueden comprobar tallas ni vedas.',
      });
      return { alerts, mustRelease: false, minSizeCm: null };
    }

    if (species.protected) {
      alerts.push({
        level: 'danger',
        code: 'protected',
        message: species.protectionNote || 'Especie protegida: no debe retenerse.',
      });
    }

    const minSizeCm = getMinSizeCm(species, zoneId);
    if (minSizeCm === null) {
      alerts.push({
        level: 'info',
        code: 'no-reference-size',
        message: 'Sin talla de referencia confirmada para esta especie en esta zona. Consulta la normativa autonómica.',
      });
    } else if (length === null) {
      alerts.push({
        level: 'info',
        code: 'missing-length',
        message: `Introduce la longitud para comprobar la talla mínima de referencia (${minSizeCm} cm).`,
      });
    } else if (length < minSizeCm) {
      alerts.push({
        level: 'danger',
        code: 'below-min-size',
        message: `Por debajo de la talla mínima de referencia (${minSizeCm} cm). Debe devolverse.`,
      });
    } else {
      alerts.push({
        level: 'ok',
        code: 'legal-size',
        message: `Talla igual o superior a la mínima de referencia (${minSizeCm} cm).`,
      });
    }

    const month = dateTime instanceof Date && !Number.isNaN(dateTime.getTime()) ? dateTime.getMonth() + 1 : null;
    const closedSeason = month === null ? null : findClosedSeason(species, zoneId, month);
    if (closedSeason) {
      alerts.push({
        level: 'danger',
        code: 'closed-season',
        message: `Periodo de veda o protección (${closedSeason.reason || 'sin motivo indicado'}). Debe devolverse.`,
      });
    } else if (!Array.isArray(species.closedSeasons) || species.closedSeasons.length === 0) {
      alerts.push({
        level: 'info',
        code: 'no-closed-season-data',
        message: 'No hay vedas registradas en la base de datos para esta especie. Comprueba la normativa vigente.',
      });
    }

    if (species.alertNote) {
      alerts.push({ level: 'warning', code: 'species-note', message: species.alertNote });
    }

    return {
      alerts,
      mustRelease: alerts.some((alert) => alert.level === 'danger'),
      minSizeCm,
    };
  }

  PescaApp.validation = Object.freeze({
    DEFAULT_LENGTH_WEIGHT_EXPONENT,
    getLengthWeightRelation,
    estimateWeightKg,
    getMinSizeCm,
    findClosedSeason,
    evaluateCatch,
  });
})(typeof window !== 'undefined' ? window : globalThis);
