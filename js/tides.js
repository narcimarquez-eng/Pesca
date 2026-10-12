/**
 * Mareas.
 *
 * - Alturas y extremos (pleamares y bajamares) con WorldTides (API v3). Requiere
 *   una clave gratuita: regístrate en worldtides.info y pégala en Ajustes.
 * - Coeficiente de marea aproximado calculado con la fase lunar. No es el
 *   coeficiente oficial de las tablas de mareas; sirve como orientación.
 *
 * Nota: Open-Meteo no ofrece alturas de marea astronómica, por eso las mareas
 * salen de WorldTides.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const HOUR_MS = 60 * 60 * 1000;

  /** Retraso medio de la marea respecto a la fase lunar (días). Se usa en el coeficiente aproximado. */
  const COEFFICIENT_LAG_DAYS = 1.5;

  /** Ventana que pedimos para la vista en vivo: 3 h de pasado y 33 h de futuro. */
  const LIVE_PAST_MS = 3 * HOUR_MS;
  const LIVE_FUTURE_MS = 33 * HOUR_MS;

  /** Ventana mínima que debe cubrir la caché para considerarla válida (3 h atrás, 12 h adelante). */
  const LIVE_REQUIRED_PAST_MS = 3 * HOUR_MS;
  const LIVE_REQUIRED_FUTURE_MS = 12 * HOUR_MS;

  const API_KEY_STORAGE_KEY = 'worldTidesKey';

  /** Clave guardada por el usuario en la app, o la de la configuración si no hay ninguna. */
  function getApiKey() {
    const stored = PescaApp.utils.storage.read(API_KEY_STORAGE_KEY, '');
    const fromStorage = typeof stored === 'string' ? stored.trim() : '';
    return fromStorage || (PescaApp.config.worldTidesApiKey || '').trim();
  }

  function saveApiKey(key) {
    const cleaned = String(key || '').trim();
    if (!cleaned) {
      PescaApp.utils.storage.remove(API_KEY_STORAGE_KEY);
      return true;
    }
    return PescaApp.utils.storage.write(API_KEY_STORAGE_KEY, cleaned);
  }

  /**
   * Coeficiente de marea aproximado (escala 20–120, media cercana a 70).
   *
   * Modelo: las mareas vivas (coeficiente alto) ocurren en luna nueva y llena,
   * con un retraso de ~1,5 días; las muertas, en cuadraturas. Se usa un
   * factor sinusoidal de la fase, sin tener en cuenta la declinación ni el perigeo.
   */
  function estimateCoefficient(date = new Date()) {
    const phase = PescaApp.moon.getMoonPhase(date);
    const lagFraction = COEFFICIENT_LAG_DAYS / PescaApp.moon.SYNODIC_MONTH_DAYS;
    const effectiveFraction = phase.fraction - lagFraction;
    const springFactor = (1 + Math.cos(4 * Math.PI * effectiveFraction)) / 2;
    return Math.round(20 + 100 * springFactor);
  }

  /** Etiqueta en castellano para el coeficiente aproximado. */
  function describeCoefficient(coefficient) {
    if (!Number.isFinite(coefficient)) return 'Sin dato';
    if (coefficient >= 95) return 'Mareas vivas';
    if (coefficient <= 45) return 'Mareas muertas';
    return 'Mareas intermedias';
  }

  /** Construye la URL de WorldTides. Los flags heights y extremes van sin valor, como en su documentación. */
  function buildTidesUrl({ lat, lon, startSeconds, lengthSeconds, apiKey }) {
    const query = new URLSearchParams({
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
      start: String(startSeconds),
      length: String(lengthSeconds),
      key: apiKey,
    });
    return `${PescaApp.config.endpoints.worldTides}?heights&extremes&${query.toString()}`;
  }

  /**
   * Normaliza la respuesta de WorldTides. Las marcas de tiempo quedan en
   * milisegundos y los extremos se marcan como 'high' o 'low'.
   */
  function normalizeTides(json) {
    const utils = PescaApp.utils;
    if (!json || typeof json !== 'object') {
      throw new Error('La respuesta de WorldTides no tiene el formato esperado.');
    }
    if (json.error) {
      throw new Error(`WorldTides devolvió un error: ${json.error}`);
    }

    const heights = (Array.isArray(json.heights) ? json.heights : [])
      .map((point) => ({ ts: Number(point.dt) * 1000, height: utils.toFiniteNumber(point.height) }))
      .filter((point) => Number.isFinite(point.ts) && point.height !== null)
      .sort((a, b) => a.ts - b.ts);

    const extremes = (Array.isArray(json.extremes) ? json.extremes : [])
      .map((point) => ({
        ts: Number(point.dt) * 1000,
        height: utils.toFiniteNumber(point.height),
        type: String(point.type || '').toLowerCase().startsWith('h') ? 'high' : 'low',
      }))
      .filter((point) => Number.isFinite(point.ts) && point.height !== null)
      .sort((a, b) => a.ts - b.ts);

    return {
      heights,
      extremes,
      station: json.station || null,
      distanceToStationM: utils.toFiniteNumber(json.distance),
    };
  }

  /** Altura interpolada linealmente en un instante. Devuelve null fuera de la ventana. */
  function heightAt(heights, ts) {
    if (!heights.length || ts < heights[0].ts || ts > heights[heights.length - 1].ts) {
      return null;
    }
    for (let index = 1; index < heights.length; index += 1) {
      const next = heights[index];
      if (ts <= next.ts) {
        const previous = heights[index - 1];
        const span = next.ts - previous.ts || 1;
        return previous.height + ((next.height - previous.height) * (ts - previous.ts)) / span;
      }
    }
    return heights[heights.length - 1].height;
  }

  /**
   * Resumen para la tarjeta de mareas en un instante: altura actual, próximas
   * pleamar y bajamar, último extremo y horas desde el extremo más cercano.
   */
  function summarize(tides, nowMs) {
    if (!tides) return null;
    const upcoming = tides.extremes.filter((extreme) => extreme.ts >= nowMs);
    const past = tides.extremes.filter((extreme) => extreme.ts < nowMs);
    const nearestMs = tides.extremes.reduce(
      (best, extreme) => Math.min(best, Math.abs(extreme.ts - nowMs)),
      Infinity
    );

    return {
      currentHeightM: heightAt(tides.heights, nowMs),
      nextHigh: upcoming.find((extreme) => extreme.type === 'high') || null,
      nextLow: upcoming.find((extreme) => extreme.type === 'low') || null,
      nextExtreme: upcoming[0] || null,
      lastExtreme: past.length ? past[past.length - 1] : null,
      hoursFromExtreme: Number.isFinite(nearestMs) ? nearestMs / HOUR_MS : null,
    };
  }

  /**
   * Geometría de la gráfica de alturas (SVG) para la ventana [startMs, endMs].
   * Devuelve puntos en coordenadas del SVG, extremos y la posición del instante actual.
   */
  function buildChartGeometry(tides, { startMs, endMs, nowMs, width = 640, height = 240, padding = 32 }) {
    const visible = tides.heights.filter((point) => point.ts >= startMs && point.ts <= endMs);
    if (visible.length < 2 || endMs <= startMs) return null;

    const values = visible.map((point) => point.height);
    const yMin = Math.min(...values) - 0.1;
    const yMax = Math.max(...values) + 0.1;
    const spanY = yMax - yMin || 1;

    const xOf = (ts) => padding + ((ts - startMs) / (endMs - startMs)) * (width - 2 * padding);
    const yOf = (value) => height - padding - ((value - yMin) / spanY) * (height - 2 * padding);

    return {
      width,
      height,
      padding,
      yMin,
      yMax,
      points: visible.map((point) => ({ x: xOf(point.ts), y: yOf(point.height) })),
      extremes: tides.extremes
        .filter((extreme) => extreme.ts >= startMs && extreme.ts <= endMs)
        .map((extreme) => ({
          x: xOf(extreme.ts),
          y: yOf(extreme.height),
          type: extreme.type,
          ts: extreme.ts,
          height: extreme.height,
        })),
      nowX: nowMs >= startMs && nowMs <= endMs ? xOf(nowMs) : null,
    };
  }

  /**
   * Pide alturas y extremos con caché. Si la caché no cubre la ventana pedida,
   * vuelve a consultar WorldTides.
   */
  async function getTideWindow({ lat, lon, apiKey, startMs, endMs, cacheKey, maxAgeMs, requiredStartMs, requiredEndMs }) {
    const utils = PescaApp.utils;
    const cached = utils.cache.get(cacheKey, maxAgeMs);
    if (cached && cached.coversStartMs <= requiredStartMs && cached.coversEndMs >= requiredEndMs) {
      return cached;
    }

    const lengthSeconds = Math.ceil((endMs - startMs) / 1000);
    const url = buildTidesUrl({
      lat,
      lon,
      startSeconds: Math.floor(startMs / 1000),
      lengthSeconds,
      apiKey,
    });

    let json;
    try {
      json = await utils.fetchJson(url);
    } catch (error) {
      throw translateTidesError(error);
    }

    const tides = {
      ...normalizeTides(json),
      coversStartMs: startMs,
      coversEndMs: startMs + lengthSeconds * 1000,
    };
    utils.cache.set(cacheKey, tides);
    return tides;
  }

  /** Convierte errores HTTP de WorldTides en mensajes comprensibles. */
  function translateTidesError(error) {
    if (error && (error.status === 401 || error.status === 403)) {
      return new Error('La clave de WorldTides no es válida o se han agotado sus créditos.');
    }
    if (error && error.status === 429) {
      return new Error('Hay demasiadas peticiones a WorldTides. Prueba más tarde.');
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  /** Alturas y extremos en vivo: ventana de 3 h atrás y 33 h adelante, con caché de 12 h. */
  async function getLiveTides(lat, lon, apiKey, now = new Date()) {
    const nowMs = now.getTime();
    return getTideWindow({
      lat,
      lon,
      apiKey,
      startMs: nowMs - LIVE_PAST_MS,
      endMs: nowMs + LIVE_FUTURE_MS,
      cacheKey: `tides:${lat.toFixed(2)},${lon.toFixed(2)}`,
      maxAgeMs: PescaApp.config.cacheMs.tides,
      requiredStartMs: nowMs - LIVE_REQUIRED_PAST_MS,
      requiredEndMs: nowMs + LIVE_REQUIRED_FUTURE_MS,
    });
  }

  /**
   * Alturas y extremos alrededor de una captura pasada (±3 h). Devuelve null
   * si WorldTides no tiene datos para esa fecha.
   */
  async function getHistoricalTides(lat, lon, apiKey, dateTime) {
    const centerMs = dateTime.getTime();
    const startMs = centerMs - 3 * HOUR_MS;
    const endMs = centerMs + 3 * HOUR_MS;
    try {
      return await getTideWindow({
        lat,
        lon,
        apiKey,
        startMs,
        endMs,
        cacheKey: `tides-history:${lat.toFixed(2)},${lon.toFixed(2)}:${Math.floor(centerMs / HOUR_MS)}`,
        maxAgeMs: PescaApp.config.cacheMs.history,
        requiredStartMs: startMs,
        requiredEndMs: endMs,
      });
    } catch (error) {
      return null;
    }
  }

  /** Foto de las mareas en un instante, para guardar con una captura. */
  function buildTideSnapshot(tides, nowMs, coefficient) {
    const summary = summarize(tides, nowMs);
    if (!summary) return null;
    return {
      heightM: summary.currentHeightM === null ? null : PescaApp.utils.round(summary.currentHeightM, 2),
      hoursFromExtreme: summary.hoursFromExtreme === null ? null : PescaApp.utils.round(summary.hoursFromExtreme, 1),
      nextHigh: summary.nextHigh ? { ts: summary.nextHigh.ts, height: summary.nextHigh.height } : null,
      nextLow: summary.nextLow ? { ts: summary.nextLow.ts, height: summary.nextLow.height } : null,
      coefficient,
    };
  }

  PescaApp.tides = Object.freeze({
    COEFFICIENT_LAG_DAYS,
    getApiKey,
    saveApiKey,
    estimateCoefficient,
    describeCoefficient,
    buildTidesUrl,
    normalizeTides,
    heightAt,
    summarize,
    buildChartGeometry,
    getLiveTides,
    getHistoricalTides,
    buildTideSnapshot,
    translateTidesError,
  });
})(typeof window !== 'undefined' ? window : globalThis);
