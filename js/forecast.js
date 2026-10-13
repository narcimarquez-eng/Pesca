/**
 * Previsión por horas: una fila por hora durante 72 horas, con tiempo, viento, presión,
 * lluvia, temperatura del agua, marea y valoración de pesca.
 *
 * Cada fila tiene un valor central (la previsión de Open-Meteo, la misma de la tarjeta
 * del tiempo) y, si hay escenarios, su margen: el rango entre el percentil 10 y el 90 de
 * los miembros del modelo de conjunto. También lleva la probabilidad de lluvia (porcentaje
 * de escenarios con lluvia en esa hora) y el rango de estrellas de cada escenario.
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

  const DEFAULT_STEP_HOURS = 1;
  const DEFAULT_HOURS = 72;
  const TREND_HOURS = 3;
  /** Un escenario cuenta como lluvia desde esta cantidad de precipitación en la hora. */
  const RAIN_CHANCE_MM = 0.1;
  /** Percentiles del margen entre escenarios: del 10 % al 90 %. */
  const SCENARIO_LOW = 0.1;
  const SCENARIO_HIGH = 0.9;

  const BEST_MOMENTS_COUNT = 3;
  /** Dos mejores momentos deben estar separados al menos por estas horas. */
  const BEST_MOMENTS_GAP_HOURS = 6;
  /** Solo se destacan horas de al menos 3 estrellas: si no hay buenas horas, no se inventan. */
  const BEST_MOMENTS_MIN_STARS = 3;

  const COEFFICIENT_SOURCE_HARMONIC = PescaApp.tides.COEFFICIENT_SOURCE.HARMONIC;
  const COEFFICIENT_SOURCE_MOON = PescaApp.tides.COEFFICIENT_SOURCE.MOON;

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

  /**
   * Margen de una variable entre escenarios: del percentil bajo al alto. Se amplía para
   * incluir el valor central, así el margen siempre contiene la cifra que se muestra.
   */
  function marginOf(values, central) {
    const utils = PescaApp.utils;
    const low = utils.quantile(values, SCENARIO_LOW);
    const high = utils.quantile(values, SCENARIO_HIGH);
    if (low === null || high === null) return null;
    if (!Number.isFinite(central)) return { low, high };
    return { low: Math.min(low, central), high: Math.max(high, central) };
  }

  /** Margen de estrellas entre escenarios: de la estrella del percentil bajo a la del alto. */
  function starMarginOf(scores, centralStars) {
    const { activity } = PescaApp;
    const low = PescaApp.utils.quantile(scores, SCENARIO_LOW);
    const high = PescaApp.utils.quantile(scores, SCENARIO_HIGH);
    if (low === null || high === null) return null;
    const lowStars = activity.ratingFor(low).stars;
    const highStars = activity.ratingFor(high).stars;
    if (!Number.isFinite(centralStars)) return { low: lowStars, high: highStars };
    return { low: Math.min(lowStars, centralStars), high: Math.max(highStars, centralStars) };
  }

  /**
   * Margen de los escenarios en una hora. Cada escenario se valora con su propio viento,
   * lluvia y presión. El código de tiempo, la luna y la marea son los de la previsión central,
   * porque el modelo de conjunto no da un código de tiempo por escenario. Devuelve null si
   * no hay datos de escenarios para esa hora.
   *
   * @param {object} input
   * @param {object} input.ensemble Escenarios normalizados (weather.getEnsemble).
   * @param {number} input.index Posición de la hora dentro de los escenarios.
   * @param {object} input.central Valores centrales: temperatureC, windSpeedKmh, windGustsKmh y stars.
   */
  function summarizeScenarios({
    ensemble,
    index,
    central,
    weatherCode,
    moonDistance,
    hoursFromTideExtreme,
    tideCoefficient,
    light = {},
  }) {
    const { weather, activity } = PescaApp;
    const utils = PescaApp.utils;
    const temperatures = [];
    const winds = [];
    const gusts = [];
    const scores = [];
    let withRain = 0;
    let rainy = 0;

    ensemble.members.forEach((member) => {
      const at = (field) => utils.toFiniteNumber(member[field][index]);
      const temperatureC = at('temperatureC');
      const pressureHpa = at('pressureHpa');
      const precipitationMm = at('precipitationMm');
      const windSpeedKmh = at('windSpeedKmh');
      const windGustsKmh = at('windGustsKmh');

      if (temperatureC !== null) temperatures.push(temperatureC);
      if (windSpeedKmh !== null) winds.push(windSpeedKmh);
      if (windGustsKmh !== null) gusts.push(windGustsKmh);
      if (precipitationMm !== null) {
        withRain += 1;
        if (precipitationMm >= RAIN_CHANCE_MM) rainy += 1;
      }

      const score = activity.fishingScore({
        ...light,
        pressureHpa,
        pressureTrend3hHpa: weather.computePressureTrend(member.pressureHpa, index, pressureHpa, TREND_HOURS),
        moonDistanceToSyzygy: moonDistance,
        windSpeedKmh,
        windGustsKmh,
        precipitationMm,
        weatherCode,
        hoursFromTideExtreme,
        tideCoefficient,
      });
      if (score !== null) scores.push(score);
    });

    if (!temperatures.length && !withRain) return null;
    return {
      count: ensemble.members.length,
      temperatureC: marginOf(temperatures, central.temperatureC),
      windSpeedKmh: marginOf(winds, central.windSpeedKmh),
      windGustsKmh: marginOf(gusts, central.windGustsKmh),
      rainChancePercent: withRain ? Math.round((rainy / withRain) * 100) : null,
      rating: starMarginOf(scores, central.stars),
    };
  }

  /** Una fila de la previsión para la posición `index` de la serie horaria. */
  function buildRow({
    lat,
    lon,
    forecast,
    index,
    ensemble,
    ensembleIndex,
    waterSeries,
    tideState,
    daysByKey,
    timeZone,
    isCurrent,
  }) {
    const { weather, moon, activity } = PescaApp;
    const hourly = forecast.hourly;
    const timeText = hourly.times[index];
    const ts = weather.localTimeToMs(timeText, forecast.utcOffsetSeconds);
    const condition = weather.describeWeatherCode(hourly.weatherCode[index]);
    const tide = tideAtTime(tideState, ts);
    const coefficient = coefficientAt(ts, daysByKey, timeZone);
    const moonDistance = moon.getMoonPhase(new Date(ts)).distanceToSyzygy;
    const hoursFromTideExtreme = tide ? tide.hoursFromExtreme : null;
    const hasPlace = Number.isFinite(lat) && Number.isFinite(lon);
    // La luz es la misma en todos los escenarios: la nubosidad es la de la previsión central.
    const light = {
      sunElevationDeg: hasPlace ? PescaApp.sun.solarElevation(ts, lat, lon) : null,
      sunRising: hasPlace ? PescaApp.sun.isRising(ts, lat, lon) : false,
      cloudCoverPct: hourly.cloudCoverPercent ? hourly.cloudCoverPercent[index] : null,
    };

    const rating = activity.computeFishingRating({
      ...light,
      pressureHpa: hourly.pressureHpa[index],
      pressureTrend3hHpa: hourly.pressureTrend3hHpa[index],
      moonDistanceToSyzygy: moonDistance,
      windSpeedKmh: hourly.windSpeedKmh[index],
      windGustsKmh: hourly.windGustsKmh[index],
      precipitationMm: hourly.precipitationMm[index],
      weatherCode: hourly.weatherCode[index],
      hoursFromTideExtreme,
      tideCoefficient: coefficient.coefficient,
    });

    const scenarioIndex = ensembleIndex ? ensembleIndex.get(timeText) : undefined;
    const scenarios =
      scenarioIndex === undefined
        ? null
        : summarizeScenarios({
            ensemble,
            index: scenarioIndex,
            central: {
              temperatureC: hourly.temperatureC[index],
              windSpeedKmh: hourly.windSpeedKmh[index],
              windGustsKmh: hourly.windGustsKmh[index],
              stars: rating.stars,
            },
            weatherCode: hourly.weatherCode[index],
            moonDistance,
            hoursFromTideExtreme,
            tideCoefficient: coefficient.coefficient,
            light,
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
      scenarios,
    };
  }

  /**
   * Filas de la previsión desde la hora actual: una por hora (`stepHours` = 1) durante
   * `hours` horas. Si se pasan escenarios, cada fila lleva su margen.
   *
   * @param {object} input
   * @param {number|null} [input.lat] Latitud del lugar, para la hora del día (luz del sol).
   * @param {number|null} [input.lon] Longitud del lugar.
   * @param {object} input.forecast Pronóstico normalizado (weather.getForecast), con `hourly`.
   * @param {object|null} input.ensemble Escenarios normalizados (weather.getEnsemble), opcional.
   * @param {object|null} input.waterSeries Temperatura del agua (weather.getWaterSeries), opcional.
   * @param {object|null} input.tideState Vista de mareas (tides.getLiveTides), opcional.
   * @param {number} input.nowMs Instante actual en milisegundos.
   */
  function buildForecastRows({
    lat = null,
    lon = null,
    forecast,
    ensemble = null,
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
    const ensembleIndex = ensemble ? new Map(ensemble.times.map((text, position) => [text, position])) : null;

    const rows = [];
    for (let step = 0; step * stepHours < hours; step += 1) {
      const index = startIndex + step * stepHours;
      if (index >= hourly.times.length) break;
      rows.push(
        buildRow({
          lat,
          lon,
          forecast,
          index,
          ensemble,
          ensembleIndex,
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
   * Hasta `count` horas con mejor valoración central, separadas al menos `gapHours` entre
   * sí y con al menos BEST_MOMENTS_MIN_STARS estrellas. Se devuelven ordenadas por hora.
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
    RAIN_CHANCE_MM,
    SCENARIO_LOW,
    SCENARIO_HIGH,
    BEST_MOMENTS_COUNT,
    BEST_MOMENTS_GAP_HOURS,
    BEST_MOMENTS_MIN_STARS,
    COEFFICIENT_SOURCE_HARMONIC,
    COEFFICIENT_SOURCE_MOON,
    tideAtTime,
    marginOf,
    summarizeScenarios,
    buildForecastRows,
    pickBestMoments,
  });
})(typeof window !== 'undefined' ? window : globalThis);
