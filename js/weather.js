/**
 * Condiciones meteorológicas con Open-Meteo (gratuito, sin clave):
 * - Pronóstico y estado actual (api.open-meteo.com).
 * - Temperatura del agua (modelo marino, marine-api.open-meteo.com).
 * - Datos históricos para registrar capturas pasadas (archive-api.open-meteo.com
 *   o el modelo reciente con past_days).
 *
 * Las horas que devuelve Open-Meteo con timezone=auto son locales del lugar,
 * en formato "YYYY-MM-DDTHH:MM". Por eso se comparan como texto.
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

  const HOURLY_VARIABLES = [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'pressure_msl',
    'wind_speed_10m',
    'wind_direction_10m',
  ];

  const HISTORY_VARIABLES = HOURLY_VARIABLES;

  /** Por debajo de esta antigüedad (días) se usa el modelo reciente; por encima, el archivo histórico. */
  const ARCHIVE_MIN_AGE_DAYS = 8;

  /** Máximo de días pasados que admite el endpoint de pronóstico. */
  const MAX_PAST_DAYS = 92;

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

  /** Código WMO → descripción en castellano e icono. */
  function describeWeatherCode(code) {
    const found = WEATHER_CODES.find(([codes]) => codes.includes(code));
    return found ? { label: found[1], icon: found[2] } : { label: 'Sin datos', icon: '❔' };
  }

  /** Construye la URL del pronóstico con condiciones actuales, horarias y amanecer/atardecer. */
  function buildForecastUrl(lat, lon) {
    return PescaApp.utils.buildUrl(PescaApp.config.endpoints.forecast, {
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: CURRENT_VARIABLES,
      hourly: HOURLY_VARIABLES,
      daily: ['sunrise', 'sunset'],
      timezone: 'auto',
      past_days: 1,
      forecast_days: 2,
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
   * Normaliza la respuesta del pronóstico a un objeto con nombres propios.
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

    return {
      timezone: json.timezone || null,
      timezoneAbbreviation: json.timezone_abbreviation || null,
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
    };
  }

  /** Extrae la temperatura del agua para la hora indicada. Devuelve null si no hay dato. */
  function extractWaterTemperature(json, observedAt) {
    const hourly = json && json.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.sea_surface_temperature)) {
      return null;
    }
    const index = findHourIndex(hourly.time, observedAt);
    if (index < 0) return null;
    return PescaApp.utils.toFiniteNumber(hourly.sea_surface_temperature[index]);
  }

  /** Previsión y estado actual para una ubicación. Usa caché de 15 minutos. */
  async function getForecast(lat, lon) {
    const utils = PescaApp.utils;
    const cacheKey = `forecast:${roundCoordinate(lat)},${roundCoordinate(lon)}`;
    const cached = utils.cache.get(cacheKey, PescaApp.config.cacheMs.forecast);
    if (cached) return cached;

    const json = await utils.fetchJson(buildForecastUrl(lat, lon));
    const forecast = normalizeForecast(json);
    utils.cache.set(cacheKey, forecast);
    return forecast;
  }

  /**
   * Temperatura del agua en el momento indicado. Es un dato opcional: si falla
   * o el modelo no tiene datos para esa zona, devuelve null sin lanzar error.
   */
  async function getWaterTemperature(lat, lon, observedAt) {
    const utils = PescaApp.utils;
    const cacheKey = `marine:${roundCoordinate(lat)},${roundCoordinate(lon)}`;
    try {
      let json = utils.cache.get(cacheKey, PescaApp.config.cacheMs.marine);
      if (!json) {
        json = await utils.fetchJson(buildMarineUrl(lat, lon));
        utils.cache.set(cacheKey, json);
      }
      return extractWaterTemperature(json, observedAt);
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
    HOURLY_VARIABLES,
    ARCHIVE_MIN_AGE_DAYS,
    toHourKey,
    findHourIndex,
    computePressureTrend,
    describeWeatherCode,
    buildForecastUrl,
    buildMarineUrl,
    buildHistoryRequest,
    normalizeForecast,
    extractWaterTemperature,
    normalizeHistorySnapshot,
    getForecast,
    getWaterTemperature,
    getHistoricalConditions,
  });
})(typeof window !== 'undefined' ? window : globalThis);
