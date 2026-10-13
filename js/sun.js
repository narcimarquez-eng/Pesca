/**
 * Posición del sol calculada en la app, sin servicios externos: elevación sobre el
 * horizonte para cualquier lugar e instante, y el momento del día que corresponde.
 *
 * Usa el algoritmo aproximado del Almanaque Náutico de EE. UU. (precisión de unas
 * centésimas de grado entre 1950 y 2050), suficiente para distinguir la noche, el
 * crepúsculo y el día.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const RAD = Math.PI / 180;
  const DAY_MS = 24 * 60 * 60 * 1000;

  /** Por debajo de esta elevación es de noche (fin del crepúsculo náutico). */
  const NIGHT_BELOW_DEG = -12;

  /** Por encima de esta elevación es pleno día: el sol ya no está cerca del horizonte. */
  const DAY_ABOVE_DEG = 12;

  const toMs = (date) => (date instanceof Date ? date.getTime() : Number(date));

  /** Elevación del sol en grados sobre el horizonte (negativa por debajo), sin refracción. */
  function solarElevation(date, lat, lon) {
    const days = toMs(date) / DAY_MS + 2440587.5 - 2451545.0; // días desde J2000.0
    const meanLongitude = 280.46 + 0.9856474 * days;
    const meanAnomaly = (357.528 + 0.9856003 * days) * RAD;
    const eclipticLongitude =
      (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
    const obliquity = (23.439 - 0.0000004 * days) * RAD;
    const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
    const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
    const siderealDeg = 280.46061837 + 360.98564736629 * days;
    const hourAngle = (siderealDeg + lon) * RAD - rightAscension;
    const latitude = lat * RAD;
    const sine =
      Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
    return Math.asin(Math.max(-1, Math.min(1, sine))) / RAD;
  }

  /** true si el sol está subiendo (mañana), comparando con la elevación de 10 minutos después. */
  function isRising(date, lat, lon) {
    const ms = toMs(date);
    return solarElevation(ms + 10 * 60 * 1000, lat, lon) > solarElevation(ms, lat, lon);
  }

  /**
   * Momento del día: 'night' (sol por debajo de −12°), 'dawn' o 'dusk' (entre −12° y +12°,
   * según suba o baje; a latitudes medias, una hora antes y después de la salida o la
   * puesta) y 'day' (por encima de +12°).
   */
  function lightPeriod(date, lat, lon) {
    const elevation = solarElevation(date, lat, lon);
    if (elevation < NIGHT_BELOW_DEG) return 'night';
    if (elevation > DAY_ABOVE_DEG) return 'day';
    return isRising(date, lat, lon) ? 'dawn' : 'dusk';
  }

  PescaApp.sun = Object.freeze({
    NIGHT_BELOW_DEG,
    DAY_ABOVE_DEG,
    solarElevation,
    isRising,
    lightPeriod,
  });
})(typeof window !== 'undefined' ? window : globalThis);
