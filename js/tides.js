/**
 * Mareas.
 *
 * Fuente por defecto: predicción armónica con las constantes de la estación de
 * marea más cercana (base de datos @neaps/tide-database, código MIT). No necesita
 * registro y cubre cualquier costa que tenga estación a menos de 60 km. Cada
 * estación indica su fuente y su licencia, y la app las muestra junto a la predicción.
 *
 * Fuente opcional: WorldTides, con clave gratuita (se elige en Ajustes).
 *
 * Limitaciones: la predicción armónica no incluye viento, presión ni oleaje, y puede
 * diferir en puertos, estuarios y calas. El coeficiente de marea es una estimación
 * por fase lunar, no el oficial.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const HOUR_MS = 60 * 60 * 1000;

  /** Retraso medio de la marea respecto a la fase lunar (días). Se usa en el coeficiente aproximado. */
  const COEFFICIENT_LAG_DAYS = 1.5;

  /** Ventana de la vista en vivo: 3 h de pasado y 33 h de futuro. */
  const LIVE_PAST_MS = 3 * HOUR_MS;
  const LIVE_FUTURE_MS = 33 * HOUR_MS;

  /** La caché de WorldTides debe cubrir al menos 3 h atrás y 12 h adelante. */
  const LIVE_REQUIRED_PAST_MS = 3 * HOUR_MS;
  const LIVE_REQUIRED_FUTURE_MS = 12 * HOUR_MS;

  /** Paso de las alturas predichas, en segundos (10 minutos). */
  const PREDICTION_STEP_SECONDS = 600;

  /** Una estación necesita al menos estos constituyentes para predecir algo razonable. */
  const MIN_CONSTITUENTS = 3;

  const API_KEY_STORAGE_KEY = 'worldTidesKey';
  const SOURCE_STORAGE_KEY = 'tideSource';
  const SOURCE_HARMONIC = 'harmonic';
  const SOURCE_WORLDTIDES = 'worldtides';

  const LICENSE_LABELS = Object.freeze({
    'cc-by-4.0': 'CC BY 4.0',
    'cc-by-nc-4.0': 'CC BY-NC 4.0',
    'public domain': 'Dominio público',
  });

  /** Peticiones de teselas en curso o ya cargadas, por clave. */
  const tileRequests = new Map();

  // ---------------------------------------------------------------------------
  // Ajustes
  // ---------------------------------------------------------------------------

  /** Fuente elegida: 'harmonic' (por defecto, sin registro) o 'worldtides'. */
  function getSource() {
    const stored = PescaApp.utils.storage.read(SOURCE_STORAGE_KEY, SOURCE_HARMONIC);
    return stored === SOURCE_WORLDTIDES ? SOURCE_WORLDTIDES : SOURCE_HARMONIC;
  }

  function saveSource(source) {
    return PescaApp.utils.storage.write(
      SOURCE_STORAGE_KEY,
      source === SOURCE_WORLDTIDES ? SOURCE_WORLDTIDES : SOURCE_HARMONIC
    );
  }

  /** Clave de WorldTides guardada en la app o, si no hay, la de la configuración. */
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

  // ---------------------------------------------------------------------------
  // Coeficiente de marea (estimación por fase lunar)
  // ---------------------------------------------------------------------------

  /**
   * Coeficiente de marea aproximado (escala 20–120, media cercana a 70).
   * Las mareas vivas ocurren en luna nueva y llena, con un retraso de ~1,5 días;
   * las muertas, en cuadraturas. No tiene en cuenta la declinación ni el perigeo.
   */
  function estimateCoefficient(date = new Date()) {
    const phase = PescaApp.moon.getMoonPhase(date);
    const lagFraction = COEFFICIENT_LAG_DAYS / PescaApp.moon.SYNODIC_MONTH_DAYS;
    const effectiveFraction = phase.fraction - lagFraction;
    const springFactor = (1 + Math.cos(4 * Math.PI * effectiveFraction)) / 2;
    return Math.round(20 + 100 * springFactor);
  }

  function describeCoefficient(coefficient) {
    if (!Number.isFinite(coefficient)) return 'Sin dato';
    if (coefficient >= 95) return 'Mareas vivas';
    if (coefficient <= 45) return 'Mareas muertas';
    return 'Mareas intermedias';
  }

  // ---------------------------------------------------------------------------
  // Teselas de datos armónicos (js/data/tides/*.js, generadas por tools/build-tide-data.mjs)
  // ---------------------------------------------------------------------------

  function tileSizeDeg() {
    return PescaApp.config.tides.tileSizeDeg;
  }

  function tileIndexOf(value) {
    return Math.floor(value / tileSizeDeg());
  }

  /** Lleva el índice de longitud al rango [-180°, 180°) para cruzar el antimeridiano. */
  function wrapLonIndex(index) {
    const count = 360 / tileSizeDeg();
    const half = count / 2;
    let wrapped = index;
    while (wrapped >= half) wrapped -= count;
    while (wrapped < -half) wrapped += count;
    return wrapped;
  }

  function manifestHas(key) {
    const manifest = PescaApp.tideManifest || [];
    return manifest.indexOf(key) !== -1;
  }

  /** Claves de las 9 teselas alrededor del punto que existen en el manifiesto. */
  function tileKeysAround(lat, lon) {
    const latIndex = tileIndexOf(lat);
    const lonIndex = tileIndexOf(lon);
    const keys = [];
    for (let deltaLat = -1; deltaLat <= 1; deltaLat += 1) {
      for (let deltaLon = -1; deltaLon <= 1; deltaLon += 1) {
        const key = `${latIndex + deltaLat}_${wrapLonIndex(lonIndex + deltaLon)}`;
        if (keys.indexOf(key) === -1 && manifestHas(key)) keys.push(key);
      }
    }
    return keys;
  }

  /** Carga una tesela con un <script>, así también funciona abriendo index.html directamente. */
  function loadTile(key) {
    if (PescaApp.tideTiles && PescaApp.tideTiles[key]) return Promise.resolve();
    const doc = root.document;
    if (!doc) {
      return Promise.reject(new Error('Los datos de marea solo se pueden cargar en el navegador.'));
    }
    if (!tileRequests.has(key)) {
      const request = new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = `${PescaApp.config.tides.tileFolder}${key}.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          tileRequests.delete(key);
          script.remove();
          reject(new Error(`No se pudieron cargar los datos de marea de la zona ${key}.`));
        };
        doc.head.appendChild(script);
      });
      tileRequests.set(key, request);
    }
    return tileRequests.get(key);
  }

  /** Estaciones de las teselas alrededor del punto. Carga las que falten. */
  async function loadStationsNear(lat, lon) {
    const keys = tileKeysAround(lat, lon);
    await Promise.all(keys.map(loadTile));
    return keys.reduce(
      (list, key) => list.concat((PescaApp.tideTiles && PescaApp.tideTiles[key]) || []),
      []
    );
  }

  /**
   * Estación más cercana con constantes armónicas, dentro del radio máximo.
   * Devuelve { station, distanceKm } o null si no hay ninguna.
   */
  function findNearestStation(lat, lon, candidates, maxDistanceKm = PescaApp.config.tides.stationMaxDistanceKm) {
    const utils = PescaApp.utils;
    let best = null;
    candidates.forEach((station) => {
      if (!Array.isArray(station.constituents) || station.constituents.length < MIN_CONSTITUENTS) return;
      const distanceKm = utils.distanceKm(lat, lon, station.lat, station.lon);
      if (distanceKm <= maxDistanceKm && (best === null || distanceKm < best.distanceKm)) {
        best = { station, distanceKm };
      }
    });
    return best ? { station: best.station, distanceKm: utils.round(best.distanceKm, 1) } : null;
  }

  function describeLicense(type) {
    return LICENSE_LABELS[type] || type || 'Licencia no indicada';
  }

  /** Datos de la estación para mostrarlos y citarlos. */
  function describeStation(station, distanceKm) {
    return {
      id: station.id,
      name: station.name,
      country: station.country,
      distanceKm,
      source: station.source,
      sourceUrl: station.sourceUrl,
      license: station.license,
      licenseLabel: describeLicense(station.license),
      referenceLabel: station.datum
        ? 'Alturas sobre LAT (bajamar astronómica)'
        : 'Alturas sobre el nivel medio del mar',
    };
  }

  /**
   * Predictor armónico de una estación. Si la estación tiene LAT y MSL, las alturas
   * se expresan sobre LAT sumando la diferencia entre ambos datums.
   */
  function createStationPredictor(station) {
    const constituents = station.constituents.map(([name, amplitude, phase]) => ({ name, amplitude, phase }));
    const offset = station.datum ? PescaApp.utils.round(station.datum.MSL - station.datum.LAT, 3) : false;
    return PescaApp.vendor.createTidePredictor(constituents, { offset });
  }

  /** Alturas (cada 10 minutos) y extremos previstos en el intervalo. */
  function predictWindow(predictor, startMs, endMs) {
    const start = new Date(startMs);
    const end = new Date(endMs);
    const heights = predictor
      .getTimelinePrediction({ start, end, timeFidelity: PREDICTION_STEP_SECONDS })
      .map((point) => ({ ts: point.time.getTime(), height: point.level }));
    const extremes = predictor.getExtremesPrediction({ start, end }).map((extreme) => ({
      ts: extreme.time.getTime(),
      height: extreme.level,
      type: extreme.high ? 'high' : 'low',
    }));
    return { heights, extremes };
  }

  /**
   * Predicción armónica en un intervalo, con la estación más cercana.
   * Lanza un error con code 'no-station' si no hay ninguna estación cerca.
   */
  async function getHarmonicWindow({ lat, lon, startMs, endMs }) {
    const candidates = await loadStationsNear(lat, lon);
    const found = findNearestStation(lat, lon, candidates);
    if (!found) {
      const error = new Error(
        `No hay ninguna estación de marea a menos de ${PescaApp.config.tides.stationMaxDistanceKm} km de este punto. Prueba con un puerto cercano o cambia la fuente en Ajustes.`
      );
      error.code = 'no-station';
      throw error;
    }
    const { heights, extremes } = predictWindow(createStationPredictor(found.station), startMs, endMs);
    return {
      method: SOURCE_HARMONIC,
      heights,
      extremes,
      coversStartMs: startMs,
      coversEndMs: endMs,
      station: describeStation(found.station, found.distanceKm),
    };
  }

  /** Vista en vivo con predicción armónica: 3 h atrás y 33 h adelante. */
  function getHarmonicLive(lat, lon, now) {
    const nowMs = now.getTime();
    return getHarmonicWindow({ lat, lon, startMs: nowMs - LIVE_PAST_MS, endMs: nowMs + LIVE_FUTURE_MS });
  }

  // ---------------------------------------------------------------------------
  // WorldTides (opcional, requiere clave)
  // ---------------------------------------------------------------------------

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

  /** Normaliza la respuesta de WorldTides: milisegundos y extremos 'high' o 'low'. */
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
      station: json.station ? String(json.station) : null,
      distanceToStationM: utils.toFiniteNumber(json.distance),
    };
  }

  /** Datos de la estación de WorldTides, con el mismo formato que las estaciones armónicas. */
  function describeWorldTidesStation(normalized) {
    if (!normalized.station) return null;
    const distanceM = normalized.distanceToStationM;
    return {
      id: `worldtides/${normalized.station}`,
      name: normalized.station,
      country: null,
      distanceKm: Number.isFinite(distanceM) ? PescaApp.utils.round(distanceM / 1000, 1) : null,
      source: 'WorldTides',
      sourceUrl: 'https://www.worldtides.info',
      license: null,
      licenseLabel: 'Términos de WorldTides',
      referenceLabel: 'Alturas según el datum de WorldTides',
    };
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

  /** Pide alturas y extremos a WorldTides, con caché que debe cubrir la ventana pedida. */
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

    const normalized = normalizeTides(json);
    const tides = {
      ...normalized,
      method: SOURCE_WORLDTIDES,
      station: describeWorldTidesStation(normalized),
      coversStartMs: startMs,
      coversEndMs: startMs + lengthSeconds * 1000,
    };
    utils.cache.set(cacheKey, tides);
    return tides;
  }

  /** Vista en vivo con WorldTides: ventana de 3 h atrás y 33 h adelante, caché de 12 h. */
  function getWorldTidesLive(lat, lon, apiKey, now) {
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

  /** Alturas de WorldTides alrededor de una captura pasada (±3 h). */
  function getWorldTidesHistorical(lat, lon, apiKey, centerMs) {
    const startMs = centerMs - 3 * HOUR_MS;
    const endMs = centerMs + 3 * HOUR_MS;
    return getTideWindow({
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
  }

  // ---------------------------------------------------------------------------
  // API pública del módulo
  // ---------------------------------------------------------------------------

  /**
   * Alturas y extremos en vivo, con la fuente elegida en Ajustes.
   * Por defecto, predicción armónica (sin registro).
   */
  async function getLiveTides(lat, lon, apiKey, now = new Date()) {
    if (getSource() === SOURCE_WORLDTIDES) {
      if (!apiKey) {
        throw new Error('Has elegido WorldTides, pero falta la clave. Introdúcela en Ajustes o usa la predicción armónica.');
      }
      return getWorldTidesLive(lat, lon, apiKey, now);
    }
    return getHarmonicLive(lat, lon, now);
  }

  /**
   * Alturas y extremos alrededor de una captura pasada (±3 h).
   * Devuelve null si no hay datos para ese punto y momento.
   */
  async function getHistoricalTides(lat, lon, apiKey, dateTime) {
    try {
      if (getSource() === SOURCE_WORLDTIDES && apiKey) {
        return await getWorldTidesHistorical(lat, lon, apiKey, dateTime.getTime());
      }
      const centerMs = dateTime.getTime();
      return await getHarmonicWindow({ lat, lon, startMs: centerMs - 3 * HOUR_MS, endMs: centerMs + 3 * HOUR_MS });
    } catch (error) {
      return null;
    }
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

  /** Foto de las mareas en un instante, para guardarla con una captura. */
  function buildTideSnapshot(tides, nowMs, coefficient) {
    const summary = summarize(tides, nowMs);
    if (!summary) return null;
    const utils = PescaApp.utils;
    return {
      heightM: summary.currentHeightM === null ? null : utils.round(summary.currentHeightM, 2),
      hoursFromExtreme: summary.hoursFromExtreme === null ? null : utils.round(summary.hoursFromExtreme, 1),
      nextHigh: summary.nextHigh ? { ts: summary.nextHigh.ts, height: summary.nextHigh.height } : null,
      nextLow: summary.nextLow ? { ts: summary.nextLow.ts, height: summary.nextLow.height } : null,
      coefficient,
      station: tides.station
        ? {
            name: tides.station.name,
            distanceKm: tides.station.distanceKm,
            source: tides.station.source,
            licenseLabel: tides.station.licenseLabel,
          }
        : null,
    };
  }

  PescaApp.tides = Object.freeze({
    COEFFICIENT_LAG_DAYS,
    SOURCE_HARMONIC,
    SOURCE_WORLDTIDES,
    getSource,
    saveSource,
    getApiKey,
    saveApiKey,
    estimateCoefficient,
    describeCoefficient,
    tileKeysAround,
    wrapLonIndex,
    loadStationsNear,
    findNearestStation,
    describeLicense,
    describeStation,
    createStationPredictor,
    predictWindow,
    getHarmonicWindow,
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
