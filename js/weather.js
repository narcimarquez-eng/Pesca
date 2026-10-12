/**
 * Condiciones meteorológicas con Open-Meteo (gratuito, sin clave):
 * - Pronóstico: estado actual y serie horaria de 4 días (api.open-meteo.com).
 * - Temperatura de la superficie del agua (modelo marino, marine-api.open-meteo.com).
 * - Datos históricos para registrar capturas pasadas (archive-api.open-meteo.com
 *   o el modelo reciente con past_days).
 *
 * Las horas que devuelve Open-Meteo con timezone=auto son locales del lugar, en
 * formato "YYYY-MM-DDTHH:MM". Se comparan como texto y, para obtener un instante
 * absoluto, se resta el desfase UTC (utc_offset_seconds) de la respuesta.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const CURRENT_VARIABLES = [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'is_day',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'pressure_msl',
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
  ];

  /** Variables horarias del pronóstico (incluye rachas y día/noche para la previsión por horas). */
  const FORECAST_HOURLY_VARIABLES = [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'pressure_msl',
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
    'is_day',
  ];

  /** Variables del histórico. Se mantienen mínimas para que el archivo las admita todas. */
  const HISTORY_VARIABLES = [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'pressure_msl',
    'wind_speed_10m',
    'wind_direction_10m',
  ];

  /**
   * Días de pronóstico horario que se piden, incluido hoy. Con 4 días, desde cualquier
   * hora del día hay al menos 72 horas de datos, que es lo que muestra la previsión.
   */
  const FORECAST_DAYS = 4;

  /** Por debajo de esta antigüedad (días) se usa el modelo reciente; por encima, el archivo histórico. */
  const ARCHIVE_MIN_AGE_DAYS = 8;

  /** Máximo de días pasados que admite el endpoint de pronóstico. */
  const MAX_PAST_DAYS = 92;

  /** Versión de la caché del pronóstico: cambiarla invalida las entradas antiguas. */
  const FORECAST_CACHE_VERSION = 'v2';

  /** Códigos WMO de tiempo: [códigos, descripción, icono]. */
  const WEATHER_CODES = [
    [[0], 'Despejado', '☀️'],
    [[1], 'Mayormente despejado', '🌤️'],
    [[2], 'Parcialmente nublado', '⛅'],
    [[3], 'Cubierto', '☁️'],
    [[45, 48], 'Niebla', '🌫️'],
    [[51, 53, 55, 56, 57], 'Llovizna', '🌦️'],
    [[61, 63, 65, 66, 67], 'Lluvia', '🌧️'],
    [[71, 73, 75, 77], 'Nieve', '❄️'],
    [[80, 81, 82], 'Chubascos', '🌦️'],
    [[85, 86], 'Chubascos de nieve', '🌨️'],
    [[95], 'Tormenta', '⛈️'],
    [[96, 99], 'Tormenta con granizo', '⛈️'],
  ];

  /** Hora local de Open-Meteo: "YYYY-MM-DDTHH:MM" (los segundos y el desfase no se usan aquí). */
  const LOCAL_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

  /** Redondea la coordenada para la caché (unos 100 m de precisión). */
  function roundCoordinate(value) {
    return value.toFixed(3);
  }

  /** "YYYY-MM-DDTHH:MM" → "YYYY-MM-DDTHH:00" (clave horaria). */
  function toHourKey(dateTimeText) {
    return `${String(dateTimeText).slice(0, 13)}:00`;
  }

  function findHourIndex(times, dateTimeText) {
    return times.indexOf(toHourKey(dateTimeText));
  }

  /**
   * Instante absoluto (ms) de una hora local del lugar "YYYY-MM-DDTHH:MM".
   * Resta el desfase UTC del lugar. Devuelve null si el texto no es válido.
   */
  function localTimeToMs(localText, utcOffsetSeconds) {
    // Date.parse acepta textos sueltos (y da fechas absurdas), así que se valida el formato antes.
    const text = String(localText);
    if (!LOCAL_TIME_PATTERN.test(text)) return null;
    const wallClockMs = Date.parse(`${text.slice(0, 16)}:00Z`);
    if (!Number.isFinite(wallClockMs)) return null;
    const offsetSeconds = PescaApp.utils.toFiniteNumber(utcOffsetSeconds) || 0;
    return wallClockMs - offsetSeconds * 1000;
  }

  /**
   * Variación de presión en las últimas `hoursBack` horas (hPa).
   * Devuelve null si no hay datos suficientes.
   */
  function computePressureTrend(pressures, index, currentPressure, hoursBack = 3) {
    if (!Array.isArray(pressures) || index < hoursBack || !Number.isFinite(currentPressure)) {
      return null;
    }
    const previous = PescaApp.utils.toFiniteNumber(pressures[index - hoursBack]);
    return previous === null ? null : PescaApp.utils.round(currentPressure - previous, 1);
  }

  /** Serie numérica de una variable horaria, con null donde falte el dato. */
  function numericSeries(hourly, name, length) {
    const values = Array.isArray(hourly[name]) ? hourly[name] : [];
    return Array.from({ length }, (_, index) => PescaApp.utils.toFiniteNumber(values[index]));
  }

  /** Tendencia de presión de 3 horas para cada posición de la serie. */
  function pressureTrendSeries(pressures, hoursBack = 3) {
    return pressures.map((value, index) => {
      if (index < hoursBack || value === null || pressures[index - hoursBack] === null) return null;
      return PescaApp.utils.round(value - pressures[index - hoursBack], 1);
    });
  }

  /** Código WMO → descripción en castellano e icono. */
  function describeWeatherCode(code) {
    const found = WEATHER_CODES.find(([codes]) => codes.includes(code));
    return found ? { label: found[1], icon: found[2] } : { label: 'Sin datos', icon: '❔' };
  }

  /** Construye la URL del pronóstico con condiciones actuales, serie horaria y un día pasado. */
  function buildForecastUrl(lat, lon) {
    return PescaApp.utils.buildUrl(PescaApp.config.endpoints.forecast, {
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: CURRENT_VARIABLES,
      hourly: FORECAST_HOURLY_VARIABLES,
      daily: ['sunrise', 'sunset'],
      timezone: 'auto',
      past_days: 1,
      forecast_days: FORECAST_DAYS,
    });
  }

  /** Construye la URL del modelo marino para la temperatura de la superficie del agua. */
  function buildMarineUrl(lat, lon) {
    return PescaApp.utils.buildUrl(PescaApp.config.endpoints.marine, {
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: ['sea_surface_temperature'],
      timezone: 'auto',
    });
  }

  /**
   * Normaliza la respuesta del pronóstico. Devuelve el estado actual, los datos
   * diarios y la serie horaria (`hourly`) con la tendencia de presión de cada hora.
   * Lanza un error si la respuesta no tiene la estructura esperada.
   */
  function normalizeForecast(json) {
    const utils = PescaApp.utils;
    if (!json || !json.current || !json.hourly || !Array.isArray(json.hourly.time)) {
      throw new Error('La respuesta de Open-Meteo no tiene el formato esperado.');
    }

    const current = json.current;
    const hourly = json.hourly;
    const hourIndex = findHourIndex(hourly.time, current.time);
    const currentPressure = utils.toFiniteNumber(current.pressure_msl);

    // Amanecer y atardecer del día actual en la zona horaria del lugar.
    const todayText = String(current.time).slice(0, 10);
    const daily = json.daily || {};
    const dailyIndex = Array.isArray(daily.time) ? daily.time.indexOf(todayText) : -1;

    const length = hourly.time.length;
    const pressureSeries = numericSeries(hourly, 'pressure_msl', length);
    const series = {
      times: hourly.time.slice(),
      temperatureC: numericSeries(hourly, 'temperature_2m', length),
      humidityPercent: numericSeries(hourly, 'relative_humidity_2m', length),
      precipitationMm: numericSeries(hourly, 'precipitation', length),
      weatherCode: numericSeries(hourly, 'weather_code', length),
      cloudCoverPercent: numericSeries(hourly, 'cloud_cover', length),
      pressureHpa: pressureSeries,
      pressureTrend3hHpa: pressureTrendSeries(pressureSeries),
      windSpeedKmh: numericSeries(hourly, 'wind_speed_10m', length),
      windDirectionDeg: numericSeries(hourly, 'wind_direction_10m', length),
      windGustsKmh: numericSeries(hourly, 'wind_gusts_10m', length),
      isDay: numericSeries(hourly, 'is_day', length),
    };

    return {
      timezone: json.timezone || null,
      timezoneAbbreviation: json.timezone_abbreviation || null,
      utcOffsetSeconds: utils.toFiniteNumber(json.utc_offset_seconds),
      elevationM: utils.toFiniteNumber(json.elevation),
      observedAt: current.time,
      airTemperatureC: utils.toFiniteNumber(current.temperature_2m),
      apparentTemperatureC: utils.toFiniteNumber(current.apparent_temperature),
      humidityPercent: utils.toFiniteNumber(current.relative_humidity_2m),
      cloudCoverPercent: utils.toFiniteNumber(current.cloud_cover),
      precipitationMm: utils.toFiniteNumber(current.precipitation),
      weatherCode: utils.toFiniteNumber(current.weather_code),
      isDay: current.is_day === 1,
      pressureHpa: currentPressure,
      pressureTrend3hHpa: computePressureTrend(hourly.pressure_msl, hourIndex, currentPressure, 3),
      windSpeedKmh: utils.toFiniteNumber(current.wind_speed_10m),
      windDirectionDeg: utils.toFiniteNumber(current.wind_direction_10m),
      windGustsKmh: utils.toFiniteNumber(current.wind_gusts_10m),
      sunrise: dailyIndex >= 0 && daily.sunrise ? daily.sunrise[dailyIndex] || null : null,
      sunset: dailyIndex >= 0 && daily.sunset ? daily.sunset[dailyIndex] || null : null,
      waterTemperatureC: null,
      hourly: series,
    };
  }

  /** Serie de temperatura del agua del modelo marino: { times, values } o null. */
  function extractWaterSeries(json) {
    const hourly = json && json.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.sea_surface_temperature)) {
      return null;
    }
    return {
      times: hourly.time.slice(),
      values: hourly.sea_surface_temperature.map((value) => PescaApp.utils.toFiniteNumber(value)),
    };
  }

  /** Temperatura del agua de la hora indicada dentro de una serie. Devuelve null si no hay dato. */
  function waterValueAt(series, observedAt) {
    if (!series) return null;
    const index = series.times.indexOf(toHourKey(observedAt));
    return index < 0 ? null : series.values[index];
  }

  /** Temperatura del agua en una respuesta del modelo marino. Devuelve null si no hay dato. */
  function extractWaterTemperature(json, observedAt) {
    return waterValueAt(extractWaterSeries(json), observedAt);
  }

  /** Previsión y estado actual para una ubicación. Usa caché de 15 minutos. */
  async function getForecast(lat, lon) {
    const utils = PescaApp.utils;
    const cacheKey = `forecast:${FORECAST_CACHE_VERSION}:${roundCoordinate(lat)},${roundCoordinate(lon)}`;
    const cached = utils.cache.get(cacheKey, PescaApp.config.cacheMs.forecast);
    if (cached) return cached;

    const json = await utils.fetchJson(buildForecastUrl(lat, lon));
    const forecast = normalizeForecast(json);
    utils.cache.set(cacheKey, forecast);
    return forecast;
  }

  /**
   * Serie horaria de la temperatura del agua. Es un dato opcional: si falla o el
   * modelo no tiene datos para la zona, devuelve null sin lanzar error.
   */
  async function getWaterSeries(lat, lon) {
    const utils = PescaApp.utils;
    const cacheKey = `marine:${roundCoordinate(lat)},${roundCoordinate(lon)}`;
    try {
      let json = utils.cache.get(cacheKey, PescaApp.config.cacheMs.marine);
      if (!json) {
        json = await utils.fetchJson(buildMarineUrl(lat, lon));
        utils.cache.set(cacheKey, json);
      }
      return extractWaterSeries(json);
    } catch (error) {
      return null;
    }
  }

  /**
   * Elige el origen de datos para una fecha pasada. Hasta 8 días atrás usa el
   * modelo reciente (endpoint de pronóstico con past_days). Más antiguo, usa el archivo.
   */
  function buildHistoryRequest(lat, lon, dayText, todayText) {
    const utils = PescaApp.utils;
    const ageDays = utils.daysBetweenDateStrings(dayText, todayText);
    const common = {
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: HISTORY_VARIABLES,
      timezone: 'auto',
    };

    if (ageDays <= ARCHIVE_MIN_AGE_DAYS) {
      const pastDays = Math.min(MAX_PAST_DAYS, Math.max(1, ageDays + 2));
      return {
        url: utils.buildUrl(PescaApp.config.endpoints.forecast, {
          ...common,
          past_days: pastDays,
          forecast_days: 1,
        }),
        source: 'Open-Meteo (datos recientes)',
      };
    }

    return {
      url: utils.buildUrl(PescaApp.config.endpoints.archive, {
        ...common,
        start_date: utils.shiftDateString(dayText, -1),
        end_date: dayText,
      }),
      source: 'Open-Meteo Historical (archivo)',
    };
  }

  /** Extrae las condiciones de una hora concreta de una respuesta histórica. */
  function normalizeHistorySnapshot(json, hourKey, source) {
    const utils = PescaApp.utils;
    const hourly = json && json.hourly;
    if (!hourly || !Array.isArray(hourly.time)) {
      throw new Error('El servicio no devolvió datos históricos para esta ubicación.');
    }
    const index = hourly.time.indexOf(hourKey);
    if (index < 0) {
      throw new Error('El servicio no tiene datos para la hora de la captura.');
    }
    const valueAt = (name) => utils.toFiniteNumber(hourly[name] ? hourly[name][index] : null);
    const pressureHpa = valueAt('pressure_msl');

    return {
      observedAt: hourKey,
      source,
      airTemperatureC: valueAt('temperature_2m'),
      humidityPercent: valueAt('relative_humidity_2m'),
      precipitationMm: valueAt('precipitation'),
      weatherCode: valueAt('weather_code'),
      cloudCoverPercent: valueAt('cloud_cover'),
      pressureHpa,
      pressureTrend3hHpa: computePressureTrend(hourly.pressure_msl, index, pressureHpa, 3),
      windSpeedKmh: valueAt('wind_speed_10m'),
      windDirectionDeg: valueAt('wind_direction_10m'),
      waterTemperatureC: null,
    };
  }

  /**
   * Condiciones de una captura pasada. `dateTimeText` es "YYYY-MM-DDTHH:MM"
   * en la hora local del lugar. Usa caché de 30 días por lugar y día.
   */
  async function getHistoricalConditions(lat, lon, dateTimeText, now = new Date()) {
    const utils = PescaApp.utils;
    const dayText = String(dateTimeText).slice(0, 10);
    const hourKey = toHourKey(dateTimeText);
    const request = buildHistoryRequest(lat, lon, dayText, utils.toDateString(now));
    const cacheKey = `history:${roundCoordinate(lat)},${roundCoordinate(lon)}:${dayText}`;

    let json = utils.cache.get(cacheKey, PescaApp.config.cacheMs.history);
    if (!json) {
      json = await utils.fetchJson(request.url);
      utils.cache.set(cacheKey, json);
    }
    return normalizeHistorySnapshot(json, hourKey, request.source);
  }

  PescaApp.weather = Object.freeze({
    CURRENT_VARIABLES,
    FORECAST_HOURLY_VARIABLES,
    FORECAST_DAYS,
    HISTORY_VARIABLES,
    ARCHIVE_MIN_AGE_DAYS,
    toHourKey,
    findHourIndex,
    localTimeToMs,
    computePressureTrend,
    describeWeatherCode,
    buildForecastUrl,
    buildMarineUrl,
    buildHistoryRequest,
    normalizeForecast,
    extractWaterSeries,
    waterValueAt,
    extractWaterTemperature,
    normalizeHistorySnapshot,
    getForecast,
    getWaterSeries,
    getHistoricalConditions,
  });
})(typeof window !== 'undefined' ? window : globalThis);
