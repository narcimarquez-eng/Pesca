/**
 * Fase lunar calculada en local, sin APIs externas.
 *
 * Usa el modelo de luna media: la fase se obtiene a partir de una luna nueva de
 * referencia y del periodo sinódico medio (29,53 días). El error habitual es de
 * unas pocas horas. Para horas exactas de salida o puesta de la Luna, usa un
 * cálculo astronómico completo (por ejemplo, SunCalc).
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  /** Texto traducido al idioma activo. Se busca al llamarlo, no al cargar el módulo. */
  function t(source, vars) {
    return PescaApp.i18n.t(source, vars);
  }

  /** Periodo sinódico medio de la Luna, en días. */
  const SYNODIC_MONTH_DAYS = 29.530588853;

  /** Luna nueva de referencia: 6 de enero de 2000, 18:14 UTC (día juliano 2451550,1). */
  const REFERENCE_NEW_MOON_JULIAN_DAY = 2451550.1;

  /** Fases en orden. Cada una ocupa un octavo del ciclo, centrado en su punto nominal. */
  const PHASES = Object.freeze([
    { name: PescaApp.i18n.mark('Luna nueva'), icon: '🌑' },
    { name: PescaApp.i18n.mark('Luna creciente'), icon: '🌒' },
    { name: PescaApp.i18n.mark('Cuarto creciente'), icon: '🌓' },
    { name: PescaApp.i18n.mark('Gibosa creciente'), icon: '🌔' },
    { name: PescaApp.i18n.mark('Luna llena'), icon: '🌕' },
    { name: PescaApp.i18n.mark('Gibosa menguante'), icon: '🌖' },
    { name: PescaApp.i18n.mark('Cuarto menguante'), icon: '🌗' },
    { name: PescaApp.i18n.mark('Luna menguante'), icon: '🌘' },
  ]);

  /** Fecha → día juliano (UTC). */
  function toJulianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
  }

  /**
   * Fase lunar en una fecha.
   *
   * - fraction: 0 = luna nueva, 0,5 = luna llena.
   * - distanceToSyzygy: 0 en luna nueva o llena (sizigias, mareas vivas),
   *   0,25 en cuadraturas (mareas muertas).
   * - nextSyzygy: próxima luna llena o nueva, con los días que faltan y la fecha estimada.
   *
   * @param {Date} [date] Fecha y hora. Por defecto, ahora.
   */
  function getMoonPhase(date = new Date()) {
    const julianDay = toJulianDay(date);
    const ageDays = positiveModulo(julianDay - REFERENCE_NEW_MOON_JULIAN_DAY, SYNODIC_MONTH_DAYS);
    const fraction = ageDays / SYNODIC_MONTH_DAYS;
    const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
    const phaseIndex = Math.round(fraction * 8) % 8;
    const distanceToSyzygy = Math.min(fraction, Math.abs(fraction - 0.5), 1 - fraction);

    // En la primera mitad del ciclo la próxima sizigia es la luna llena; en la segunda, la nueva.
    const isNextFull = fraction < 0.5;
    const daysToNextSyzygy = ((isNextFull ? 0.5 : 1) - fraction) * SYNODIC_MONTH_DAYS;

    return {
      ageDays: Math.round(ageDays * 10) / 10,
      fraction,
      illuminationPercent: Math.round(illumination * 100),
      name: t(PHASES[phaseIndex].name),
      icon: PHASES[phaseIndex].icon,
      distanceToSyzygy,
      nextSyzygy: {
        name: isNextFull ? t('Luna llena') : t('Luna nueva'),
        daysAway: Math.round(daysToNextSyzygy * 10) / 10,
        date: new Date(date.getTime() + daysToNextSyzygy * 86400000),
      },
    };
  }

  PescaApp.moon = Object.freeze({
    SYNODIC_MONTH_DAYS,
    PHASES,
    toJulianDay,
    getMoonPhase,
  });
})(typeof window !== 'undefined' ? window : globalThis);
