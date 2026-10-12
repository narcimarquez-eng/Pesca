/**
 * Previsión por horas: una fila cada 3 horas durante 72 horas, con tiempo, viento,
 * presión, lluvia, temperatura del agua, marea y la valoración de pesca de cada hora.
 *
 * Son funciones puras: reciben datos ya descargados y devuelven filas, así que se
 * prueban sin red ni DOM. app.js las dibuja en la tarjeta de previsión.
 *
 * Las horas del pronóstico son locales del lugar. La marea y el coeficiente usan el
 * día local de la estación de marea, que puede ser otra zona horaria.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const HOUR_MS = 60 * 60 * 1000;
  const HALF_HOUR_MS = 30 * 60 * 1000;
  /** Tendencia de la marea: un cambio de menos de 2,5 cm en media hora (unos 5 cm por hora) es estable. */
  const TIDE_STABLE_M = 0.025;

  const DEFAULT_STEP_HOURS = 3;
  const DEFAULT_HOURS = 72;
  const BEST_MOMENTS_COUNT = 3;
  /** Dos mejores momentos deben estar separados al menos por estas horas. */
  const BEST_MOMENTS_GAP_HOURS = 6;
  /** Solo se destacan horas de al menos 3 estrellas: si no hay buenas horas, no se inventan. */
  const BEST_MOMENTS_MIN_STARS = 3;

  const COEFFICIENT_SOURCE_HARMONIC = 'predicción armónica';
  const COEFFICIENT_SOURCE_MOON = 'estimación por fase lunar';

  /** Índice de la primera hora de la serie cuya franja de una hora contiene `nowMs`. */
  function findStartIndex(times, utcOffsetSeconds, nowMs) {
    const weather = PescaApp.weather;
    return times.findIndex((text) => {
      const startMs = weather.localTimeToMs(text, utcOffsetSeconds);
      return startMs !== null && startMs + HOUR_MS > nowMs;
    });
  }

  /**
   * Altura de la marea en un instante, su tendencia y las horas desde el extremo más
   * cercano. Devuelve null si el instante queda fuera de la ventana de alturas.
   */
  function tideAtTime(tideState, ts) {
    const tides = PescaApp.tides;
    const heights = tideState && tideState.heights;
    if (!heights || heights.length < 2) return null;

    const heightM = tides.heightAt(heights, ts);
    if (heightM === null) return null;

    // La tendencia compara con media hora antes o después, lo que esté dentro de la ventana.
    const ahead = tides.heightAt(heights, ts + HALF_HOUR_MS);
    const behind = tides.heightAt(heights, ts - HALF_HOUR_MS);
    let change = 0;
    if (ahead !== null) change = ahead - heightM;
    else if (behind !== null) change = heightM - behind;

    const trend = change > TIDE_STABLE_M ? 'rising' : change < -TIDE_STABLE_M ? 'falling' : 'stable';
    const { hoursFromExtreme } = tides.summarize(tideState, ts);
    return { heightM, trend, hoursFromExtreme };
  }

  /**
   * Coeficiente de la hora: el del día local de la estación si la predicción armónica lo
   * tiene; si no, la estimación por fase lunar, que se indica como tal.
   */
  function coefficientAt(ts, daysByKey, timeZone) {
    const tides = PescaApp.tides;
    const day = daysByKey.get(tides.localDateKey(ts, timeZone));
    if (day && Number.isFinite(day.coefficient)) {
      return { coefficient: day.coefficient, source: COEFFICIENT_SOURCE_HARMONIC };
    }
    return { coefficient: tides.estimateCoefficient(new Date(ts)), source: COEFFICIENT_SOURCE_MOON };
  }

  /** Una fila de la previsión para la posición `index` de la serie horaria. */
  function buildRow({ forecast, index, waterSeries, tideState, daysByKey, timeZone, isCurrent }) {
    const { weather, moon, activity } = PescaApp;
    const hourly = forecast.hourly;
    const timeText = hourly.times[index];
    const ts = weather.localTimeToMs(timeText, forecast.utcOffsetSeconds);
    const condition = weather.describeWeatherCode(hourly.weatherCode[index]);
    const tide = tideAtTime(tideState, ts);
    const coefficient = coefficientAt(ts, daysByKey, timeZone);

    const rating = activity.computeFishingRating({
      pressureHpa: hourly.pressureHpa[index],
      pressureTrend3hHpa: hourly.pressureTrend3hHpa[index],
      moonDistanceToSyzygy: moon.getMoonPhase(new Date(ts)).distanceToSyzygy,
      windSpeedKmh: hourly.windSpeedKmh[index],
      windGustsKmh: hourly.windGustsKmh[index],
      precipitationMm: hourly.precipitationMm[index],
      weatherCode: hourly.weatherCode[index],
      hoursFromTideExtreme: tide ? tide.hoursFromExtreme : null,
      tideCoefficient: coefficient.coefficient,
    });

    return {
      ts,
      timeText,
      dateKey: timeText.slice(0, 10),
      hourText: timeText.slice(11, 16),
      isCurrent,
      weather: { label: condition.label, icon: condition.icon },
      airTemperatureC: hourly.temperatureC[index],
      windSpeedKmh: hourly.windSpeedKmh[index],
      windGustsKmh: hourly.windGustsKmh[index],
      windDirectionDeg: hourly.windDirectionDeg[index],
      pressureHpa: hourly.pressureHpa[index],
      pressureTrend3hHpa: hourly.pressureTrend3hHpa[index],
      precipitationMm: hourly.precipitationMm[index],
      waterTemperatureC: weather.waterValueAt(waterSeries, timeText),
      tide,
      coefficient: coefficient.coefficient,
      coefficientSource: coefficient.source,
      rating,
    };
  }

  /**
   * Filas de la previsión desde la hora actual. Cada fila es una hora de la serie
   * separada `stepHours` de la anterior, así que con 3 h y 72 h salen 24 filas.
   *
   * @param {object} input
   * @param {object} input.forecast Pronóstico normalizado (weather.getForecast), con `hourly`.
   * @param {object|null} input.waterSeries Temperatura del agua (weather.getWaterSeries), opcional.
   * @param {object|null} input.tideState Vista de mareas (tides.getLiveTides), opcional.
   * @param {number} input.nowMs Instante actual en milisegundos.
   */
  function buildForecastRows({
    forecast,
    waterSeries = null,
    tideState = null,
    nowMs,
    stepHours = DEFAULT_STEP_HOURS,
    hours = DEFAULT_HOURS,
  } = {}) {
    const hourly = forecast && forecast.hourly;
    if (!hourly || !Array.isArray(hourly.times) || !Number.isFinite(nowMs)) return [];

    const startIndex = findStartIndex(hourly.times, forecast.utcOffsetSeconds, nowMs);
    if (startIndex < 0) return [];

    const station = tideState && tideState.station;
    const timeZone = (station && station.timeZone) || forecast.timezone || undefined;
    const days = (tideState && tideState.daily && tideState.daily.days) || [];
    const daysByKey = new Map(days.map((day) => [day.dateKey, day]));

    const rows = [];
    for (let step = 0; step * stepHours < hours; step += 1) {
      const index = startIndex + step * stepHours;
      if (index >= hourly.times.length) break;
      rows.push(
        buildRow({
          forecast,
          index,
          waterSeries,
          tideState,
          daysByKey,
          timeZone,
          isCurrent: step === 0,
        })
      );
    }
    return rows;
  }

  /**
   * Hasta `count` horas con mejor valoración, separadas al menos `gapHours` entre sí y con
   * al menos BEST_MOMENTS_MIN_STARS estrellas. Se devuelven ordenadas por hora.
   */
  function pickBestMoments(rows, count = BEST_MOMENTS_COUNT, gapHours = BEST_MOMENTS_GAP_HOURS) {
    const candidates = rows
      .filter((row) => row.rating && Number.isFinite(row.rating.score) && row.rating.stars >= BEST_MOMENTS_MIN_STARS)
      .sort((a, b) => b.rating.score - a.rating.score || a.ts - b.ts);

    const chosen = [];
    candidates.forEach((row) => {
      if (chosen.length >= count) return;
      const farEnough = chosen.every((other) => Math.abs(other.ts - row.ts) >= gapHours * HOUR_MS);
      if (farEnough) chosen.push(row);
    });
    return chosen.sort((a, b) => a.ts - b.ts);
  }

  PescaApp.forecast = Object.freeze({
    DEFAULT_STEP_HOURS,
    DEFAULT_HOURS,
    BEST_MOMENTS_COUNT,
    BEST_MOMENTS_GAP_HOURS,
    BEST_MOMENTS_MIN_STARS,
    COEFFICIENT_SOURCE_HARMONIC,
    COEFFICIENT_SOURCE_MOON,
    tideAtTime,
    buildForecastRows,
    pickBestMoments,
  });
})(typeof window !== 'undefined' ? window : globalThis);
