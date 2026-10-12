/**
 * Mareas.
 *
 * Fuente por defecto: predicción armónica con las constantes de la estación de
 * marea más cercana (base de datos @neaps/tide-database, código MIT). No necesita
 * registro y cubre cualquier costa que tenga estación a menos de 60 km. Cada
 * estación indica su fuente y su licencia, y la app las muestra junto a la predicción.
 *
 * Coeficiente de marea (con la predicción armónica): amplitud del día local (pleamar
 * más alta menos bajamar más baja) comparada con la amplitud media del año de la
 * estación, con 70 como marea media. Es una estimación: puede diferir del oficial.
 *
 * Fuente opcional: WorldTides, con clave gratuita (se elige en Ajustes). Sin
 * predicción armónica, el coeficiente cae a una estimación por fase lunar.
 *
 * Limitaciones: la predicción armónica no incluye viento, presión ni oleaje, y puede
 * diferir en puertos, estuarios y calas.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  /** Texto traducido al idioma activo. Se busca al llamarlo, no al cargar el módulo. */
  function t(source, vars) {
    return PescaApp.i18n.t(source, vars);
  }

  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  /** Retraso medio de la marea respecto a la fase lunar (días). Se usa en el coeficiente aproximado. */
  const COEFFICIENT_LAG_DAYS = 1.5;

  /** Escala del coeficiente: 70 = marea media del año. */
  const COEFFICIENT_SCALE = 70;

  /** Días de la tabla diaria y de la ventana que define la marea media del año. */
  const DAILY_TABLE_DAYS = 7;
  const REFERENCE_SPAN_DAYS = 365;

  /** Ventana de la vista en vivo: 3 h de pasado y 33 h de futuro. */
  const LIVE_PAST_MS = 3 * HOUR_MS;
  const LIVE_FUTURE_MS = 33 * HOUR_MS;

  /**
   * La predicción armónica es local y barata, así que cubre las 72 h de la previsión
   * por horas. WorldTides sigue con LIVE_FUTURE_MS para no gastar cuota de la clave.
   */
  const HARMONIC_FUTURE_MS = 75 * HOUR_MS;

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
    'cc-by-4.0': PescaApp.i18n.mark('CC BY 4.0'),
    'cc-by-nc-4.0': PescaApp.i18n.mark('CC BY-NC 4.0'),
    'public domain': PescaApp.i18n.mark('Dominio público'),
  });

  /** Peticiones de teselas en curso o ya cargadas, por clave. */
  const tileRequests = new Map();

  /** Amplitudes medias del año por estación y día, para no recalcularlas en cada actualización. */
  const referenceCache = new Map();

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
  // Coeficiente de marea
  // ---------------------------------------------------------------------------

  /**
   * Coeficiente aproximado por fase lunar (escala 20–120, media cercana a 70).
   * Solo se usa cuando no hay predicción armónica. No tiene en cuenta la
   * declinación ni el perigeo.
   */
  function estimateCoefficient(date = new Date()) {
    const phase = PescaApp.moon.getMoonPhase(date);
    const lagFraction = COEFFICIENT_LAG_DAYS / PescaApp.moon.SYNODIC_MONTH_DAYS;
    const effectiveFraction = phase.fraction - lagFraction;
    const springFactor = (1 + Math.cos(4 * Math.PI * effectiveFraction)) / 2;
    return Math.round(20 + 100 * springFactor);
  }

  function describeCoefficient(coefficient) {
    if (!Number.isFinite(coefficient)) return t('Sin dato');
    if (coefficient >= 95) return t('Mareas vivas');
    if (coefficient <= 45) return t('Mareas muertas');
    return t('Mareas intermedias');
  }

  /** Coeficiente a partir de la amplitud del día y la media del año. */
  function coefficientFor(amplitudeM, meanAmplitudeM) {
    if (!Number.isFinite(amplitudeM) || !Number.isFinite(meanAmplitudeM) || meanAmplitudeM <= 0) {
      return null;
    }
    return Math.round((COEFFICIENT_SCALE * amplitudeM) / meanAmplitudeM);
  }

  // ---------------------------------------------------------------------------
  // Fechas en la zona horaria de la estación
  // ---------------------------------------------------------------------------

  /** Zona horaria válida (IANA) o undefined, para usar la del dispositivo. */
  function safeTimeZone(timeZone) {
    if (!timeZone) return undefined;
    try {
      new Intl.DateTimeFormat('en', { timeZone }); // eslint-disable-line no-new
      return timeZone;
    } catch (error) {
      return undefined;
    }
  }

  /** Fecha local "YYYY-MM-DD" de un instante en la zona horaria indicada. */
  function localDateKey(ts, timeZone) {
    const zone = safeTimeZone(timeZone);
    if (!zone) return PescaApp.utils.toDateString(new Date(ts));
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(ts));
    const read = (type) => parts.find((part) => part.type === type).value;
    return `${read('year')}-${read('month')}-${read('day')}`;
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
      return Promise.reject(new Error(t('Los datos de marea solo se pueden cargar en el navegador.')));
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
          reject(new Error(t('No se pudieron cargar los datos de marea de la zona {key}.', { key })));
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
    if (LICENSE_LABELS[type]) return t(LICENSE_LABELS[type]);
    return type || t('Licencia no indicada');
  }

  /** Datos de la estación para mostrarlos y citarlos. */
  function describeStation(station, distanceKm) {
    return {
      id: station.id,
      name: station.name,
      country: station.country,
      timeZone: safeTimeZone(station.tz),
      distanceKm,
      source: station.source,
      sourceUrl: station.sourceUrl,
      license: station.license,
      licenseLabel: describeLicense(station.license),
      referenceLabel: station.datum
        ? t('Alturas sobre LAT (bajamar astronómica)')
        : t('Alturas sobre el nivel medio del mar'),
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

  /** Pleamares y bajamares previstas en el intervalo, en el formato interno. */
  function predictExtremes(predictor, startMs, endMs) {
    return predictor
      .getExtremesPrediction({ start: new Date(startMs), end: new Date(endMs) })
      .map((extreme) => ({
        ts: extreme.time.getTime(),
        height: extreme.level,
        type: extreme.high ? 'high' : 'low',
      }));
  }

  /** Alturas (cada 10 minutos) y extremos previstos en el intervalo. */
  function predictWindow(predictor, startMs, endMs) {
    const heights = predictor
      .getTimelinePrediction({ start: new Date(startMs), end: new Date(endMs), timeFidelity: PREDICTION_STEP_SECONDS })
      .map((point) => ({ ts: point.time.getTime(), height: point.level }));
    return { heights, extremes: predictExtremes(predictor, startMs, endMs) };
  }

  /**
   * Agrupa los extremos por día local. La amplitud del día es la pleamar más alta
   * menos la bajamar más baja (null si el día no tiene ambas).
   */
  function groupExtremesByDay(extremes, timeZone) {
    const days = new Map();
    extremes.forEach((extreme) => {
      const key = localDateKey(extreme.ts, timeZone);
      if (!days.has(key)) days.set(key, { key, extremes: [], highs: [], lows: [] });
      const day = days.get(key);
      day.extremes.push(extreme);
      (extreme.type === 'high' ? day.highs : day.lows).push(extreme.height);
    });
    return [...days.values()]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((day) => ({
        key: day.key,
        extremes: day.extremes.sort((a, b) => a.ts - b.ts),
        amplitudeM:
          day.highs.length && day.lows.length ? Math.max(...day.highs) - Math.min(...day.lows) : null,
      }));
  }

  /**
   * Amplitud media diaria del año alrededor de una fecha (la marea media de la estación).
   * Se guarda en caché por estación y día.
   */
  function meanAmplitudeM(predictor, timeZone, stationId, centerMs) {
    const cacheKey = `${stationId}|${localDateKey(centerMs, timeZone)}`;
    if (!referenceCache.has(cacheKey)) {
      const half = (REFERENCE_SPAN_DAYS / 2) * DAY_MS;
      const amplitudes = groupExtremesByDay(predictExtremes(predictor, centerMs - half, centerMs + half), timeZone)
        .map((day) => day.amplitudeM)
        .filter((value) => value !== null);
      if (!amplitudes.length) return null;
      referenceCache.set(cacheKey, amplitudes.reduce((sum, value) => sum + value, 0) / amplitudes.length);
    }
    return referenceCache.get(cacheKey);
  }

  /**
   * Tabla diaria para la vista en vivo: los próximos días locales con su coeficiente
   * y sus pleamares y bajamares. `todayCoefficient` es el coeficiente del día de hoy.
   */
  function buildDailyTable(predictor, { timeZone, stationId, nowMs, days = DAILY_TABLE_DAYS }) {
    const meanM = meanAmplitudeM(predictor, timeZone, stationId, nowMs);
    const groups = groupExtremesByDay(
      predictExtremes(predictor, nowMs - 36 * HOUR_MS, nowMs + (days + 2) * DAY_MS),
      timeZone
    );
    const todayKey = localDateKey(nowMs, timeZone);
    const table = groups
      .filter((day) => day.key >= todayKey)
      .slice(0, days)
      .map((day) => ({
        dateKey: day.key,
        coefficient: coefficientFor(day.amplitudeM, meanM),
        amplitudeM: day.amplitudeM === null ? null : PescaApp.utils.round(day.amplitudeM, 2),
        extremes: day.extremes,
      }));
    return {
      meanAmplitudeM: meanM === null ? null : PescaApp.utils.round(meanM, 2),
      days: table,
      todayCoefficient: table.length ? table[0].coefficient : null,
    };
  }

  /** Coeficiente del día de una fecha concreta (captura pasada). */
  function coefficientOnDay(predictor, timeZone, stationId, dateMs) {
    const meanM = meanAmplitudeM(predictor, timeZone, stationId, dateMs);
    const key = localDateKey(dateMs, timeZone);
    const day = groupExtremesByDay(
      predictExtremes(predictor, dateMs - 36 * HOUR_MS, dateMs + 36 * HOUR_MS),
      timeZone
    ).find((group) => group.key === key);
    return day ? coefficientFor(day.amplitudeM, meanM) : null;
  }

  /** Estación armónica más cercana con su predictor. Lanza 'no-station' si no hay ninguna. */
  async function resolveHarmonicStation(lat, lon) {
    const candidates = await loadStationsNear(lat, lon);
    const found = findNearestStation(lat, lon, candidates);
    if (!found) {
      const error = new Error(
        t('No hay ninguna estación de marea a menos de {km} km de este punto. Prueba con un puerto cercano o cambia la fuente en Ajustes.', {
          km: PescaApp.config.tides.stationMaxDistanceKm,
        })
      );
      error.code = 'no-station';
      throw error;
    }
    return {
      station: found.station,
      distanceKm: found.distanceKm,
      predictor: createStationPredictor(found.station),
    };
  }

  /** Predicción armónica en un intervalo, con la estación más cercana. */
  async function getHarmonicWindow({ lat, lon, startMs, endMs }) {
    const { station, distanceKm, predictor } = await resolveHarmonicStation(lat, lon);
    const { heights, extremes } = predictWindow(predictor, startMs, endMs);
    return {
      method: SOURCE_HARMONIC,
      heights,
      extremes,
      coversStartMs: startMs,
      coversEndMs: endMs,
      station: describeStation(station, distanceKm),
    };
  }

  /** Vista en vivo con predicción armónica: 3 h atrás, 75 h adelante y la tabla diaria. */
  async function getHarmonicLive(lat, lon, now) {
    const nowMs = now.getTime();
    const { station, distanceKm, predictor } = await resolveHarmonicStation(lat, lon);
    const { heights, extremes } = predictWindow(predictor, nowMs - LIVE_PAST_MS, nowMs + HARMONIC_FUTURE_MS);
    const daily = buildDailyTable(predictor, { timeZone: station.tz, stationId: station.id, nowMs });
    return {
      method: SOURCE_HARMONIC,
      heights,
      extremes,
      coversStartMs: nowMs - LIVE_PAST_MS,
      coversEndMs: nowMs + HARMONIC_FUTURE_MS,
      coefficient: daily.todayCoefficient,
      daily,
      station: describeStation(station, distanceKm),
    };
  }

  /** Predicción alrededor de una captura pasada (±3 h), con el coeficiente de ese día. */
  async function getHarmonicHistorical(lat, lon, dateTime) {
    const centerMs = dateTime.getTime();
    const startMs = centerMs - 3 * HOUR_MS;
    const endMs = centerMs + 3 * HOUR_MS;
    const { station, distanceKm, predictor } = await resolveHarmonicStation(lat, lon);
    const { heights, extremes } = predictWindow(predictor, startMs, endMs);
    return {
      method: SOURCE_HARMONIC,
      heights,
      extremes,
      coversStartMs: startMs,
      coversEndMs: endMs,
      coefficient: coefficientOnDay(predictor, station.tz, station.id, centerMs),
      station: describeStation(station, distanceKm),
    };
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
      throw new Error(t('La respuesta de WorldTides no tiene el formato esperado.'));
    }
    if (json.error) {
      throw new Error(t('WorldTides devolvió un error: {error}', { error: json.error }));
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
      timeZone: undefined,
      distanceKm: Number.isFinite(distanceM) ? PescaApp.utils.round(distanceM / 1000, 1) : null,
      source: t('WorldTides'),
      sourceUrl: 'https://www.worldtides.info',
      license: null,
      licenseLabel: t('Términos de WorldTides'),
      referenceLabel: t('Alturas según el datum de WorldTides'),
    };
  }

  /** Convierte errores HTTP de WorldTides en mensajes comprensibles. */
  function translateTidesError(error) {
    if (error && (error.status === 401 || error.status === 403)) {
      return new Error(t('La clave de WorldTides no es válida o se han agotado sus créditos.'));
    }
    if (error && error.status === 429) {
      return new Error(t('Hay demasiadas peticiones a WorldTides. Prueba más tarde.'));
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  /** Añade la estación de WorldTides con los textos del idioma actual. No se guarda en la caché. */
  function withWorldTidesStation(tides) {
    return { ...tides, station: describeWorldTidesStation(tides) };
  }

  /** Pide alturas y extremos a WorldTides, con caché que debe cubrir la ventana pedida. */
  async function getTideWindow({ lat, lon, apiKey, startMs, endMs, cacheKey, maxAgeMs, requiredStartMs, requiredEndMs }) {
    const utils = PescaApp.utils;
    const cached = utils.cache.get(cacheKey, maxAgeMs);
    if (cached && cached.coversStartMs <= requiredStartMs && cached.coversEndMs >= requiredEndMs) {
      return withWorldTidesStation(cached);
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
    // La caché guarda solo datos, sin textos traducidos: puede sobrevivir a un cambio de idioma.
    const tides = {
      ...normalized,
      method: SOURCE_WORLDTIDES,
      coversStartMs: startMs,
      coversEndMs: startMs + lengthSeconds * 1000,
    };
    utils.cache.set(cacheKey, tides);
    return withWorldTidesStation(tides);
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
   * Alturas, extremos y tabla diaria en vivo, con la fuente elegida en Ajustes.
   * Por defecto, predicción armónica (sin registro).
   */
  async function getLiveTides(lat, lon, apiKey, now = new Date()) {
    if (getSource() === SOURCE_WORLDTIDES) {
      if (!apiKey) {
        throw new Error(t('Has elegido WorldTides, pero falta la clave. Introdúcela en Ajustes o usa la predicción armónica.'));
      }
      return getWorldTidesLive(lat, lon, apiKey, now);
    }
    return getHarmonicLive(lat, lon, now);
  }

  /**
   * Alturas y extremos alrededor de una captura pasada (±3 h), con el coeficiente de ese día.
   * Devuelve null si no hay datos para ese punto y momento.
   */
  async function getHistoricalTides(lat, lon, apiKey, dateTime) {
    try {
      if (getSource() === SOURCE_WORLDTIDES && apiKey) {
        return await getWorldTidesHistorical(lat, lon, apiKey, dateTime.getTime());
      }
      return await getHarmonicHistorical(lat, lon, dateTime);
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

  /**
   * Foto de las mareas en un instante, para guardarla con una captura.
   * El coeficiente sale de la predicción armónica si existe; si no, queda null.
   */
  function buildTideSnapshot(tides, nowMs) {
    const summary = summarize(tides, nowMs);
    if (!summary) return null;
    const utils = PescaApp.utils;
    const hasCoefficient = Number.isFinite(tides.coefficient);
    return {
      heightM: summary.currentHeightM === null ? null : utils.round(summary.currentHeightM, 2),
      hoursFromExtreme: summary.hoursFromExtreme === null ? null : utils.round(summary.hoursFromExtreme, 1),
      nextHigh: summary.nextHigh ? { ts: summary.nextHigh.ts, height: summary.nextHigh.height } : null,
      nextLow: summary.nextLow ? { ts: summary.nextLow.ts, height: summary.nextLow.height } : null,
      coefficient: hasCoefficient ? tides.coefficient : null,
      coefficientSource: hasCoefficient ? t('predicción armónica') : null,
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
    COEFFICIENT_SCALE,
    DAILY_TABLE_DAYS,
    SOURCE_HARMONIC,
    SOURCE_WORLDTIDES,
    getSource,
    saveSource,
    getApiKey,
    saveApiKey,
    estimateCoefficient,
    describeCoefficient,
    coefficientFor,
    safeTimeZone,
    localDateKey,
    tileKeysAround,
    wrapLonIndex,
    loadStationsNear,
    findNearestStation,
    describeLicense,
    describeStation,
    createStationPredictor,
    predictExtremes,
    predictWindow,
    groupExtremesByDay,
    meanAmplitudeM,
    buildDailyTable,
    coefficientOnDay,
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
