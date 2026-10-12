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

  const HOUR_MS = PescaApp.utils.HOUR_MS;

  /**
   * Escenarios: modelo de conjunto ECMWF IFS, con 51 miembros. Cada miembro es una
   * evolución posible del tiempo; el margen de la previsión sale de ellos.
   */
  const ENSEMBLE_MODEL = 'ecmwf_ifs025';

  /** Variables de cada escenario y el campo con el que se trabaja en el código. */
  const ENSEMBLE_FIELDS = Object.freeze([
    ['temperature_2m', 'temperatureC'],
    ['precipitation', 'precipitationMm'],
    ['wind_speed_10m', 'windSpeedKmh'],
    ['wind_gusts_10m', 'windGustsKmh'],
    ['pressure_msl', 'pressureHpa'],
  ]);

  const ENSEMBLE_VARIABLES = ENSEMBLE_FIELDS.map(([name]) => name);

  /**
   * Escenarios en memoria, por ubicación. No se guardan en localStorage: cada respuesta
   * pesa cientos de kilobytes y el espacio del navegador es limitado.
   */
  const ensembleMemory = new Map();

  /** Códigos WMO de tiempo: [códigos, descripción, icono]. */
  const WEATHER_CODES = [
    [[0], PescaApp.i18n.mark('Despejado'), '☀️'],
    [[1], PescaApp.i18n.mark('Mayormente despejado'), '🌤️'],
    [[2], PescaApp.i18n.mark('Parcialmente nublado'), '⛅'],
    [[3], PescaApp.i18n.mark('Cubierto'), '☁️'],
    [[45, 48], PescaApp.i18n.mark('Niebla'), '🌫️'],
    [[51, 53, 55, 56, 57], PescaApp.i18n.mark('Llovizna'), '🌦️'],
    [[61, 63, 65, 66, 67], PescaApp.i18n.mark('Lluvia'), '🌧️'],
    [[71, 73, 75, 77], PescaApp.i18n.mark('Nieve'), '❄️'],
    [[80, 81, 82], PescaApp.i18n.mark('Chubascos'), '🌦️'],
    [[85, 86], PescaApp.i18n.mark('Chubascos de nieve'), '🌨️'],
    [[95], PescaApp.i18n.mark('Tormenta'), '⛈️'],
    [[96, 99], PescaApp.i18n.mark('Tormenta con granizo'), '⛈️'],
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
    return found ? { label: PescaApp.i18n.t(found[1]), icon: found[2] } : { label: PescaApp.i18n.t('Sin datos'), icon: '❔' };
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
      throw new Error(PescaApp.i18n.t('La respuesta de Open-Meteo no tiene el formato esperado.'));
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

  /** URL de los escenarios: cada miembro del modelo de conjunto, por hora. */
  function buildEnsembleUrl(lat, lon) {
    return PescaApp.utils.buildUrl(PescaApp.config.endpoints.ensemble, {
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: ENSEMBLE_VARIABLES,
      models: ENSEMBLE_MODEL,
      timezone: 'auto',
      forecast_days: FORECAST_DAYS,
    });
  }

  /**
   * Valores de una serie llevada a una rejilla de una hora. Si el modelo entrega pasos de
   * 3 horas, las horas intermedias se interpolan. Donde no hay dato, null.
   */
  function resampleHourly(sourceMs, values, gridMs) {
    const utils = PescaApp.utils;
    const points = sourceMs
      .map((ms, index) => ({ ms, value: utils.toFiniteNumber(values[index]) }))
      .filter((point) => Number.isFinite(point.ms))
      .sort((a, b) => a.ms - b.ms);
    let cursor = 0;
    return gridMs.map((ms) => {
      while (cursor < points.length - 1 && points[cursor + 1].ms <= ms) cursor += 1;
      const before = points[cursor];
      if (!before || before.ms > ms) return null;
      if (before.ms === ms) return before.value;
      const after = points[cursor + 1];
      if (!after || before.value === null || after.value === null) return null;
      const fraction = (ms - before.ms) / (after.ms - before.ms);
      return before.value + (after.value - before.value) * fraction;
    });
  }

  /**
   * Convierte la respuesta del modelo de conjunto en escenarios. Cada clave es el control
   * ("temperature_2m") o un miembro ("temperature_2m_member01"), y se agrupan por su sufijo.
   * Devuelve las horas en una rejilla de una hora y `members`, con una serie por variable
   * en cada escenario. Lanza error si la respuesta no trae escenarios.
   */
  function normalizeEnsemble(json) {
    const hourly = json && json.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) {
      throw new Error(PescaApp.i18n.t('El modelo de escenarios no devolvió horas.'));
    }
    const sourceMs = hourly.time.map((text) => localTimeToMs(text, 0));
    const validMs = sourceMs.filter((ms) => ms !== null);
    if (!validMs.length) throw new Error(PescaApp.i18n.t('Las horas del modelo de escenarios no son válidas.'));

    const gridMs = [];
    for (let ms = Math.min(...validMs); ms <= Math.max(...validMs); ms += HOUR_MS) gridMs.push(ms);
    const times = gridMs.map((ms) => new Date(ms).toISOString().slice(0, 16));

    const scenarios = new Map();
    ENSEMBLE_FIELDS.forEach(([name, field]) => {
      Object.keys(hourly).forEach((key) => {
        if (key !== name && !key.startsWith(`${name}_`)) return;
        const id = key.slice(name.length);
        if (!scenarios.has(id)) scenarios.set(id, {});
        scenarios.get(id)[field] = resampleHourly(sourceMs, hourly[key], gridMs);
      });
    });

    const members = [...scenarios.values()]
      .filter((scenario) => ENSEMBLE_FIELDS.some(([, field]) => Array.isArray(scenario[field])))
      .map((scenario) => {
        const member = {};
        ENSEMBLE_FIELDS.forEach(([, field]) => {
          member[field] = scenario[field] || gridMs.map(() => null);
        });
        return member;
      });
    if (!members.length) throw new Error(PescaApp.i18n.t('El modelo de escenarios no devolvió escenarios.'));

    return {
      times,
      utcOffsetSeconds: PescaApp.utils.toFiniteNumber(json.utc_offset_seconds),
      timezone: json.timezone || null,
      members,
    };
  }

  /**
   * Escenarios de una ubicación. Se reutilizan en memoria durante 15 minutos. Si el
   * servicio falla, lanza el error y la previsión central sigue mostrándose.
   */
  async function getEnsemble(lat, lon) {
    const utils = PescaApp.utils;
    const key = `${roundCoordinate(lat)},${roundCoordinate(lon)}`;
    const cached = ensembleMemory.get(key);
    if (cached && Date.now() - cached.savedAt <= PescaApp.config.cacheMs.forecast) return cached.value;

    const json = await utils.fetchJson(buildEnsembleUrl(lat, lon));
    const value = normalizeEnsemble(json);
    ensembleMemory.set(key, { savedAt: Date.now(), value });
    return value;
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
        source: 'recent',
      };
    }

    return {
      url: utils.buildUrl(PescaApp.config.endpoints.archive, {
        ...common,
        start_date: utils.shiftDateString(dayText, -1),
        end_date: dayText,
      }),
      source: 'archive',
    };
  }

  /** Extrae las condiciones de una hora concreta de una respuesta histórica. */
  function normalizeHistorySnapshot(json, hourKey, source) {
    const utils = PescaApp.utils;
    const hourly = json && json.hourly;
    if (!hourly || !Array.isArray(hourly.time)) {
      throw new Error(PescaApp.i18n.t('El servicio no devolvió datos históricos para esta ubicación.'));
    }
    const index = hourly.time.indexOf(hourKey);
    if (index < 0) {
      throw new Error(PescaApp.i18n.t('El servicio no tiene datos para la hora de la captura.'));
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

  /** Origen de las condiciones de una captura, en el idioma activo. Acepta los códigos y los textos antiguos. */
  function describeConditionsSource(source) {
    const labels = {
      current: 'Condiciones actuales',
      recent: 'Open-Meteo (datos recientes)',
      archive: 'Open-Meteo Historical (archivo)',
      unavailable: 'No disponibles',
    };
    if (typeof source === 'string' && Object.prototype.hasOwnProperty.call(labels, source)) {
      return PescaApp.i18n.t(labels[source]);
    }
    return source || null;
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
    describeConditionsSource,
    buildForecastUrl,
    buildMarineUrl,
    ENSEMBLE_MODEL,
    ENSEMBLE_VARIABLES,
    buildEnsembleUrl,
    normalizeEnsemble,
    getEnsemble,
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
