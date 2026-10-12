/**
 * Controlador de la interfaz de PescaApp.
 *
 * Une el DOM con los módulos de datos. Cada tarjeta gestiona su propia carga y
 * su propio error, así un fallo de una API no bloquea el resto de la pantalla.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});
  const { utils, moon, weather, tides, activity, validation } = PescaApp;
  const locationService = PescaApp.locationService;
  const speciesCatalog = PescaApp.species;
  const catchLog = PescaApp.catches;

  const THEME_KEY = 'theme';
  const THEME_ORDER = ['auto', 'dark', 'light'];
  const THEME_LABELS = { auto: 'automático', dark: 'oscuro', light: 'claro' };
  /** Las capturas de hace más de una hora se consultan en el histórico. */
  const PAST_CATCH_THRESHOLD_MS = 60 * 60 * 1000;
  const MAX_WEIGHT_KG = 500;
  const MAX_LENGTH_CM = 400;
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  const CLOCK_INTERVAL_MS = 60 * 1000;
  const CHART_PAST_MS = 3 * 60 * 60 * 1000;
  const CHART_FUTURE_MS = 21 * 60 * 60 * 1000;

  const state = {
    place: null,
    forecast: null,
    forecastError: null,
    tides: null,
    tidesError: null,
    pendingPhoto: null,
    searchResults: [],
  };

  /** Identificadores de petición: descartan respuestas antiguas si el usuario cambia de lugar. */
  let forecastRequestId = 0;
  let tidesRequestId = 0;

  let dom = {};

  // ---------------------------------------------------------------------------
  // Utilidades de interfaz
  // ---------------------------------------------------------------------------

  function collectElements() {
    const byId = (id) => document.getElementById(id);
    return {
      themeToggle: byId('theme-toggle'),
      settingsOpen: byId('settings-open'),
      settingsDialog: byId('settings-dialog'),
      settingsClose: byId('settings-close'),
      settingsTheme: byId('settings-theme'),
      settingsTidesForm: byId('settings-tides-form'),
      settingsTidesKey: byId('settings-tides-key'),
      settingsTidesStatus: byId('settings-tides-status'),
      settingsClearData: byId('settings-clear-data'),
      locationCurrent: byId('location-current'),
      zoneBadge: byId('zone-badge'),
      zoneAlert: byId('zone-alert'),
      locationStatus: byId('location-status'),
      gpsButton: byId('gps-button'),
      refreshButton: byId('refresh-button'),
      locationForm: byId('location-form'),
      locationQuery: byId('location-query'),
      locationResults: byId('location-results'),
      weatherBody: byId('weather-body'),
      activityBody: byId('activity-body'),
      moonBody: byId('moon-body'),
      tidesBody: byId('tides-body'),
      speciesFilter: byId('species-filter'),
      speciesCount: byId('species-count'),
      speciesList: byId('species-list'),
      speciesDialog: byId('species-dialog'),
      speciesDialogBody: byId('species-dialog-body'),
      speciesDialogClose: byId('species-dialog-close'),
      catchForm: byId('catch-form'),
      catchDateTime: byId('catch-datetime'),
      catchSpecies: byId('catch-species'),
      catchWeight: byId('catch-weight'),
      catchLength: byId('catch-length'),
      catchBait: byId('catch-bait'),
      catchTechnique: byId('catch-technique'),
      catchNotes: byId('catch-notes'),
      catchPhoto: byId('catch-photo'),
      catchPhotoPreview: byId('catch-photo-preview'),
      catchPlace: byId('catch-place'),
      catchAssessment: byId('catch-assessment'),
      catchStatus: byId('catch-status'),
      catchSubmit: byId('catch-submit'),
      catchCount: byId('catch-count'),
      catchList: byId('catch-list'),
      exportJson: byId('export-json'),
      exportCsv: byId('export-csv'),
      logStatus: byId('log-status'),
      datalistSpecies: byId('datalist-species'),
      datalistBaits: byId('datalist-baits'),
      datalistTechniques: byId('datalist-techniques'),
    };
  }

  /** Muestra un mensaje de estado con un tono visual (info, ok, warning). */
  function setStatus(element, message, tone = 'info') {
    if (!element) return;
    element.textContent = message || '';
    element.className = `status status-${tone}`;
    element.hidden = !message;
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  /** Placeholder de carga para una tarjeta. */
  function renderLoading(element, message) {
    element.innerHTML = `<p class="muted loading">${utils.escapeHtml(message)}</p>`;
  }

  function renderAlert(message, tone = 'warning') {
    return `<p class="alert alert-${tone}">${utils.escapeHtml(message)}</p>`;
  }

  /** Número con signo (+/−) para variaciones. */
  function formatSigned(value, decimals, unit) {
    if (!Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${utils.formatNumber(value, decimals, unit)}`;
  }

  /** Hora "HH:MM" de un instante (milisegundos). */
  function formatClock(ts) {
    return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  /** Hora "HH:MM" de un texto "YYYY-MM-DDTHH:MM" en la hora local del lugar. */
  function formatPlaceClock(text) {
    return typeof text === 'string' && text.length >= 16 ? text.slice(11, 16) : '—';
  }

  /** Fecha y hora legibles para un instante. */
  function formatDayAndClock(ts) {
    const date = new Date(ts);
    return `${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ${formatClock(ts)}`;
  }

  /** Fecha y hora legibles para un texto "YYYY-MM-DDTHH:MM". */
  function formatDateTimeText(text) {
    const date = utils.parseDateTimeString(text);
    if (!date) return '—';
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ---------------------------------------------------------------------------
  // Tema claro/oscuro
  // ---------------------------------------------------------------------------

  function applyTheme(theme) {
    const safeTheme = THEME_ORDER.includes(theme) ? theme : 'auto';
    if (safeTheme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', safeTheme);
    }
    if (dom.themeToggle) {
      dom.themeToggle.textContent = `🌓 Tema: ${THEME_LABELS[safeTheme]}`;
    }
    if (dom.settingsTheme) {
      dom.settingsTheme.value = safeTheme;
    }
  }

  function currentTheme() {
    return utils.storage.read(THEME_KEY, 'auto');
  }

  function cycleTheme() {
    const current = currentTheme();
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    utils.storage.write(THEME_KEY, next);
    applyTheme(next);
  }

  // ---------------------------------------------------------------------------
  // Ubicación
  // ---------------------------------------------------------------------------

  /** Establece el lugar activo, lo guarda y actualiza las tarjetas que dependen de él. */
  function setPlace(place, { refresh = false } = {}) {
    const previous = state.place;
    const placeChanged = !previous || previous.lat !== place.lat || previous.lon !== place.lon;
    if (placeChanged) {
      // Los datos del lugar anterior no deben mezclarse con los del nuevo.
      state.forecast = null;
      state.forecastError = null;
      state.tides = null;
      state.tidesError = null;
    }
    state.place = place;
    locationService.savePlace(place);
    renderPlace();
    renderSpeciesList();
    renderCatchPlace();
    updateCatchAssessment();
    if (refresh) {
      refreshLiveData();
    }
  }

  function renderPlace() {
    const place = state.place;
    if (!place) {
      dom.locationCurrent.innerHTML =
        '<p class="muted">Aún no hay ubicación. Usa el GPS o escribe un lugar o unas coordenadas.</p>';
      dom.zoneBadge.textContent = '';
      dom.zoneBadge.hidden = true;
      dom.zoneAlert.hidden = true;
      dom.refreshButton.disabled = true;
      return;
    }

    const subtitle = [place.locality, place.region].filter(Boolean).join(' · ') || 'Sin comunidad autónoma detectada';
    const sourceLabel = place.source === 'gps' ? 'GPS del dispositivo' : 'Introducida manualmente';
    dom.locationCurrent.innerHTML = `
      <p class="place-name">${utils.escapeHtml(place.name)}</p>
      <p class="muted">${utils.escapeHtml(subtitle)}</p>
      <p class="coords">${utils.escapeHtml(place.lat.toFixed(4))}, ${utils.escapeHtml(place.lon.toFixed(4))} · ${sourceLabel}</p>`;

    dom.zoneBadge.hidden = false;
    dom.zoneBadge.textContent = place.zoneName ? `Zona: ${place.zoneName}` : 'Sin zona';
    dom.refreshButton.disabled = false;

    if (!place.inCoverage) {
      dom.zoneAlert.hidden = false;
      dom.zoneAlert.className = 'alert alert-warning';
      dom.zoneAlert.textContent =
        `Estás a unos ${utils.formatNumber(place.zoneDistanceKm, 0, 'km')} de la costa más cercana del catálogo (${place.anchorName || 'sin referencia'}). ` +
        'Las especies pueden no ser representativas de tu zona. Pesca en agua dulce no incluida.';
    } else {
      dom.zoneAlert.hidden = true;
    }
  }

  /** Pide la posición del GPS. Si falla, muestra el motivo y deja la búsqueda manual disponible. */
  async function requestGps({ silent = false } = {}) {
    setStatus(dom.locationStatus, 'Obteniendo tu ubicación…', 'info');
    try {
      const coords = await locationService.requestBrowserPosition();
      setStatus(dom.locationStatus, 'Identificando el lugar…', 'info');
      const place = await locationService.placeFromCoordinates(coords.lat, coords.lon, 'gps');
      setPlace(place, { refresh: true });
      setStatus(dom.locationStatus, 'Ubicación detectada con el GPS.', 'ok');
    } catch (error) {
      setStatus(dom.locationStatus, utils.describeError(error), silent ? 'info' : 'warning');
    }
  }

  async function handleLocationSearch(event) {
    event.preventDefault();
    const query = dom.locationQuery.value.trim();
    if (!query) return;

    const coords = locationService.parseCoordinates(query);
    if (coords) {
      setStatus(dom.locationStatus, 'Identificando las coordenadas…', 'info');
      try {
        const place = await locationService.placeFromCoordinates(coords.lat, coords.lon, 'manual');
        setPlace(place, { refresh: true });
        setStatus(dom.locationStatus, 'Coordenadas aplicadas.', 'ok');
        renderSearchResults([]);
      } catch (error) {
        setStatus(dom.locationStatus, utils.describeError(error), 'warning');
      }
      return;
    }

    setStatus(dom.locationStatus, 'Buscando el lugar…', 'info');
    try {
      const results = await locationService.searchPlaces(query);
      state.searchResults = results;
      renderSearchResults(results);
      if (results.length === 0) {
        setStatus(dom.locationStatus, 'No se encontró ningún lugar. Prueba con otro nombre o con coordenadas.', 'warning');
      } else {
        setStatus(dom.locationStatus, `Elige un lugar de la lista (${results.length} resultados).`, 'info');
      }
    } catch (error) {
      setStatus(dom.locationStatus, utils.describeError(error), 'warning');
    }
  }

  function renderSearchResults(results) {
    if (!results.length) {
      dom.locationResults.hidden = true;
      dom.locationResults.innerHTML = '';
      return;
    }
    dom.locationResults.hidden = false;
    dom.locationResults.innerHTML = results
      .map((item, index) => {
        const detail = [item.locality, item.region].filter(Boolean).join(' · ');
        return `<li><button type="button" class="result-button" data-result-index="${index}">
          <strong>${utils.escapeHtml(item.name)}</strong>
          <span class="muted">${utils.escapeHtml(detail)}</span>
        </button></li>`;
      })
      .join('');
  }

  async function chooseSearchResult(index) {
    const item = state.searchResults[index];
    if (!item) return;
    const place = locationService.buildPlace({
      lat: item.lat,
      lon: item.lon,
      name: item.name,
      locality: item.locality,
      region: item.region,
      source: 'manual',
    });
    setPlace(place, { refresh: true });
    renderSearchResults([]);
    state.searchResults = [];
    setStatus(dom.locationStatus, 'Lugar aplicado.', 'ok');
  }

  // ---------------------------------------------------------------------------
  // Datos en vivo: clima, agua, mareas, índice y luna
  // ---------------------------------------------------------------------------

  async function refreshLiveData() {
    const place = state.place;
    if (!place) return;
    await Promise.allSettled([loadForecast(place), loadTides(place)]);
    renderMoonCard();
    renderActivityCard();
  }

  async function loadForecast(place) {
    const requestId = ++forecastRequestId;
    renderLoading(dom.weatherBody, 'Consultando el tiempo…');
    state.forecastError = null;
    try {
      const forecast = await weather.getForecast(place.lat, place.lon);
      const waterTemperatureC = await weather.getWaterTemperature(place.lat, place.lon, forecast.observedAt);
      if (requestId !== forecastRequestId) return;
      state.forecast = { ...forecast, waterTemperatureC };
    } catch (error) {
      if (requestId !== forecastRequestId) return;
      state.forecast = null;
      state.forecastError = utils.describeError(error);
    }
    renderWeatherCard();
  }

  async function loadTides(place) {
    const requestId = ++tidesRequestId;
    state.tidesError = null;
    const apiKey = tides.getApiKey();
    if (!apiKey) {
      state.tides = null;
      renderTidesCard();
      return;
    }
    renderTidesCard();
    try {
      const tideData = await tides.getLiveTides(place.lat, place.lon, apiKey);
      if (requestId !== tidesRequestId) return;
      state.tides = tideData;
    } catch (error) {
      if (requestId !== tidesRequestId) return;
      state.tides = null;
      state.tidesError = utils.describeError(error);
    }
    renderTidesCard();
  }

  function renderWeatherCard() {
    const forecast = state.forecast;
    if (!state.place) {
      dom.weatherBody.innerHTML = '<p class="muted">Define una ubicación para ver el tiempo.</p>';
      return;
    }
    if (!forecast) {
      dom.weatherBody.innerHTML = renderAlert(state.forecastError || 'No hay datos del tiempo.', 'warning');
      return;
    }

    const condition = weather.describeWeatherCode(forecast.weatherCode);
    const knots = utils.kmhToKnots(forecast.windSpeedKmh);
    const windText = `${fmt(forecast.windSpeedKmh, 0, 'km/h')} (${fmt(knots, 1, 'nudos')}) del ${utils.cardinalDirection(forecast.windDirectionDeg)}`;
    const trend = forecast.pressureTrend3hHpa;
    const trendArrow = trend === null ? '' : trend > 0 ? '▲' : trend < 0 ? '▼' : '➖';
    const pressureText = `${fmt(forecast.pressureHpa, 0, 'hPa')}${
      trend === null ? '' : ` · ${trendArrow} ${formatSigned(trend, 1, 'hPa')} en 3 h`
    }`;
    const waterText =
      forecast.waterTemperatureC === null || forecast.waterTemperatureC === undefined
        ? 'No disponible en esta ubicación'
        : fmt(forecast.waterTemperatureC, 1, '°C');

    const rows = [
      ['Temperatura del aire', `${fmt(forecast.airTemperatureC, 1, '°C')}`, `sensación ${fmt(forecast.apparentTemperatureC, 1, '°C')}`],
      ['Temperatura del agua', waterText, 'modelo marino'],
      ['Viento', windText, `ráfagas ${fmt(forecast.windGustsKmh, 0, 'km/h')}`],
      ['Presión', pressureText, 'nivel del mar'],
      ['Humedad', fmt(forecast.humidityPercent, 0, '%'), ''],
      ['Nubosidad', fmt(forecast.cloudCoverPercent, 0, '%'), ''],
      ['Precipitación', fmt(forecast.precipitationMm, 1, 'mm'), 'en la última hora'],
      ['Amanecer · atardecer', `${formatPlaceClock(forecast.sunrise)} · ${formatPlaceClock(forecast.sunset)}`, 'hora local'],
    ];

    dom.weatherBody.innerHTML = `
      <div class="weather-hero">
        <span class="weather-icon" aria-hidden="true">${condition.icon}</span>
        <div>
          <p class="big">${utils.escapeHtml(condition.label)}</p>
          <p class="muted">Actualizado ${formatPlaceClock(forecast.observedAt)} (hora local del lugar)</p>
        </div>
      </div>
      <dl class="data-list">
        ${rows
          .map(
            ([label, value, note]) => `
          <div class="data-row">
            <dt>${utils.escapeHtml(label)}</dt>
            <dd><strong>${utils.escapeHtml(value)}</strong>${note ? `<span class="muted"> · ${utils.escapeHtml(note)}</span>` : ''}</dd>
          </div>`
          )
          .join('')}
      </dl>`;
  }

  /** Atajo de formato con los valores por defecto de la app. */
  function fmt(value, decimals = 0, unit = '') {
    return utils.formatNumber(value, decimals, unit);
  }

  function renderMoonCard() {
    const now = new Date();
    const phase = moon.getMoonPhase(now);
    dom.moonBody.innerHTML = `
      <div class="moon-hero">
        <span class="moon-icon" aria-hidden="true">${phase.icon}</span>
        <div>
          <p class="big">${utils.escapeHtml(phase.name)}</p>
          <p class="muted">Iluminación ${phase.illuminationPercent}% · ${fmt(phase.ageDays, 1)} días de edad</p>
        </div>
      </div>
      <p>Próxima ${utils.escapeHtml(phase.nextSyzygy.name.toLowerCase())} en ${fmt(phase.nextSyzygy.daysAway, 1)} días
        (${utils.escapeHtml(phase.nextSyzygy.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}).</p>
      <p class="fineprint">El coeficiente de marea aparece en la tarjeta de mareas.</p>`;
  }

  /** Calcula el índice con los datos actuales de tiempo, luna y marea. */
  function computeCurrentActivity(now = new Date()) {
    const phase = moon.getMoonPhase(now);
    const tideSummary = state.tides ? tides.summarize(state.tides, now.getTime()) : null;
    return activity.computeActivityIndex({
      pressureHpa: state.forecast ? state.forecast.pressureHpa : null,
      pressureTrend3hHpa: state.forecast ? state.forecast.pressureTrend3hHpa : null,
      moonDistanceToSyzygy: phase.distanceToSyzygy,
      windSpeedKmh: state.forecast ? state.forecast.windSpeedKmh : null,
      hoursFromTideExtreme: tideSummary ? tideSummary.hoursFromExtreme : null,
      tideCoefficient: tides.estimateCoefficient(now),
    });
  }

  function renderActivityCard() {
    if (!state.place) {
      dom.activityBody.innerHTML = '<p class="muted">Define una ubicación para calcular el índice.</p>';
      return;
    }
    const result = computeCurrentActivity();
    const scoreText = result.score === null ? '—' : String(result.score);
    const factorsHtml = result.factors
      .map(
        (factor) => `
        <li class="factor factor-${factor.tone}">
          <div class="factor-head">
            <span>${utils.escapeHtml(factor.label)}</span>
            <span class="muted">${factor.score}/100 · peso ${factor.sharePercent}%</span>
          </div>
          <div class="bar"><span style="width:${factor.score}%"></span></div>
          <p class="fineprint">${utils.escapeHtml(factor.explanation)}</p>
        </li>`
      )
      .join('');

    dom.activityBody.innerHTML = `
      <div class="score-row">
        <div class="score-badge" aria-label="Índice de actividad ${scoreText} sobre 100">${scoreText}</div>
        <div>
          <p class="big">${utils.escapeHtml(result.level)}</p>
          <p class="muted">Escala de 0 a 100</p>
        </div>
      </div>
      <p>${utils.escapeHtml(result.summary)}</p>
      <ul class="factor-list">${factorsHtml}</ul>
      <p class="fineprint">Heurística orientativa: combina presión, luna, viento y marea. No garantiza capturas.</p>`;
  }

  function renderTidesCard() {
    if (!state.place) {
      dom.tidesBody.innerHTML = '<p class="muted">Define una ubicación para ver las mareas.</p>';
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const coefficient = tides.estimateCoefficient(now);
    const coefficientHtml = `
      <div class="coefficient">
        <span class="muted">Coeficiente de marea (aprox.)</span>
        <strong>${coefficient}</strong>
        <span>${utils.escapeHtml(tides.describeCoefficient(coefficient))}</span>
      </div>`;

    const apiKey = tides.getApiKey();
    if (!apiKey) {
      dom.tidesBody.innerHTML = `
        <p>Para ver alturas, pleamares y bajamares necesitas una clave gratuita de WorldTides (regístrate en worldtides.info).</p>
        <button type="button" class="btn btn-primary" data-action="open-settings">Configurar clave</button>
        ${coefficientHtml}`;
      return;
    }

    if (state.tidesError) {
      dom.tidesBody.innerHTML = `${renderAlert(state.tidesError, 'warning')}${coefficientHtml}`;
      return;
    }

    if (!state.tides) {
      dom.tidesBody.innerHTML = `<p class="muted loading">Consultando mareas…</p>${coefficientHtml}`;
      return;
    }

    const summary = tides.summarize(state.tides, nowMs);
    const chartStart = nowMs - CHART_PAST_MS;
    const chartEnd = nowMs + CHART_FUTURE_MS;
    const geometry = tides.buildChartGeometry(state.tides, {
      startMs: chartStart,
      endMs: chartEnd,
      nowMs,
    });
    const nextRows = state.tides.extremes
      .filter((extreme) => extreme.ts >= nowMs && extreme.ts <= chartEnd)
      .map(
        (extreme) => `
        <tr>
          <td>${extreme.type === 'high' ? 'Pleamar' : 'Bajamar'}</td>
          <td>${utils.escapeHtml(formatDayAndClock(extreme.ts))}</td>
          <td>${fmt(extreme.height, 2, 'm')}</td>
        </tr>`
      )
      .join('');

    const currentText = summary && summary.currentHeightM !== null ? fmt(summary.currentHeightM, 2, 'm') : '—';
    const nextHighText = summary && summary.nextHigh ? formatDayAndClock(summary.nextHigh.ts) : 'Sin dato';
    const nextLowText = summary && summary.nextLow ? formatDayAndClock(summary.nextLow.ts) : 'Sin dato';

    dom.tidesBody.innerHTML = `
      <div class="tide-summary">
        <div class="tide-stat"><span class="muted">Altura ahora</span><strong>${currentText}</strong></div>
        <div class="tide-stat"><span class="muted">Próxima pleamar</span><strong>${utils.escapeHtml(nextHighText)}</strong></div>
        <div class="tide-stat"><span class="muted">Próxima bajamar</span><strong>${utils.escapeHtml(nextLowText)}</strong></div>
        ${coefficientHtml}
      </div>
      ${geometry ? buildTideSvg(geometry, chartStart, chartEnd) : renderAlert('No hay datos de altura para representar la gráfica.', 'info')}
      <details class="extremes">
        <summary>Pleamares y bajamares de las próximas 24 horas</summary>
        ${
          nextRows
            ? `<div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Fecha y hora</th><th>Altura</th></tr></thead><tbody>${nextRows}</tbody></table></div>`
            : '<p class="muted">No hay extremos previstos en las próximas 24 horas.</p>'
        }
      </details>
      <p class="fineprint">Alturas: WorldTides, referidas al datum del servicio. El coeficiente es una estimación por fase lunar, no el oficial. Consulta las tablas oficiales para navegar o pescar en zonas peligrosas.</p>`;
  }

  /** SVG de la gráfica de mareas. Todos los valores son numéricos o texto escapado. */
  function buildTideSvg(geometry, startMs, endMs) {
    const { width, height, padding, points, extremes, nowX, yMin, yMax } = geometry;
    const xOf = (ts) => padding + ((ts - startMs) / (endMs - startMs)) * (width - 2 * padding);
    const baseY = height - padding;
    const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `${padding},${baseY} ${line} ${width - padding},${baseY}`;

    const markers = extremes
      .map((extreme) => {
        const labelY = extreme.type === 'high' ? extreme.y - 10 : extreme.y + 16;
        return `<circle cx="${extreme.x.toFixed(1)}" cy="${extreme.y.toFixed(1)}" r="4" class="${extreme.type === 'high' ? 'marker-high' : 'marker-low'}"/>
          <text x="${extreme.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="chart-label">${utils.escapeHtml(formatClock(extreme.ts))}</text>`;
      })
      .join('');

    const ticks = [];
    const firstTick = new Date(startMs);
    firstTick.setMinutes(0, 0, 0);
    for (let ts = firstTick.getTime(); ts <= endMs; ts += 3 * 60 * 60 * 1000) {
      if (ts < startMs) continue;
      ticks.push(
        `<text x="${xOf(ts).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${utils.escapeHtml(formatClock(ts))}</text>`
      );
    }

    const nowLine =
      nowX === null
        ? ''
        : `<line x1="${nowX.toFixed(1)}" x2="${nowX.toFixed(1)}" y1="${padding}" y2="${baseY}" class="now-line"/>`;

    return `
      <figure class="tide-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Alturas de marea de las próximas 24 horas">
          <polygon points="${area}" class="tide-area"/>
          <polyline points="${line}" class="tide-line"/>
          ${nowLine}
          ${markers}
          ${ticks.join('')}
          <text x="4" y="${padding + 4}" class="chart-axis">${utils.escapeHtml(fmt(yMax, 1, 'm'))}</text>
          <text x="4" y="${baseY}" class="chart-axis">${utils.escapeHtml(fmt(yMin, 1, 'm'))}</text>
        </svg>
        <figcaption class="fineprint">Línea continua: altura prevista. Línea vertical: ahora.</figcaption>
      </figure>`;
  }

  // ---------------------------------------------------------------------------
  // Especies
  // ---------------------------------------------------------------------------

  function renderSpeciesList() {
    const place = state.place;
    if (!place || !place.zoneId) {
      dom.speciesList.innerHTML = '<li class="muted">Define una ubicación para ver las especies de la zona.</li>';
      dom.speciesCount.textContent = '';
      return;
    }

    const filter = dom.speciesFilter.value.trim();
    const list = filter
      ? speciesCatalog.searchSpecies(filter, { zoneId: place.zoneId, limit: 100 })
      : speciesCatalog.getSpeciesForZone(place.zoneId);

    dom.speciesCount.textContent = `${list.length} especies en ${place.zoneName}`;
    if (list.length === 0) {
      dom.speciesList.innerHTML = '<li class="muted">Ninguna especie coincide con la búsqueda.</li>';
      return;
    }

    dom.speciesList.innerHTML = list.map((species) => speciesItemHtml(species, place.zoneId)).join('');
  }

  function speciesItemHtml(species, zoneId) {
    const minSizeCm = validation.getMinSizeCm(species, zoneId);
    const chips = [];
    chips.push(
      minSizeCm === null
        ? '<span class="chip chip-muted">Talla: sin dato confirmado</span>'
        : `<span class="chip">Talla mín. ${minSizeCm} cm</span>`
    );
    if (species.protected) chips.push('<span class="chip chip-danger">Protegida</span>');
    if (species.peakMonths && species.peakMonths.length) {
      chips.push(`<span class="chip">Pico: ${utils.escapeHtml(speciesCatalog.formatMonths(species.peakMonths))}</span>`);
    }
    return `
      <li>
        <button type="button" class="species-button" data-species-id="${utils.escapeHtml(species.id)}">
          <span class="species-name">${utils.escapeHtml(species.commonName)}</span>
          <span class="species-sci">${utils.escapeHtml(species.scientificName)}</span>
          <span class="chips">${chips.join('')}</span>
        </button>
      </li>`;
  }

  function openSpeciesDialog(speciesId) {
    const species = speciesCatalog.getSpeciesById(speciesId);
    if (!species) return;

    const sizeRows = species.zones
      .map((zoneId) => {
        const zone = speciesCatalog.getZoneById(zoneId);
        const minSizeCm = validation.getMinSizeCm(species, zoneId);
        return `<tr><td>${utils.escapeHtml(zone ? zone.name : zoneId)}</td><td>${
          minSizeCm === null ? 'Sin dato confirmado' : `${minSizeCm} cm`
        }</td></tr>`;
      })
      .join('');
    const closedHtml =
      species.closedSeasons && species.closedSeasons.length
        ? species.closedSeasons
            .map((season) => `<li>${utils.escapeHtml(season.reason || 'Veda')}: ${utils.escapeHtml(speciesCatalog.formatMonths(season.months))}</li>`)
            .join('')
        : '<li class="muted">No hay vedas registradas en esta base de datos. Consulta la normativa vigente.</li>';
    const listItems = (items) => items.map((item) => `<li>${utils.escapeHtml(item)}</li>`).join('');

    dom.speciesDialogBody.innerHTML = `
      <h2>${utils.escapeHtml(species.commonName)}</h2>
      <p class="species-sci">${utils.escapeHtml(species.scientificName)} · ${utils.escapeHtml(species.family)}</p>
      ${species.protected ? renderAlert(species.protectionNote || 'Especie protegida: no debe retenerse.', 'danger') : ''}
      ${species.alertNote ? renderAlert(species.alertNote, 'warning') : ''}
      <dl class="data-list">
        <div class="data-row"><dt>Hábitat</dt><dd>${utils.escapeHtml(species.habitat)}</dd></div>
        <div class="data-row"><dt>Profundidad</dt><dd>${fmt(species.depthRangeM[0])}–${fmt(species.depthRangeM[1], 0, 'm')}</dd></div>
        <div class="data-row"><dt>Peso medio y máximo</dt><dd>${fmt(species.averageWeightKg, 1, 'kg')} · ${fmt(species.maxWeightKg, 0, 'kg')} (orientativo)</dd></div>
        <div class="data-row"><dt>Longitud máxima</dt><dd>${fmt(species.maxLengthCm, 0, 'cm')} (orientativo)</dd></div>
        <div class="data-row"><dt>Periodo de mayor actividad</dt><dd>${utils.escapeHtml(speciesCatalog.formatMonths(species.peakMonths))}. ${utils.escapeHtml(species.peakNote || '')}</dd></div>
      </dl>
      <h3>Tallas mínimas de referencia</h3>
      <div class="table-wrap"><table><thead><tr><th>Zona</th><th>Talla</th></tr></thead><tbody>${sizeRows}</tbody></table></div>
      <p class="fineprint">${utils.escapeHtml(species.minSizeNote || '')}</p>
      <h3>Cebos recomendados</h3>
      <ul>${listItems(species.baits || [])}</ul>
      <h3>Técnicas</h3>
      <ul>${listItems(species.techniques || [])}</ul>
      <h3>Vedas y restricciones</h3>
      <ul>${closedHtml}</ul>
      <p>${utils.escapeHtml(species.restrictions || '')}</p>
      <h3>Fuentes</h3>
      <ul class="sources">${listItems(species.sources || [])}</ul>`;
    openDialog(dom.speciesDialog);
  }

  function populateDatalists() {
    const catalog = speciesCatalog.getSpeciesList();
    dom.datalistSpecies.innerHTML = catalog
      .map((species) => `<option value="${utils.escapeHtml(species.commonName)}"></option>`)
      .join('');
    const baits = [...new Set(catalog.flatMap((species) => species.baits || []))];
    const techniques = [...new Set(catalog.flatMap((species) => species.techniques || []))];
    dom.datalistBaits.innerHTML = baits.map((bait) => `<option value="${utils.escapeHtml(bait)}"></option>`).join('');
    dom.datalistTechniques.innerHTML = techniques
      .map((technique) => `<option value="${utils.escapeHtml(technique)}"></option>`)
      .join('');
  }

  // ---------------------------------------------------------------------------
  // Registro de capturas
  // ---------------------------------------------------------------------------

  function renderCatchPlace() {
    if (!state.place) {
      dom.catchPlace.textContent = 'Define primero una ubicación en la sección de arriba.';
      return;
    }
    dom.catchPlace.textContent = `Lugar de la captura: ${state.place.name}${state.place.zoneName ? ` (${state.place.zoneName})` : ''}`;
  }

  function renderCatchFormDefaults() {
    const now = new Date();
    if (!dom.catchDateTime.value) {
      dom.catchDateTime.value = utils.toDateTimeString(now);
    }
    dom.catchDateTime.max = utils.toDateTimeString(now);
    renderCatchPlace();
  }

  function readCatchForm() {
    return {
      dateTimeText: dom.catchDateTime.value,
      speciesText: dom.catchSpecies.value.trim(),
      weightText: dom.catchWeight.value,
      lengthText: dom.catchLength.value,
      bait: dom.catchBait.value,
      technique: dom.catchTechnique.value,
      notes: dom.catchNotes.value,
    };
  }

  /** Errores de formato del formulario. Devuelve una lista de mensajes (vacía si todo está bien). */
  function validateCatchInput(values) {
    const errors = [];
    const dateTime = utils.parseDateTimeString(values.dateTimeText);
    if (!dateTime) {
      errors.push('Indica la fecha y la hora de la captura.');
    } else if (dateTime.getTime() > Date.now() + 60 * 1000) {
      errors.push('La fecha de la captura no puede ser futura.');
    }
    if (!values.speciesText) {
      errors.push('Indica la especie.');
    }
    const weightKg = utils.toFiniteNumber(values.weightText);
    if (values.weightText.trim() && (weightKg === null || weightKg <= 0 || weightKg > MAX_WEIGHT_KG)) {
      errors.push(`El peso debe estar entre 0 y ${MAX_WEIGHT_KG} kg.`);
    }
    const lengthCm = utils.toFiniteNumber(values.lengthText);
    if (values.lengthText.trim() && (lengthCm === null || lengthCm <= 0 || lengthCm > MAX_LENGTH_CM)) {
      errors.push(`La longitud debe estar entre 0 y ${MAX_LENGTH_CM} cm.`);
    }
    return errors;
  }

  /** Alertas en vivo y peso estimado mientras se rellena el formulario. */
  function updateCatchAssessment() {
    const values = readCatchForm();
    if (!values.speciesText) {
      dom.catchAssessment.innerHTML =
        '<ul class="alert-list"><li class="alert-item alert-info">Escribe la especie para comprobar la talla mínima y las vedas.</li></ul>';
      return;
    }
    const species = speciesCatalog.findSpeciesByName(values.speciesText);
    const lengthCm = utils.toFiniteNumber(values.lengthText);
    const weightKg = utils.toFiniteNumber(values.weightText);
    const dateTime = utils.parseDateTimeString(values.dateTimeText) || new Date();
    const zoneId = state.place ? state.place.zoneId : null;

    const assessment = validation.evaluateCatch({ species, zoneId, lengthCm, dateTime });
    const alertsHtml = assessment.alerts
      .map((alert) => `<li class="alert-item alert-${alert.level}">${utils.escapeHtml(alert.message)}</li>`)
      .join('');

    let estimateHtml = '';
    if (species && lengthCm !== null && weightKg === null) {
      const estimate = validation.estimateWeightKg(lengthCm, species);
      const relation = validation.getLengthWeightRelation(species);
      estimateHtml = `<p class="estimate">Peso estimado: <strong>${fmt(estimate, 2, 'kg')}</strong>
        <span class="fineprint">(W = a · L^b; ${utils.escapeHtml(relation.source)}. Error de ±30 % habitual.)</span></p>`;
    }

    const verdict = assessment.mustRelease
      ? renderAlert('Esta captura debe devolverse según las comprobaciones.', 'danger')
      : '';
    dom.catchAssessment.innerHTML = `${verdict}<ul class="alert-list">${alertsHtml}</ul>${estimateHtml}`;
  }

  async function handlePhotoChange() {
    const file = dom.catchPhoto.files && dom.catchPhoto.files[0];
    state.pendingPhoto = null;
    dom.catchPhotoPreview.hidden = true;
    dom.catchPhotoPreview.removeAttribute('src');
    if (!file) return;
    setStatus(dom.catchStatus, 'Preparando la foto…', 'info');
    try {
      state.pendingPhoto = await catchLog.resizeImageFile(file);
      dom.catchPhotoPreview.src = state.pendingPhoto;
      dom.catchPhotoPreview.hidden = false;
      setStatus(dom.catchStatus, 'Foto lista. Se guardará con la captura.', 'ok');
    } catch (error) {
      dom.catchPhoto.value = '';
      setStatus(dom.catchStatus, utils.describeError(error), 'warning');
    }
  }

  /** Condiciones de la captura: históricas si es pasada, actuales si es reciente. Nunca lanza error. */
  async function buildCatchConditions(dateTime, dateTimeText) {
    const place = state.place;
    const now = new Date();
    const isPast = dateTime.getTime() < now.getTime() - PAST_CATCH_THRESHOLD_MS;
    const apiKey = tides.getApiKey();

    try {
      let weatherData;
      let sourceLabel;
      let tideWindow = null;

      if (isPast) {
        weatherData = await weather.getHistoricalConditions(place.lat, place.lon, dateTimeText, now);
        sourceLabel = weatherData.source;
        if (apiKey) {
          tideWindow = await tides.getHistoricalTides(place.lat, place.lon, apiKey, dateTime);
        }
      } else {
        weatherData = state.forecast;
        sourceLabel = 'Condiciones actuales';
        if (apiKey && state.tides) {
          tideWindow = state.tides;
        }
      }

      const moonPhase = moon.getMoonPhase(dateTime);
      const coefficient = tides.estimateCoefficient(dateTime);
      const tideSnapshot = tideWindow
        ? tides.buildTideSnapshot(tideWindow, dateTime.getTime(), coefficient)
        : { heightM: null, hoursFromExtreme: null, nextHigh: null, nextLow: null, coefficient };

      const tideSummary = tideWindow ? tides.summarize(tideWindow, dateTime.getTime()) : null;
      const activityResult = activity.computeActivityIndex({
        pressureHpa: weatherData ? weatherData.pressureHpa : null,
        pressureTrend3hHpa: weatherData ? weatherData.pressureTrend3hHpa : null,
        moonDistanceToSyzygy: moonPhase.distanceToSyzygy,
        windSpeedKmh: weatherData ? weatherData.windSpeedKmh : null,
        hoursFromTideExtreme: tideSummary ? tideSummary.hoursFromExtreme : null,
        tideCoefficient: coefficient,
      });

      return {
        source: sourceLabel,
        weather: weatherData
          ? {
              airTemperatureC: weatherData.airTemperatureC,
              waterTemperatureC: weatherData.waterTemperatureC ?? null,
              pressureHpa: weatherData.pressureHpa,
              pressureTrend3hHpa: weatherData.pressureTrend3hHpa,
              windSpeedKmh: weatherData.windSpeedKmh,
              windDirectionDeg: weatherData.windDirectionDeg,
              cloudCoverPercent: weatherData.cloudCoverPercent,
              precipitationMm: weatherData.precipitationMm,
              humidityPercent: weatherData.humidityPercent,
              weatherCode: weatherData.weatherCode,
            }
          : null,
        moon: { name: moonPhase.name, illuminationPercent: moonPhase.illuminationPercent },
        tide: tideSnapshot,
        activity: { score: activityResult.score, level: activityResult.level },
      };
    } catch (error) {
      return {
        source: 'No disponibles',
        error: utils.describeError(error),
        weather: null,
        moon: null,
        tide: null,
        activity: null,
      };
    }
  }

  async function handleCatchSubmit(event) {
    event.preventDefault();
    const values = readCatchForm();
    const errors = validateCatchInput(values);
    if (errors.length) {
      setStatus(dom.catchStatus, errors.join(' '), 'warning');
      return;
    }
    if (!state.place) {
      setStatus(dom.catchStatus, 'Define primero la ubicación de la captura.', 'warning');
      return;
    }

    const dateTime = utils.parseDateTimeString(values.dateTimeText);
    let result;
    let photoDropped = false;
    dom.catchSubmit.disabled = true;
    try {
      setStatus(dom.catchStatus, 'Consultando las condiciones de ese momento…', 'info');
      const conditions = await buildCatchConditions(dateTime, values.dateTimeText);
      const record = catchLog.createRecord({
        dateTimeText: values.dateTimeText,
        species: speciesCatalog.findSpeciesByName(values.speciesText),
        speciesText: values.speciesText,
        zoneId: state.place.zoneId,
        place: state.place,
        weightKg: values.weightText,
        lengthCm: values.lengthText,
        bait: values.bait,
        technique: values.technique,
        notes: values.notes,
        photo: state.pendingPhoto,
        conditions,
      });

      result = catchLog.addCatch(record);
      if (!result.ok && record.photo) {
        // Sin espacio para la foto: se intenta guardar la captura sin ella.
        record.photo = null;
        result = catchLog.addCatch(record);
        photoDropped = true;
      }
    } catch (error) {
      setStatus(dom.catchStatus, utils.describeError(error), 'warning');
      return;
    } finally {
      dom.catchSubmit.disabled = false;
    }

    if (!result.ok) {
      setStatus(
        dom.catchStatus,
        'No hay espacio en el navegador para guardar la captura. Exporta y elimina capturas antiguas.',
        'warning'
      );
      return;
    }

    resetCatchForm();
    renderCatchList();
    if (photoDropped) {
      setStatus(dom.catchStatus, 'Captura guardada, pero sin foto: no hay espacio suficiente en el navegador.', 'warning');
    } else {
      setStatus(dom.catchStatus, 'Captura guardada.', 'ok');
    }
  }

  function resetCatchForm() {
    dom.catchForm.reset();
    state.pendingPhoto = null;
    dom.catchPhotoPreview.hidden = true;
    dom.catchPhotoPreview.removeAttribute('src');
    dom.catchDateTime.value = utils.toDateTimeString(new Date());
    updateCatchAssessment();
  }

  function renderCatchList() {
    const list = catchLog
      .loadAll()
      .slice()
      .sort((a, b) => (a.dateTime < b.dateTime ? 1 : a.dateTime > b.dateTime ? -1 : 0));
    dom.catchCount.textContent = `${list.length} ${list.length === 1 ? 'captura guardada' : 'capturas guardadas'}`;

    if (list.length === 0) {
      dom.catchList.innerHTML = '<p class="muted">Todavía no hay capturas. Registra la primera en el formulario.</p>';
      return;
    }
    dom.catchList.innerHTML = list.map(catchCardHtml).join('');
  }

  function catchCardHtml(record) {
    const measures = [];
    if (record.weightKg !== null) measures.push(fmt(record.weightKg, 2, 'kg'));
    if (record.estimatedWeightKg !== null) measures.push(`≈ ${fmt(record.estimatedWeightKg, 2, 'kg')} (estimado)`);
    if (record.lengthCm !== null) measures.push(fmt(record.lengthCm, 0, 'cm'));
    const badge = record.assessment && record.assessment.mustRelease
      ? '<span class="chip chip-danger">Devolver</span>'
      : '<span class="chip chip-ok">Cumple lo comprobado</span>';
    const issues = (record.assessment && record.assessment.alerts ? record.assessment.alerts : []).filter(
      (alert) => alert.level === 'danger' || alert.level === 'warning'
    );
    const conditions = record.conditions;
    const weatherLine = conditions && conditions.weather
      ? `Aire ${fmt(conditions.weather.airTemperatureC, 1, '°C')} · agua ${fmt(conditions.weather.waterTemperatureC, 1, '°C')} · viento ${fmt(conditions.weather.windSpeedKmh, 0, 'km/h')} · presión ${fmt(conditions.weather.pressureHpa, 0, 'hPa')}`
      : 'Sin datos meteorológicos';
    const tideLine = conditions && conditions.tide && conditions.tide.heightM !== null
      ? `Marea ${fmt(conditions.tide.heightM, 2, 'm')}`
      : conditions && conditions.tide
        ? `Coeficiente aprox. ${conditions.tide.coefficient ?? '—'}`
        : 'Sin datos de marea';

    return `
      <article class="catch-card">
        <header class="catch-head">
          <div>
            <p class="catch-title">${utils.escapeHtml(record.speciesName)}</p>
            <p class="muted">${utils.escapeHtml(formatDateTimeText(record.dateTime))} · ${utils.escapeHtml(record.place ? record.place.name : 'Lugar sin nombre')}</p>
          </div>
          ${badge}
        </header>
        <p>${utils.escapeHtml(measures.join(' · ') || 'Sin medidas')}</p>
        ${record.photo ? `<img class="catch-photo" src="${utils.escapeHtml(record.photo)}" alt="Foto de la captura de ${utils.escapeHtml(record.speciesName)}">` : ''}
        ${issues.length ? `<ul class="alert-list">${issues.map((alert) => `<li class="alert-item alert-${alert.level}">${utils.escapeHtml(alert.message)}</li>`).join('')}</ul>` : ''}
        <details>
          <summary>Condiciones del momento</summary>
          <p class="fineprint">${utils.escapeHtml(conditions ? conditions.source : 'Sin origen')}</p>
          <p>${utils.escapeHtml(weatherLine)}</p>
          <p>${utils.escapeHtml(tideLine)}${conditions && conditions.moon ? ` · Luna: ${utils.escapeHtml(conditions.moon.name)}` : ''}</p>
          ${conditions && conditions.activity && conditions.activity.score !== null ? `<p>Índice de actividad: ${conditions.activity.score}/100 (${utils.escapeHtml(conditions.activity.level)})</p>` : ''}
          ${conditions && conditions.error ? renderAlert(conditions.error, 'warning') : ''}
        </details>
        ${record.bait || record.technique || record.notes ? `<p class="fineprint">${utils.escapeHtml([record.bait && `Cebo: ${record.bait}`, record.technique && `Técnica: ${record.technique}`, record.notes && `Notas: ${record.notes}`].filter(Boolean).join(' · '))}</p>` : ''}
        <footer class="catch-foot">
          <button type="button" class="btn btn-ghost" data-action="delete-catch" data-catch-id="${utils.escapeHtml(record.id)}">Eliminar</button>
        </footer>
      </article>`;
  }

  function deleteCatch(catchId) {
    if (!root.confirm('¿Eliminar esta captura? No se puede deshacer.')) return;
    if (catchLog.deleteCatch(catchId)) {
      renderCatchList();
      setStatus(dom.logStatus, 'Captura eliminada.', 'ok');
    } else {
      setStatus(dom.logStatus, 'No se pudo eliminar la captura.', 'warning');
    }
  }

  function exportCatches(format) {
    const list = catchLog.loadAll();
    if (list.length === 0) {
      setStatus(dom.logStatus, 'No hay capturas para exportar.', 'warning');
      return;
    }
    const stamp = utils.toDateString(new Date());
    if (format === 'json') {
      utils.downloadText(`pescaapp-capturas-${stamp}.json`, catchLog.toJson(list), 'application/json;charset=utf-8');
    } else {
      utils.downloadText(`pescaapp-capturas-${stamp}.csv`, catchLog.toCsv(list), 'text/csv;charset=utf-8');
    }
    setStatus(dom.logStatus, `Exportación en ${format === 'json' ? 'JSON' : 'CSV'} preparada.`, 'ok');
  }

  // ---------------------------------------------------------------------------
  // Ajustes
  // ---------------------------------------------------------------------------

  function openSettings() {
    dom.settingsTidesKey.value = utils.storage.read('worldTidesKey', '') || '';
    setStatus(dom.settingsTidesStatus, '', 'info');
    applyTheme(currentTheme());
    openDialog(dom.settingsDialog);
  }

  function saveTidesKeyFromSettings(event) {
    event.preventDefault();
    const key = dom.settingsTidesKey.value.trim();
    tides.saveApiKey(key);
    setStatus(
      dom.settingsTidesStatus,
      key ? 'Clave guardada en este navegador.' : 'Clave eliminada. Las mareas dejarán de mostrarse.',
      'ok'
    );
    if (state.place) {
      refreshLiveData();
    }
  }

  function clearAllData() {
    if (!root.confirm('Se borrarán todas las capturas, la ubicación y la caché de este navegador. ¿Continuar?')) return;
    utils.storage.clearAll();
    root.location.reload();
  }

  // ---------------------------------------------------------------------------
  // Eventos e inicio
  // ---------------------------------------------------------------------------

  function bindEvents() {
    dom.themeToggle.addEventListener('click', cycleTheme);
    dom.settingsOpen.addEventListener('click', openSettings);
    dom.settingsClose.addEventListener('click', () => closeDialog(dom.settingsDialog));
    dom.settingsTheme.addEventListener('change', (event) => {
      utils.storage.write(THEME_KEY, event.target.value);
      applyTheme(event.target.value);
    });
    dom.settingsTidesForm.addEventListener('submit', saveTidesKeyFromSettings);
    dom.settingsClearData.addEventListener('click', clearAllData);

    dom.gpsButton.addEventListener('click', () => requestGps({ silent: false }));
    dom.refreshButton.addEventListener('click', () => refreshLiveData());
    dom.locationForm.addEventListener('submit', handleLocationSearch);
    dom.locationResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-result-index]');
      if (button) chooseSearchResult(Number(button.dataset.resultIndex));
    });

    dom.tidesBody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="open-settings"]');
      if (button) openSettings();
    });

    dom.speciesFilter.addEventListener('input', utils.debounce(renderSpeciesList, 120));
    dom.speciesList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-species-id]');
      if (button) openSpeciesDialog(button.dataset.speciesId);
    });
    dom.speciesDialogClose.addEventListener('click', () => closeDialog(dom.speciesDialog));

    dom.catchForm.addEventListener('input', utils.debounce(updateCatchAssessment, 150));
    dom.catchForm.addEventListener('change', updateCatchAssessment);
    dom.catchForm.addEventListener('submit', handleCatchSubmit);
    dom.catchPhoto.addEventListener('change', handlePhotoChange);

    dom.catchList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="delete-catch"]');
      if (button) deleteCatch(button.dataset.catchId);
    });
    dom.exportJson.addEventListener('click', () => exportCatches('json'));
    dom.exportCsv.addEventListener('click', () => exportCatches('csv'));
  }

  function init() {
    dom = collectElements();
    applyTheme(currentTheme());
    bindEvents();
    populateDatalists();
    renderCatchFormDefaults();
    renderCatchList();
    renderPlace();
    renderMoonCard();
    renderActivityCard();
    renderTidesCard();

    const savedPlace = locationService.loadSavedPlace();
    if (savedPlace) {
      setPlace(savedPlace, { refresh: true });
    } else {
      renderWeatherCard();
      renderSpeciesList();
      requestGps({ silent: true });
    }

    root.setInterval(() => {
      if (state.place) refreshLiveData();
    }, REFRESH_INTERVAL_MS);
    root.setInterval(() => {
      renderMoonCard();
      renderActivityCard();
      if (state.place) renderTidesCard();
      renderCatchFormDefaults();
    }, CLOCK_INTERVAL_MS);
  }

  PescaApp.app = Object.freeze({ init, computeCurrentActivity, buildTideSvg });

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else if (root.document) {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
