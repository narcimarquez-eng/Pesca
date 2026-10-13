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
  const hourlyForecast = PescaApp.forecast;

  const THEME_KEY = 'theme';
  const THEME_ORDER = ['auto', 'dark', 'light'];
  const THEME_LABELS = {
    auto: PescaApp.i18n.mark('automático'),
    dark: PescaApp.i18n.mark('oscuro'),
    light: PescaApp.i18n.mark('claro'),
  };
  /** Las capturas de hace más de una hora se consultan en el histórico. */
  const PAST_CATCH_THRESHOLD_MS = 60 * 60 * 1000;
  const MAX_WEIGHT_KG = 500;
  const MAX_LENGTH_CM = 400;
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  const CLOCK_INTERVAL_MS = 60 * 1000;
  const CHART_PAST_MS = 3 * 60 * 60 * 1000;
  const CHART_FUTURE_MS = 21 * 60 * 60 * 1000;
  const TICK_STEP_MS = 3 * 60 * 60 * 1000;
  /** A partir de esta distancia a la estación de marea se avisa de que la predicción puede desviarse. */
  const STATION_DISTANCE_WARNING_KM = 20;

  const state = {
    place: null,
    forecast: null,
    forecastError: null,
    waterSeries: null,
    ensemble: null,
    ensembleError: null,
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
      settingsLanguage: byId('settings-language'),
      settingsTideSource: byId('settings-tide-source'),
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
      forecastBody: byId('forecast-body'),
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

  /** Atajo de formato con los valores por defecto de la app. */
  function fmt(value, decimals = 0, unit = '') {
    return utils.formatNumber(value, decimals, unit);
  }

  /** Número con signo (+/−) para variaciones. */
  function formatSigned(value, decimals, unit) {
    if (!Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${utils.formatNumber(value, decimals, unit)}`;
  }

  /** Hora "HH:MM" de un instante (milisegundos), en la hora del dispositivo. */
  function formatClock(ts) {
    return new Date(ts).toLocaleTimeString(PescaApp.i18n.intlLocale(), { hour: '2-digit', minute: '2-digit' });
  }

  /** Hora "HH:MM" de un instante en la zona horaria de la estación (o la del dispositivo). */
  function formatStationClock(ts, timeZone) {
    return new Date(ts).toLocaleTimeString(PescaApp.i18n.intlLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tides.safeTimeZone(timeZone),
    });
  }

  /** Día y hora legibles en la zona horaria de la estación. */
  function formatStationDayAndClock(ts, timeZone) {
    const date = new Date(ts);
    const dayText = date.toLocaleDateString(PescaApp.i18n.intlLocale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: tides.safeTimeZone(timeZone),
    });
    return `${dayText} ${formatStationClock(ts, timeZone)}`;
  }

  /** Hora "HH:MM" de un texto "YYYY-MM-DDTHH:MM" en la hora local del lugar. */
  function formatPlaceClock(text) {
    return typeof text === 'string' && text.length >= 16 ? text.slice(11, 16) : '—';
  }

  /** Fecha y hora legibles para un texto "YYYY-MM-DDTHH:MM". */
  function formatDateTimeText(text) {
    const date = utils.parseDateTimeString(text);
    if (!date) return '—';
    return date.toLocaleString(PescaApp.i18n.intlLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Zona horaria de la estación de marea activa, o undefined si no hay estación. */
  function activeTideTimeZone() {
    return state.tides && state.tides.station ? state.tides.station.timeZone : undefined;
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
      dom.themeToggle.textContent = `🌓 ${PescaApp.i18n.t('Tema: {tema}', { tema: PescaApp.i18n.t(THEME_LABELS[safeTheme]) })}`;
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

  /**
   * Lugares guardados antes de conocer su país: se completa con la geocodificación inversa,
   * conservando el nombre que ya tenía. Sin conexión, el lugar sigue sin referencia.
   */
  async function completePlaceCountry(place) {
    try {
      const geo = await locationService.reverseGeocode(place.lat, place.lon);
      if (!geo || !geo.countryCode) return;
      const updated = locationService.buildPlace({ ...place, countryCode: geo.countryCode });
      if (state.place && state.place.lat === place.lat && state.place.lon === place.lon) setPlace(updated);
    } catch (error) {
      // Sin país no hay referencia: el lugar se queda como está.
    }
  }

  /** Establece el lugar activo, lo guarda y actualiza las tarjetas que dependen de él. */
  function setPlace(place, { refresh = false } = {}) {
    const previous = state.place;
    const placeChanged = !previous || previous.lat !== place.lat || previous.lon !== place.lon;
    if (placeChanged) {
      // Los datos del lugar anterior no deben mezclarse con los del nuevo.
      state.forecast = null;
      state.forecastError = null;
      state.waterSeries = null;
      state.ensemble = null;
      state.ensembleError = null;
      forecastOpenDays = null;
      state.tides = null;
      state.tidesError = null;
    }
    state.place = place;
    locationService.savePlace(place);
    renderPlace();
    renderSpeciesList();
    renderCatchPlace();
    updateCatchAssessment();
    applyLocale();
    if (refresh) {
      refreshLiveData();
    }
  }

  function renderPlace() {
    const place = state.place;
    if (!place) {
      dom.locationCurrent.innerHTML =
        `<p class="muted">${PescaApp.i18n.t('Aún no hay ubicación. Usa el GPS o escribe un lugar o unas coordenadas.')}</p>`;
      dom.zoneBadge.textContent = '';
      dom.zoneBadge.hidden = true;
      dom.zoneAlert.hidden = true;
      dom.refreshButton.disabled = true;
      return;
    }

    const subtitle =
      [place.locality, place.region].filter(Boolean).join(' · ') || PescaApp.i18n.t('Sin comunidad autónoma detectada');
    const sourceLabel =
      place.source === 'gps' ? PescaApp.i18n.t('GPS del dispositivo') : PescaApp.i18n.t('Introducida manualmente');
    dom.locationCurrent.innerHTML = `
      <p class="place-name">${utils.escapeHtml(place.name)}</p>
      <p class="muted">${utils.escapeHtml(subtitle)}</p>
      <p class="coords">${utils.escapeHtml(place.lat.toFixed(4))}, ${utils.escapeHtml(place.lon.toFixed(4))} · ${sourceLabel}</p>`;

    dom.zoneBadge.hidden = false;
    dom.zoneBadge.textContent = place.zoneName
      ? PescaApp.i18n.t('Zona: {zona}', { zona: place.zoneName })
      : PescaApp.i18n.t('Sin zona');
    dom.refreshButton.disabled = false;

    if (place.countryCode !== 'es') {
      dom.zoneAlert.hidden = false;
      dom.zoneAlert.className = 'alert alert-info';
      dom.zoneAlert.textContent = place.countryCode
        ? PescaApp.i18n.t('No hay referencia de especies, tallas ni vedas para este país. La marea, el tiempo y la luna sí se calculan.')
        : PescaApp.i18n.t('No sabemos en qué país está este lugar, así que no hay referencia de especies, tallas ni vedas.');
    } else if (!place.inCoverage) {
      dom.zoneAlert.hidden = false;
      dom.zoneAlert.className = 'alert alert-warning';
      dom.zoneAlert.textContent = PescaApp.i18n.t(
        'Estás a unos {distancia} de la costa más cercana del catálogo ({ancla}). Las especies pueden no ser representativas de tu zona. Pesca en agua dulce no incluida.',
        {
          distancia: utils.formatNumber(place.zoneDistanceKm, 0, 'km'),
          ancla: place.anchorName || PescaApp.i18n.t('sin referencia'),
        }
      );
    } else {
      dom.zoneAlert.hidden = true;
    }
  }

  /** Pide la posición del GPS. Si falla, muestra el motivo y deja la búsqueda manual disponible. */
  async function requestGps({ silent = false } = {}) {
    setStatus(dom.locationStatus, PescaApp.i18n.t('Obteniendo tu ubicación…'), 'info');
    try {
      const coords = await locationService.requestBrowserPosition();
      setStatus(dom.locationStatus, PescaApp.i18n.t('Identificando el lugar…'), 'info');
      const place = await locationService.placeFromCoordinates(coords.lat, coords.lon, 'gps');
      setPlace(place, { refresh: true });
      setStatus(dom.locationStatus, PescaApp.i18n.t('Ubicación detectada con el GPS.'), 'ok');
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
      setStatus(dom.locationStatus, PescaApp.i18n.t('Identificando las coordenadas…'), 'info');
      try {
        const place = await locationService.placeFromCoordinates(coords.lat, coords.lon, 'manual');
        setPlace(place, { refresh: true });
        setStatus(dom.locationStatus, PescaApp.i18n.t('Coordenadas aplicadas.'), 'ok');
        renderSearchResults([]);
      } catch (error) {
        setStatus(dom.locationStatus, utils.describeError(error), 'warning');
      }
      return;
    }

    setStatus(dom.locationStatus, PescaApp.i18n.t('Buscando el lugar…'), 'info');
    try {
      const results = await locationService.searchPlaces(query);
      state.searchResults = results;
      renderSearchResults(results);
      if (results.length === 0) {
        setStatus(
          dom.locationStatus,
          PescaApp.i18n.t('No se encontró ningún lugar. Prueba con otro nombre o con coordenadas.'),
          'warning'
        );
      } else {
        setStatus(
          dom.locationStatus,
          PescaApp.i18n.t('Elige un lugar de la lista ({total} resultados).', { total: results.length }),
          'info'
        );
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
      countryCode: item.countryCode,
      source: 'manual',
    });
    setPlace(place, { refresh: true });
    renderSearchResults([]);
    state.searchResults = [];
    setStatus(dom.locationStatus, PescaApp.i18n.t('Lugar aplicado.'), 'ok');
  }

  // ---------------------------------------------------------------------------
  // Datos en vivo: clima, mareas, índice y luna
  // ---------------------------------------------------------------------------

  async function refreshLiveData() {
    const place = state.place;
    if (!place) return;
    await Promise.allSettled([loadForecast(place), loadTides(place)]);
    renderMoonCard();
    renderActivityCard();
    renderForecastCard();
  }

  /**
   * Pronóstico central, temperatura del agua y escenarios. El agua y los escenarios son
   * opcionales: si fallan, la previsión central sigue mostrándose.
   */
  async function loadForecast(place) {
    const requestId = ++forecastRequestId;
    renderLoading(dom.weatherBody, PescaApp.i18n.t('Consultando el tiempo…'));
    state.forecastError = null;
    const scenarioRequest = weather.getEnsemble(place.lat, place.lon).then(
      (ensemble) => ({ ensemble, error: null }),
      (error) => ({ ensemble: null, error: utils.describeError(error) })
    );
    try {
      const [forecast, waterSeries, scenarios] = await Promise.all([
        weather.getForecast(place.lat, place.lon),
        weather.getWaterSeries(place.lat, place.lon),
        scenarioRequest,
      ]);
      if (requestId !== forecastRequestId) return;
      state.waterSeries = waterSeries;
      state.ensemble = scenarios.ensemble;
      state.ensembleError = scenarios.error;
      state.forecast = {
        ...forecast,
        waterTemperatureC: weather.waterValueAt(waterSeries, forecast.observedAt),
      };
    } catch (error) {
      if (requestId !== forecastRequestId) return;
      state.forecast = null;
      state.waterSeries = null;
      state.ensemble = null;
      state.ensembleError = null;
      state.forecastError = utils.describeError(error);
    }
    renderWeatherCard();
  }

  /** Mareas en vivo con la fuente elegida (predicción armónica por defecto, sin registro). */
  async function loadTides(place) {
    const requestId = ++tidesRequestId;
    state.tidesError = null;
    renderTidesCard();
    try {
      const tideData = await tides.getLiveTides(place.lat, place.lon, tides.getApiKey(), new Date(), {
        countryCode: place.countryCode,
      });
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
      dom.weatherBody.innerHTML = `<p class="muted">${PescaApp.i18n.t('Define una ubicación para ver el tiempo.')}</p>`;
      return;
    }
    if (!forecast) {
      dom.weatherBody.innerHTML = renderAlert(
        state.forecastError || PescaApp.i18n.t('No hay datos del tiempo.'),
        'warning'
      );
      return;
    }

    const condition = weather.describeWeatherCode(forecast.weatherCode);
    const knots = utils.kmhToKnots(forecast.windSpeedKmh);
    const windText = `${fmt(forecast.windSpeedKmh, 0, 'km/h')} (${fmt(knots, 1, PescaApp.i18n.t('nudos'))}) ${PescaApp.i18n.t('del {direccion}', { direccion: utils.cardinalDirection(forecast.windDirectionDeg) })}`;
    const trend = forecast.pressureTrend3hHpa;
    const trendArrow = trend === null ? '' : trend > 0 ? '▲' : trend < 0 ? '▼' : '➖';
    const pressureText = `${fmt(forecast.pressureHpa, 0, 'hPa')}${
      trend === null
        ? ''
        : ` · ${trendArrow} ${PescaApp.i18n.t('{cambio} en 3 h', { cambio: formatSigned(trend, 1, 'hPa') })}`
    }`;
    const waterText =
      forecast.waterTemperatureC === null || forecast.waterTemperatureC === undefined
        ? PescaApp.i18n.t('No disponible en esta ubicación')
        : fmt(forecast.waterTemperatureC, 1, '°C');

    const rows = [
      [
        PescaApp.i18n.t('Temperatura del aire'),
        `${fmt(forecast.airTemperatureC, 1, '°C')}`,
        PescaApp.i18n.t('sensación {valor}', { valor: fmt(forecast.apparentTemperatureC, 1, '°C') }),
      ],
      [PescaApp.i18n.t('Temperatura del agua'), waterText, PescaApp.i18n.t('modelo marino')],
      [
        PescaApp.i18n.t('Viento'),
        windText,
        PescaApp.i18n.t('ráfagas {valor}', { valor: fmt(forecast.windGustsKmh, 0, 'km/h') }),
      ],
      [PescaApp.i18n.t('Presión'), pressureText, PescaApp.i18n.t('nivel del mar')],
      [PescaApp.i18n.t('Humedad'), fmt(forecast.humidityPercent, 0, '%'), ''],
      [PescaApp.i18n.t('Nubosidad'), fmt(forecast.cloudCoverPercent, 0, '%'), ''],
      [PescaApp.i18n.t('Precipitación'), fmt(forecast.precipitationMm, 1, 'mm'), PescaApp.i18n.t('en la última hora')],
      [
        PescaApp.i18n.t('Amanecer · atardecer'),
        `${formatPlaceClock(forecast.sunrise)} · ${formatPlaceClock(forecast.sunset)}`,
        PescaApp.i18n.t('hora local'),
      ],
    ];

    dom.weatherBody.innerHTML = `
      <div class="weather-hero">
        <span class="weather-icon" aria-hidden="true">${condition.icon}</span>
        <div>
          <p class="big">${utils.escapeHtml(condition.label)}</p>
          <p class="muted">${PescaApp.i18n.t('Actualizado {hora} (hora local del lugar)', { hora: formatPlaceClock(forecast.observedAt) })}</p>
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

  function renderMoonCard() {
    const phase = moon.getMoonPhase(new Date());
    dom.moonBody.innerHTML = `
      <div class="moon-hero">
        <span class="moon-icon" aria-hidden="true">${phase.icon}</span>
        <div>
          <p class="big">${utils.escapeHtml(phase.name)}</p>
          <p class="muted">${PescaApp.i18n.t('Iluminación {iluminacion}% · {edad} días de edad', { iluminacion: phase.illuminationPercent, edad: fmt(phase.ageDays, 1) })}</p>
        </div>
      </div>
      <p>${PescaApp.i18n.t('Próxima {fase} en {dias} días ({fecha}).', {
        fase: utils.escapeHtml(phase.nextSyzygy.name.toLowerCase()),
        dias: fmt(phase.nextSyzygy.daysAway, 1),
        fecha: utils.escapeHtml(phase.nextSyzygy.date.toLocaleDateString(PescaApp.i18n.intlLocale(), { day: 'numeric', month: 'short' })),
      })}</p>
      <p class="fineprint">${PescaApp.i18n.t('El coeficiente de marea aparece en la tarjeta de mareas.')}</p>`;
  }

  /** Coeficiente de hoy: el de la predicción armónica si existe; si no, la estimación por fase lunar. */
  function currentCoefficient(now = new Date()) {
    return state.tides && Number.isFinite(state.tides.coefficient)
      ? state.tides.coefficient
      : tides.estimateCoefficient(now);
  }

  /** Valoración de pesca (1–5 estrellas) con los datos actuales de tiempo, luna y marea. */
  function computeCurrentRating(now = new Date()) {
    const phase = moon.getMoonPhase(now);
    const forecast = state.forecast;
    const tideSummary = state.tides ? tides.summarize(state.tides, now.getTime()) : null;
    return activity.computeFishingRating({
      pressureHpa: forecast ? forecast.pressureHpa : null,
      pressureTrend3hHpa: forecast ? forecast.pressureTrend3hHpa : null,
      moonDistanceToSyzygy: phase.distanceToSyzygy,
      windSpeedKmh: forecast ? forecast.windSpeedKmh : null,
      windGustsKmh: forecast ? forecast.windGustsKmh : null,
      precipitationMm: forecast ? forecast.precipitationMm : null,
      weatherCode: forecast ? forecast.weatherCode : null,
      hoursFromTideExtreme: tideSummary ? tideSummary.hoursFromExtreme : null,
      tideCoefficient: currentCoefficient(now),
    });
  }

  /** Cinco estrellas: las valoradas en color. La cifra la da la etiqueta de la tarjeta. */
  function starsHtml(stars) {
    if (!Number.isFinite(stars)) return '<span class="muted">—</span>';
    const icons = [1, 2, 3, 4, 5]
      .map((position) => `<span class="star ${position <= stars ? 'star-on' : 'star-off'}" aria-hidden="true">★</span>`)
      .join('');
    return `<span class="stars" role="img" aria-label="${PescaApp.i18n.t('{estrellas} de 5 estrellas', { estrellas: stars })}">${icons}</span>`;
  }

  /** Color de la puntuación según las estrellas: bajas, medias o altas. */
  function ratingTone(stars) {
    if (!Number.isFinite(stars)) return 'rating-none';
    if (stars >= 4) return 'rating-high';
    return stars === 3 ? 'rating-mid' : 'rating-low';
  }

  function renderActivityCard() {
    if (!state.place) {
      dom.activityBody.innerHTML = `<p class="muted">${PescaApp.i18n.t('Define una ubicación para valorar las condiciones.')}</p>`;
      return;
    }
    const rating = computeCurrentRating();
    const hourRow = state.forecast ? forecastRows(Date.now())[0] : null;
    const scenarioLine =
      hourRow && hourRow.scenarios && hourRow.scenarios.rating
        ? `<p class="muted">${PescaApp.i18n.t('En esta hora, {escenarios}.', { escenarios: scenarioStarsText(hourRow.scenarios.rating) })}</p>`
        : '';
    const scoreText = rating.score === null ? '—' : String(rating.score);
    const adjusted = rating.baseScore !== null && rating.baseScore !== rating.score;
    const scoreLine = adjusted
      ? PescaApp.i18n.t('Puntuación {puntos} de 100 (sin ajustes de seguridad: {base})', {
          puntos: scoreText,
          base: rating.baseScore,
        })
      : PescaApp.i18n.t('Puntuación {puntos} de 100', { puntos: scoreText });
    const factorsHtml = rating.factors
      .map(
        (factor) => `
        <li class="factor factor-${factor.tone}">
          <div class="factor-head">
            <span>${utils.escapeHtml(factor.label)}</span>
            <span class="muted">${factor.score}/100 · ${PescaApp.i18n.t('peso {peso}%', { peso: factor.sharePercent })}</span>
          </div>
          <div class="bar"><span style="width:${factor.score}%"></span></div>
          <p class="fineprint">${utils.escapeHtml(factor.explanation)}</p>
        </li>`
      )
      .join('');

    dom.activityBody.innerHTML = `
      <div class="score-row">
        <div class="score-badge ${ratingTone(rating.stars)}" aria-label="${PescaApp.i18n.t('Puntuación {puntos} sobre 100', { puntos: scoreText })}">${scoreText}</div>
        <div>
          ${starsHtml(rating.stars)}
          <p class="big">${utils.escapeHtml(rating.label)}</p>
          <p class="muted">${scoreLine}</p>
        </div>
      </div>
      <p>${utils.escapeHtml(rating.summary)}</p>
      ${scenarioLine}
      <ul class="factor-list">${factorsHtml}</ul>
      <p class="fineprint">${PescaApp.i18n.t('Valoración orientativa a partir de presión, luna, viento y marea. No garantiza capturas ni sustituye a los avisos oficiales.')}</p>`;
  }

  // ---------------------------------------------------------------------------
  // Previsión por horas
  // ---------------------------------------------------------------------------

  const TIDE_TRENDS = {
    rising: { arrow: '↑', text: PescaApp.i18n.mark('subiendo') },
    falling: { arrow: '↓', text: PescaApp.i18n.mark('bajando') },
    stable: { arrow: '→', text: PescaApp.i18n.mark('estable') },
  };

  /** Filas de la previsión. Se recalculan al cambiar la hora o los datos, no en cada minuto. */
  let forecastRowsMemo = null;

  /** Días de la previsión que están desplegados (null hasta la primera pintura). */
  let forecastOpenDays = null;

  function forecastRows(nowMs) {
    const hourKey = Math.floor(nowMs / utils.HOUR_MS);
    const memo = forecastRowsMemo;
    if (
      memo &&
      memo.hourKey === hourKey &&
      memo.forecast === state.forecast &&
      memo.ensemble === state.ensemble &&
      memo.waterSeries === state.waterSeries &&
      memo.tides === state.tides
    ) {
      return memo.rows;
    }
    const rows = hourlyForecast.buildForecastRows({
      forecast: state.forecast,
      ensemble: state.ensemble,
      waterSeries: state.waterSeries,
      tideState: state.tides,
      nowMs,
    });
    forecastRowsMemo = {
      hourKey,
      forecast: state.forecast,
      ensemble: state.ensemble,
      waterSeries: state.waterSeries,
      tides: state.tides,
      rows,
    };
    return rows;
  }

  /** Número con su unidad unida por un espacio que no se parte. Sin dato, "—". */
  function withUnit(value, decimals, unit) {
    return Number.isFinite(value) ? `${utils.formatNumber(value, decimals)} ${unit}` : '—';
  }

  /** Margen entre escenarios, como "12–17 °C". Vacío si no hay margen o si es un solo valor. */
  function marginText(margin, decimals, unit = '') {
    if (!margin || !Number.isFinite(margin.low) || !Number.isFinite(margin.high)) return '';
    const low = utils.formatNumber(margin.low, decimals);
    const high = utils.formatNumber(margin.high, decimals);
    if (low === high) return '';
    return `${low}–${high}${unit ? ` ${unit}` : ''}`;
  }

  /** Estrellas de los escenarios, en forma corta: "escenarios: 4–5 ★". */
  function scenarioStarsText(rating) {
    if (!rating) return '';
    if (rating.low === rating.high) return PescaApp.i18n.t('escenarios: {valor} ★', { valor: rating.low });
    return PescaApp.i18n.t('escenarios: {bajo}–{alto} ★', { bajo: rating.low, alto: rating.high });
  }

  /** Día de la previsión en castellano. "long" para cabeceras, "short" para la lista de mejores horas. */
  function formatForecastDay(dateKey, style = 'long') {
    const options =
      style === 'short'
        ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
        : { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };
    return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(PescaApp.i18n.intlLocale(), options);
  }

  /** Una fila de la tabla: el valor central y, debajo, el margen entre escenarios. */
  function forecastRowHtml(row) {
    const { scenarios } = row;
    const trend = row.pressureTrend3hHpa;
    const pressureNote = Number.isFinite(trend)
      ? `<span class="fc-note">${trend > 0 ? '▲' : trend < 0 ? '▼' : '➖'} ${PescaApp.i18n.t('{cambio} en 3 h', { cambio: formatSigned(trend, 1, 'hPa') })}</span>`
      : '';
    const tideHtml = row.tide
      ? `<strong>${withUnit(row.tide.heightM, 2, 'm')}</strong> <span aria-label="${PescaApp.i18n.t(TIDE_TRENDS[row.tide.trend].text)}">${TIDE_TRENDS[row.tide.trend].arrow}</span>`
      : '<span class="muted">—</span>';
    const approximate =
      row.coefficientSource === hourlyForecast.COEFFICIENT_SOURCE_MOON
        ? ` <span class="fc-note">${PescaApp.i18n.t('aprox.')}</span>`
        : '';
    const waterNote = Number.isFinite(row.waterTemperatureC)
      ? `<span class="fc-note">${PescaApp.i18n.t('agua {temperatura}', { temperatura: withUnit(row.waterTemperatureC, 1, '°C') })}</span>`
      : '';
    const tempMargin = scenarios ? marginText(scenarios.temperatureC, 1, '°C') : '';
    const windMargin = scenarios ? marginText(scenarios.windSpeedKmh, 0, 'km/h') : '';
    const gustMargin = scenarios ? marginText(scenarios.windGustsKmh, 0) : '';
    const rainNote =
      scenarios && scenarios.rainChancePercent !== null
        ? `<span class="fc-note">${PescaApp.i18n.t('{porcentaje} % de escenarios', { porcentaje: scenarios.rainChancePercent })}</span>`
        : '';
    const ratingNote = scenarios ? scenarioStarsText(scenarios.rating) : '';
    const direction = Number.isFinite(row.windDirectionDeg) ? utils.cardinalDirection(row.windDirectionDeg) : '—';
    const score = row.rating.score === null ? '—' : row.rating.score;

    return `
      <tr${row.isCurrent ? ' class="is-now"' : ''}>
        <th scope="row">${row.hourText}${row.isCurrent ? ` <span class="fc-note">${PescaApp.i18n.t('ahora')}</span>` : ''}</th>
        <td><span aria-hidden="true">${row.weather.icon}</span> ${utils.escapeHtml(row.weather.label)}</td>
        <td>${withUnit(row.airTemperatureC, 1, '°C')}${tempMargin ? `<span class="fc-note">${tempMargin}</span>` : ''}${waterNote}</td>
        <td>${withUnit(row.windSpeedKmh, 0, 'km/h')}<span class="fc-note">${windMargin ? `${windMargin} · ` : ''}${direction}</span><span class="fc-note">${PescaApp.i18n.t('ráfagas {rafagas}', { rafagas: withUnit(row.windGustsKmh, 0, 'km/h') })}${gustMargin ? ` (${gustMargin})` : ''}</span></td>
        <td>${withUnit(row.pressureHpa, 0, 'hPa')}${pressureNote}</td>
        <td>${withUnit(row.precipitationMm, 1, 'mm')}${rainNote}</td>
        <td>${tideHtml}<br>${coefficientChip(row.coefficient)}${approximate}</td>
        <td>${starsHtml(row.rating.stars)}<span class="fc-note">${score}/100 · ${utils.escapeHtml(row.rating.label)}</span>${ratingNote ? `<span class="fc-note">${ratingNote}</span>` : ''}</td>
      </tr>`;
  }

  /** Lista de las mejores horas de la previsión, o un aviso si ninguna llega a 3 estrellas. */
  function bestMomentsHtml(best) {
    if (!best.length) {
      return `<p class="muted">${PescaApp.i18n.t('Ninguna hora de las próximas {horas} h llega a {estrellas} estrellas.', { horas: hourlyForecast.DEFAULT_HOURS, estrellas: hourlyForecast.BEST_MOMENTS_MIN_STARS })}</p>`;
    }
    const items = best
      .map((row) => {
        const ratingNote = row.scenarios ? scenarioStarsText(row.scenarios.rating) : '';
        return `
          <li>
            <strong>${formatForecastDay(row.dateKey, 'short')} · ${row.hourText}</strong>
            ${starsHtml(row.rating.stars)} <span class="muted">${row.rating.score}/100 · ${utils.escapeHtml(row.rating.label)}${ratingNote ? ` · ${ratingNote}` : ''}</span>
          </li>`;
      })
      .join('');
    return `
      <div class="best-moments">
        <p><strong>${PescaApp.i18n.t('Mejores momentos')}</strong> <span class="muted">· ${PescaApp.i18n.t('las {cantidad} horas con mejor valoración, separadas al menos {horas} h', { cantidad: hourlyForecast.BEST_MOMENTS_COUNT, horas: hourlyForecast.BEST_MOMENTS_GAP_HOURS })}</span></p>
        <ul>${items}</ul>
      </div>`;
  }

  /** Un día de la previsión, desplegable: su mejor hora y su tabla de horas. */
  function forecastDayHtml(day, open) {
    const best = day.rows.reduce(
      (top, row) =>
        row.rating.score !== null && (top === null || row.rating.score > top.rating.score) ? row : top,
      null
    );
    const bestText = best
      ? PescaApp.i18n.t('mejor hora {hora}, {estrellas} ★', { hora: best.hourText, estrellas: best.rating.stars })
      : PescaApp.i18n.t('sin valoración');
    return `
      <details class="forecast-day" data-day="${day.dateKey}"${open ? ' open' : ''}>
        <summary>${utils.escapeHtml(formatForecastDay(day.dateKey))} <span class="muted">· ${bestText}</span></summary>
        <div class="table-wrap">
          <table class="forecast-table">
            <thead>
              <tr>
                <th scope="col">${PescaApp.i18n.t('Hora')}</th>
                <th scope="col">${PescaApp.i18n.t('Tiempo')}</th>
                <th scope="col">${PescaApp.i18n.t('Temp.')}</th>
                <th scope="col">${PescaApp.i18n.t('Viento')}</th>
                <th scope="col">${PescaApp.i18n.t('Presión')}</th>
                <th scope="col">${PescaApp.i18n.t('Lluvia')}</th>
                <th scope="col">${PescaApp.i18n.t('Marea')}</th>
                <th scope="col">${PescaApp.i18n.t('Pesca')}</th>
              </tr>
            </thead>
            <tbody>${day.rows.map((row) => forecastRowHtml(row)).join('')}</tbody>
          </table>
        </div>
      </details>`;
  }

  /** Tarjeta de previsión: una fila por hora durante 72 horas, agrupada en días desplegables. */
  function renderForecastCard() {
    if (!state.place) {
      dom.forecastBody.innerHTML = `<p class="muted">${PescaApp.i18n.t('Define una ubicación para ver la previsión por horas.')}</p>`;
      return;
    }
    if (!state.forecast) {
      if (state.forecastError) {
        dom.forecastBody.innerHTML = renderAlert(state.forecastError, 'warning');
      } else {
        renderLoading(dom.forecastBody, PescaApp.i18n.t('Consultando la previsión…'));
      }
      return;
    }

    const rows = forecastRows(Date.now());
    if (!rows.length) {
      dom.forecastBody.innerHTML = renderAlert(PescaApp.i18n.t('La previsión no incluye la hora actual.'), 'info');
      return;
    }

    const days = [];
    rows.forEach((row) => {
      const last = days[days.length - 1];
      if (last && last.dateKey === row.dateKey) last.rows.push(row);
      else days.push({ dateKey: row.dateKey, rows: [row] });
    });
    // Primera pintura: en pantallas anchas se abren todos los días; en el móvil, solo el primero.
    if (forecastOpenDays === null) {
      const wide = root.matchMedia ? root.matchMedia('(min-width: 900px)').matches : false;
      forecastOpenDays = new Set(wide ? days.map((day) => day.dateKey) : [days[0].dateKey]);
    }

    const tideNote = !state.tides
      ? PescaApp.i18n.t('Sin datos de marea: la valoración usa tiempo y luna.')
      : state.tides.method === tides.SOURCE_HARMONIC
        ? PescaApp.i18n.t('Marea: predicción armónica de la estación.')
        : PescaApp.i18n.t('Marea: alturas de WorldTides, solo para las próximas 33 h.');
    const scenarioNote = state.ensemble
      ? PescaApp.i18n.t(
          'Margen: entre el percentil 10 y el 90 de los {miembros} escenarios del modelo ECMWF IFS (cada escenario es un miembro del conjunto), siempre con el valor central incluido.',
          { miembros: state.ensemble.members.length }
        )
      : state.ensembleError
        ? PescaApp.i18n.t('Sin escenarios ({error}): solo se muestra la previsión central.', {
            error: utils.escapeHtml(state.ensembleError),
          })
        : PescaApp.i18n.t('Sin escenarios: solo se muestra la previsión central.');

    dom.forecastBody.innerHTML = `
      ${bestMomentsHtml(hourlyForecast.pickBestMoments(rows))}
      ${days.map((day) => forecastDayHtml(day, forecastOpenDays.has(day.dateKey))).join('')}
      <p class="fineprint">${PescaApp.i18n.t(
        'Valor central: previsión de Open-Meteo, una fila por hora, en la hora local del lugar. {escenarios} «% de escenarios» es la parte de escenarios con al menos 0,1 mm de lluvia en esa hora. {marea} La valoración es orientativa: las horas con tormenta, lluvia intensa o viento fuerte se limitan por seguridad. Consulta los avisos oficiales antes de salir.',
        { escenarios: scenarioNote, marea: utils.escapeHtml(tideNote) }
      )}</p>`;
  }

  /** Estilo del coeficiente según su valor: vivas, media o muertas. */
  function coefficientChip(value) {
    if (!Number.isFinite(value)) return '<span class="muted">—</span>';
    const level = value >= 95 ? 'vivas' : value <= 45 ? 'muertas' : 'media';
    return `<span class="coef coef-${level}">${value}</span>`;
  }

  /** Tabla de los próximos días: coeficiente, pleamares y bajamares en la hora de la estación. */
  function renderDailyTable(daily, timeZone) {
    if (!daily || !daily.days.length) return '';
    const rows = daily.days
      .map((day) => {
        const dayLabel = new Date(`${day.dateKey}T12:00:00Z`).toLocaleDateString(PescaApp.i18n.intlLocale(), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        });
        const listFor = (type) => {
          const items = day.extremes
            .filter((extreme) => extreme.type === type)
            .map((extreme) => `${formatStationClock(extreme.ts, timeZone)} · ${fmt(extreme.height, 2)}\u00a0m`);
          return items.length ? items.map((item) => utils.escapeHtml(item)).join('<br>') : '—';
        };
        return `
        <tr>
          <td>${utils.escapeHtml(dayLabel)}</td>
          <td>${coefficientChip(day.coefficient)}</td>
          <td>${listFor('high')}</td>
          <td>${listFor('low')}</td>
        </tr>`;
      })
      .join('');
    return `
      <details class="daily-table" open>
        <summary>${PescaApp.i18n.t('Tabla de mareas: próximos {dias} días', { dias: daily.days.length })}</summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${PescaApp.i18n.t('Día')}</th><th>${PescaApp.i18n.t('Coef.')}</th><th>${PescaApp.i18n.t('Pleamares')}</th><th>${PescaApp.i18n.t('Bajamares')}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </details>`;
  }

  /** Tarjeta de mareas: estación usada, resumen, coeficiente, gráfica y tabla diaria. */
  function renderTidesCard() {
    if (!state.place) {
      dom.tidesBody.innerHTML = `<p class="muted">${PescaApp.i18n.t('Define una ubicación para ver las mareas.')}</p>`;
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const hasHarmonicCoefficient = state.tides && Number.isFinite(state.tides.coefficient);
    const coefficientNow = currentCoefficient(now);
    const coefficientHtml = `
      <div class="coefficient">
        <span class="muted">${hasHarmonicCoefficient ? PescaApp.i18n.t('Coeficiente de hoy') : PescaApp.i18n.t('Coeficiente aprox. (fase lunar)')}</span>
        <strong>${coefficientNow}</strong>
        <span>${utils.escapeHtml(tides.describeCoefficient(coefficientNow))}</span>
      </div>`;

    if (state.tidesError) {
      const needsKey = tides.getSource() === tides.SOURCE_WORLDTIDES && !tides.getApiKey();
      dom.tidesBody.innerHTML = `${renderAlert(state.tidesError, 'warning')}${
        needsKey
          ? `<button type="button" class="btn btn-primary" data-action="open-settings">${PescaApp.i18n.t('Configurar clave')}</button>`
          : ''
      }${coefficientHtml}`;
      return;
    }

    if (!state.tides) {
      dom.tidesBody.innerHTML = `<p class="muted loading">${PescaApp.i18n.t('Calculando mareas…')}</p>${coefficientHtml}`;
      return;
    }

    const zone = activeTideTimeZone();
    const summary = tides.summarize(state.tides, nowMs);
    const station = state.tides.station;
    const chartStart = nowMs - CHART_PAST_MS;
    const chartEnd = nowMs + CHART_FUTURE_MS;
    const geometry = tides.buildChartGeometry(state.tides, {
      startMs: chartStart,
      endMs: chartEnd,
      nowMs,
    });

    const currentText = summary && summary.currentHeightM !== null ? fmt(summary.currentHeightM, 2, 'm') : '—';
    const nextHighText =
      summary && summary.nextHigh ? formatStationDayAndClock(summary.nextHigh.ts, zone) : PescaApp.i18n.t('Sin dato');
    const nextLowText =
      summary && summary.nextLow ? formatStationDayAndClock(summary.nextLow.ts, zone) : PescaApp.i18n.t('Sin dato');

    const stationHtml = station
      ? `<div class="station-line">
          <p><strong>${station.isModel ? PescaApp.i18n.t('Modelo:') : PescaApp.i18n.t('Estación:')}</strong> ${utils.escapeHtml(station.name)} (${fmt(station.distanceKm, 1, 'km')}) · ${utils.escapeHtml(station.source)} · ${utils.escapeHtml(station.licenseLabel)}</p>
          <p class="fineprint">${utils.escapeHtml(station.referenceLabel)}.${
            station.sourceUrl
              ? ` <a href="${utils.escapeHtml(station.sourceUrl)}" target="_blank" rel="noopener">${PescaApp.i18n.t('Ver la fuente')}</a>`
              : ''
          }</p>
        </div>`
      : '';
    const modelSettings = PescaApp.config.tides;
    const accuracyWarning = station && station.isModel
      ? renderAlert(
          PescaApp.i18n.t(
            'Predicción del modelo global de mareas EOT20, no de un mareógrafo: en costa abierta suele desviarse unos {cm} cm y {min} minutos; en rías, estuarios y bahías, bastante más.',
            { cm: modelSettings.modelTypicalErrorCm, min: modelSettings.modelTypicalErrorMin }
          ),
          'warning'
        )
      : station && station.distanceKm > STATION_DISTANCE_WARNING_KM
        ? renderAlert(
            PescaApp.i18n.t(
              'La estación está a {distancia}. En la costa abierta, estuarios o calas la hora y la altura pueden desviarse.',
              { distancia: fmt(station.distanceKm, 1, 'km') }
            ),
            'warning'
          )
        : '';
    const isHarmonic = state.tides.method === tides.SOURCE_HARMONIC;
    const sourceNote = isHarmonic
      ? PescaApp.i18n.t(
          'Predicción armónica: no incluye viento, presión ni oleaje, y no sustituye a las tablas oficiales. No la uses para navegar.'
        )
      : PescaApp.i18n.t(
          'Fuente de alturas: WorldTides. Consulta las tablas oficiales para navegar o pescar en zonas peligrosas.'
        );
    const coefficientNote = hasHarmonicCoefficient
      ? PescaApp.i18n.t(
          'Coeficiente: amplitud del día frente a la media del año de la estación (70 = marea media). Es una estimación y puede diferir del oficial.'
        )
      : PescaApp.i18n.t('El coeficiente es una estimación por fase lunar, no el oficial.');

    dom.tidesBody.innerHTML = `
      ${stationHtml}
      ${accuracyWarning}
      <div class="tide-summary">
        <div class="tide-stat"><span class="muted">${PescaApp.i18n.t('Altura ahora')}</span><strong>${currentText}</strong></div>
        <div class="tide-stat"><span class="muted">${PescaApp.i18n.t('Próxima pleamar')}</span><strong>${utils.escapeHtml(nextHighText)}</strong></div>
        <div class="tide-stat"><span class="muted">${PescaApp.i18n.t('Próxima bajamar')}</span><strong>${utils.escapeHtml(nextLowText)}</strong></div>
        ${coefficientHtml}
      </div>
      ${geometry ? buildTideSvg(geometry, chartStart, chartEnd, zone) : renderAlert(PescaApp.i18n.t('No hay datos de altura para representar la gráfica.'), 'info')}
      ${renderDailyTable(state.tides.daily, zone)}
      <p class="fineprint">${utils.escapeHtml(sourceNote)} ${utils.escapeHtml(coefficientNote)}</p>`;
  }

  /** SVG de la gráfica de mareas. Las horas se muestran en la zona de la estación. */
  function buildTideSvg(geometry, startMs, endMs, timeZone) {
    const { width, height, padding, points, extremes, nowX, yMin, yMax } = geometry;
    const xOf = (ts) => padding + ((ts - startMs) / (endMs - startMs)) * (width - 2 * padding);
    const baseY = height - padding;
    const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `${padding},${baseY} ${line} ${width - padding},${baseY}`;

    const markers = extremes
      .map((extreme) => {
        const labelY = extreme.type === 'high' ? extreme.y - 10 : extreme.y + 16;
        return `<circle cx="${extreme.x.toFixed(1)}" cy="${extreme.y.toFixed(1)}" r="4" class="${extreme.type === 'high' ? 'marker-high' : 'marker-low'}"/>
          <text x="${extreme.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="chart-label">${utils.escapeHtml(formatStationClock(extreme.ts, timeZone))}</text>`;
      })
      .join('');

    const ticks = [];
    const firstTick = Math.ceil(startMs / (60 * 60 * 1000)) * (60 * 60 * 1000);
    for (let ts = firstTick; ts <= endMs; ts += TICK_STEP_MS) {
      ticks.push(
        `<text x="${xOf(ts).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${utils.escapeHtml(formatStationClock(ts, timeZone))}</text>`
      );
    }

    const nowLine =
      nowX === null
        ? ''
        : `<line x1="${nowX.toFixed(1)}" x2="${nowX.toFixed(1)}" y1="${padding}" y2="${baseY}" class="now-line"/>`;

    return `
      <figure class="tide-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${PescaApp.i18n.t('Alturas de marea de las próximas 24 horas')}">
          <polygon points="${area}" class="tide-area"/>
          <polyline points="${line}" class="tide-line"/>
          ${nowLine}
          ${markers}
          ${ticks.join('')}
          <text x="4" y="${padding + 4}" class="chart-axis">${utils.escapeHtml(fmt(yMax, 1, 'm'))}</text>
          <text x="4" y="${baseY}" class="chart-axis">${utils.escapeHtml(fmt(yMin, 1, 'm'))}</text>
        </svg>
        <figcaption class="fineprint">${PescaApp.i18n.t('Línea continua: altura prevista. Línea vertical: ahora. Horas en la zona de la estación.')}</figcaption>
      </figure>`;
  }

  // ---------------------------------------------------------------------------
  // Especies
  // ---------------------------------------------------------------------------

  function renderSpeciesList() {
    const place = state.place;
    if (!place || !place.zoneId) {
      const message = place
        ? PescaApp.i18n.t('No hay catálogo de especies para este lugar. Las tallas y vedas solo se comprueban en España.')
        : PescaApp.i18n.t('Define una ubicación para ver las especies de la zona.');
      dom.speciesList.innerHTML = `<li class="muted">${message}</li>`;
      dom.speciesCount.textContent = '';
      return;
    }

    const filter = dom.speciesFilter.value.trim();
    const list = filter
      ? speciesCatalog.searchSpecies(filter, { zoneId: place.zoneId, limit: 100 })
      : speciesCatalog.getSpeciesForZone(place.zoneId);

    dom.speciesCount.textContent = PescaApp.i18n.t('{total} especies en {zona}', {
      total: list.length,
      zona: place.zoneName,
    });
    if (list.length === 0) {
      dom.speciesList.innerHTML = `<li class="muted">${PescaApp.i18n.t('Ninguna especie coincide con la búsqueda.')}</li>`;
      return;
    }

    dom.speciesList.innerHTML = list.map((species) => speciesItemHtml(species, place.zoneId)).join('');
  }

  function speciesItemHtml(species, zoneId) {
    const minSizeCm = validation.getMinSizeCm(species, zoneId);
    const chips = [];
    chips.push(
      minSizeCm === null
        ? `<span class="chip chip-muted">${PescaApp.i18n.t('Talla: sin dato confirmado')}</span>`
        : `<span class="chip">${PescaApp.i18n.t('Talla mín. {talla} cm', { talla: minSizeCm })}</span>`
    );
    if (species.protected) chips.push(`<span class="chip chip-danger">${PescaApp.i18n.t('Protegida')}</span>`);
    if (species.peakMonths && species.peakMonths.length) {
      chips.push(
        `<span class="chip">${PescaApp.i18n.t('Pico: {meses}', { meses: utils.escapeHtml(speciesCatalog.formatMonths(species.peakMonths)) })}</span>`
      );
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
          minSizeCm === null
            ? PescaApp.i18n.t('Sin dato confirmado')
            : PescaApp.i18n.t('{talla} cm', { talla: minSizeCm })
        }</td></tr>`;
      })
      .join('');
    const closedHtml =
      species.closedSeasons && species.closedSeasons.length
        ? species.closedSeasons
            .map((season) => `<li>${utils.escapeHtml(season.reason || PescaApp.i18n.t('Veda'))}: ${utils.escapeHtml(speciesCatalog.formatMonths(season.months))}</li>`)
            .join('')
        : `<li class="muted">${PescaApp.i18n.t('No hay vedas registradas en esta base de datos. Consulta la normativa vigente.')}</li>`;
    const listItems = (items) => items.map((item) => `<li>${utils.escapeHtml(item)}</li>`).join('');

    dom.speciesDialogBody.innerHTML = `
      <h2>${utils.escapeHtml(species.commonName)}</h2>
      <p class="species-sci">${utils.escapeHtml(species.scientificName)} · ${utils.escapeHtml(species.family)}</p>
      ${species.protected ? renderAlert(species.protectionNote || PescaApp.i18n.t('Especie protegida: no debe retenerse.'), 'danger') : ''}
      ${species.alertNote ? renderAlert(species.alertNote, 'warning') : ''}
      <dl class="data-list">
        <div class="data-row"><dt>${PescaApp.i18n.t('Hábitat')}</dt><dd>${utils.escapeHtml(species.habitat)}</dd></div>
        <div class="data-row"><dt>${PescaApp.i18n.t('Profundidad')}</dt><dd>${fmt(species.depthRangeM[0])}–${fmt(species.depthRangeM[1], 0, 'm')}</dd></div>
        <div class="data-row"><dt>${PescaApp.i18n.t('Peso medio y máximo')}</dt><dd>${fmt(species.averageWeightKg, 1, 'kg')} · ${fmt(species.maxWeightKg, 0, 'kg')} ${PescaApp.i18n.t('(orientativo)')}</dd></div>
        <div class="data-row"><dt>${PescaApp.i18n.t('Longitud máxima')}</dt><dd>${fmt(species.maxLengthCm, 0, 'cm')} ${PescaApp.i18n.t('(orientativo)')}</dd></div>
        <div class="data-row"><dt>${PescaApp.i18n.t('Periodo de mayor actividad')}</dt><dd>${utils.escapeHtml(speciesCatalog.formatMonths(species.peakMonths))}. ${utils.escapeHtml(species.peakNote || '')}</dd></div>
      </dl>
      <h3>${PescaApp.i18n.t('Tallas mínimas de referencia')}</h3>
      <div class="table-wrap"><table><thead><tr><th>${PescaApp.i18n.t('Zona')}</th><th>${PescaApp.i18n.t('Talla')}</th></tr></thead><tbody>${sizeRows}</tbody></table></div>
      <p class="fineprint">${utils.escapeHtml(species.minSizeNote || '')}</p>
      <h3>${PescaApp.i18n.t('Cebos recomendados')}</h3>
      <ul>${listItems(species.baits || [])}</ul>
      <h3>${PescaApp.i18n.t('Técnicas')}</h3>
      <ul>${listItems(species.techniques || [])}</ul>
      <h3>${PescaApp.i18n.t('Vedas y restricciones')}</h3>
      <ul>${closedHtml}</ul>
      <p>${utils.escapeHtml(species.restrictions || '')}</p>
      <h3>${PescaApp.i18n.t('Fuentes')}</h3>
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
      dom.catchPlace.textContent = PescaApp.i18n.t('Define primero una ubicación en la sección de arriba.');
      return;
    }
    dom.catchPlace.textContent = state.place.zoneName
      ? PescaApp.i18n.t('Lugar de la captura: {lugar} ({zona})', { lugar: state.place.name, zona: state.place.zoneName })
      : PescaApp.i18n.t('Lugar de la captura: {lugar}', { lugar: state.place.name });
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
      errors.push(PescaApp.i18n.t('Indica la fecha y la hora de la captura.'));
    } else if (dateTime.getTime() > Date.now() + 60 * 1000) {
      errors.push(PescaApp.i18n.t('La fecha de la captura no puede ser futura.'));
    }
    if (!values.speciesText) {
      errors.push(PescaApp.i18n.t('Indica la especie.'));
    }
    const weightKg = utils.toFiniteNumber(values.weightText);
    if (values.weightText.trim() && (weightKg === null || weightKg <= 0 || weightKg > MAX_WEIGHT_KG)) {
      errors.push(PescaApp.i18n.t('El peso debe estar entre 0 y {max} kg.', { max: MAX_WEIGHT_KG }));
    }
    const lengthCm = utils.toFiniteNumber(values.lengthText);
    if (values.lengthText.trim() && (lengthCm === null || lengthCm <= 0 || lengthCm > MAX_LENGTH_CM)) {
      errors.push(PescaApp.i18n.t('La longitud debe estar entre 0 y {max} cm.', { max: MAX_LENGTH_CM }));
    }
    return errors;
  }

  /** Alertas en vivo y peso estimado mientras se rellena el formulario. */
  function updateCatchAssessment() {
    const values = readCatchForm();
    if (!values.speciesText) {
      dom.catchAssessment.innerHTML =
        `<ul class="alert-list"><li class="alert-item alert-info">${PescaApp.i18n.t('Escribe la especie para comprobar la talla mínima y las vedas.')}</li></ul>`;
      return;
    }
    const species = speciesCatalog.findSpeciesByName(values.speciesText);
    const lengthCm = utils.toFiniteNumber(values.lengthText);
    const weightKg = utils.toFiniteNumber(values.weightText);
    const dateTime = utils.parseDateTimeString(values.dateTimeText) || new Date();
    const zoneId = state.place ? state.place.zoneId : null;

    // Fuera de España no hay tallas ni vedas de referencia: no se aplican reglas de otro lugar.
    const assessment = zoneId
      ? validation.evaluateCatch({ species, zoneId, lengthCm, dateTime })
      : validation.evaluateWithoutReference();
    const alertsHtml = assessment.alerts
      .map((alert) => `<li class="alert-item alert-${alert.level}">${utils.escapeHtml(alert.message)}</li>`)
      .join('');

    let estimateHtml = '';
    if (species && lengthCm !== null && weightKg === null) {
      const estimate = validation.estimateWeightKg(lengthCm, species);
      const relation = validation.getLengthWeightRelation(species);
      estimateHtml = `<p class="estimate">${PescaApp.i18n.t('Peso estimado:')} <strong>${fmt(estimate, 2, 'kg')}</strong>
        <span class="fineprint">${PescaApp.i18n.t('(W = a · L^b; {fuente}. Error de ±30 % habitual.)', { fuente: utils.escapeHtml(relation.source) })}</span></p>`;
    }

    const verdict = assessment.mustRelease
      ? renderAlert(PescaApp.i18n.t('Esta captura debe devolverse según las comprobaciones.'), 'danger')
      : '';
    dom.catchAssessment.innerHTML = `${verdict}<ul class="alert-list">${alertsHtml}</ul>${estimateHtml}`;
  }

  async function handlePhotoChange() {
    const file = dom.catchPhoto.files && dom.catchPhoto.files[0];
    state.pendingPhoto = null;
    dom.catchPhotoPreview.hidden = true;
    dom.catchPhotoPreview.removeAttribute('src');
    if (!file) return;
    setStatus(dom.catchStatus, PescaApp.i18n.t('Preparando la foto…'), 'info');
    try {
      state.pendingPhoto = await catchLog.resizeImageFile(file);
      dom.catchPhotoPreview.src = state.pendingPhoto;
      dom.catchPhotoPreview.hidden = false;
      setStatus(dom.catchStatus, PescaApp.i18n.t('Foto lista. Se guardará con la captura.'), 'ok');
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

    try {
      let weatherData;
      let sourceLabel;
      let tideWindow = null;

      if (isPast) {
        weatherData = await weather.getHistoricalConditions(place.lat, place.lon, dateTimeText, now);
        sourceLabel = weatherData.source;
        tideWindow = await tides.getHistoricalTides(place.lat, place.lon, tides.getApiKey(), dateTime, {
          countryCode: place.countryCode,
        });
      } else {
        weatherData = state.forecast;
        sourceLabel = 'current';
        tideWindow = state.tides;
      }

      const moonPhase = moon.getMoonPhase(dateTime);
      const tideSnapshot = tideWindow ? tides.buildTideSnapshot(tideWindow, dateTime.getTime()) : null;
      const harmonicCoefficient = tideSnapshot ? tideSnapshot.coefficient : null;
      const coefficient = harmonicCoefficient !== null ? harmonicCoefficient : tides.estimateCoefficient(dateTime);
      const tide = {
        ...(tideSnapshot || { heightM: null, hoursFromExtreme: null, nextHigh: null, nextLow: null, station: null }),
        coefficient,
        coefficientSource:
          harmonicCoefficient !== null ? PescaApp.tides.COEFFICIENT_SOURCE.HARMONIC : PescaApp.tides.COEFFICIENT_SOURCE.MOON,
      };

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
        tide,
        activity: { score: activityResult.score, level: activityResult.level },
      };
    } catch (error) {
      return {
        source: 'unavailable',
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
      setStatus(dom.catchStatus, PescaApp.i18n.t('Define primero la ubicación de la captura.'), 'warning');
      return;
    }

    const dateTime = utils.parseDateTimeString(values.dateTimeText);
    let result;
    let photoDropped = false;
    dom.catchSubmit.disabled = true;
    try {
      setStatus(dom.catchStatus, PescaApp.i18n.t('Consultando las condiciones de ese momento…'), 'info');
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
        PescaApp.i18n.t('No hay espacio en el navegador para guardar la captura. Exporta y elimina capturas antiguas.'),
        'warning'
      );
      return;
    }

    resetCatchForm();
    renderCatchList();
    if (photoDropped) {
      setStatus(
        dom.catchStatus,
        PescaApp.i18n.t('Captura guardada, pero sin foto: no hay espacio suficiente en el navegador.'),
        'warning'
      );
    } else {
      setStatus(dom.catchStatus, PescaApp.i18n.t('Captura guardada.'), 'ok');
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
    dom.catchCount.textContent =
      list.length === 1
        ? PescaApp.i18n.t('{total} captura guardada', { total: list.length })
        : PescaApp.i18n.t('{total} capturas guardadas', { total: list.length });

    if (list.length === 0) {
      dom.catchList.innerHTML = `<p class="muted">${PescaApp.i18n.t('Todavía no hay capturas. Registra la primera en el formulario.')}</p>`;
      return;
    }
    dom.catchList.innerHTML = list.map(catchCardHtml).join('');
  }

  /** Línea de marea de una captura: altura, estación y coeficiente con su origen. */
  function catchTideLine(tide) {
    if (!tide) return PescaApp.i18n.t('Sin datos de marea');
    const parts = [];
    parts.push(
      tide.heightM !== null && tide.heightM !== undefined
        ? PescaApp.i18n.t('Marea {altura}', { altura: fmt(tide.heightM, 2, 'm') })
        : PescaApp.i18n.t('Altura no disponible')
    );
    if (tide.station) parts.push(PescaApp.i18n.t('estación {nombre}', { nombre: tide.station.name }));
    if (Number.isFinite(tide.coefficient)) {
      parts.push(
        PescaApp.i18n.t('coeficiente {coeficiente} ({origen})', {
          coeficiente: tide.coefficient,
          origen: PescaApp.tides.describeCoefficientSource(tide.coefficientSource) || PescaApp.i18n.t('estimado'),
        })
      );
    }
    return parts.join(' · ');
  }

  function catchCardHtml(record) {
    const measures = [];
    if (record.weightKg !== null) measures.push(fmt(record.weightKg, 2, 'kg'));
    if (record.estimatedWeightKg !== null) {
      measures.push(PescaApp.i18n.t('≈ {peso} (estimado)', { peso: fmt(record.estimatedWeightKg, 2, 'kg') }));
    }
    if (record.lengthCm !== null) measures.push(fmt(record.lengthCm, 0, 'cm'));
    const badge = record.assessment && record.assessment.mustRelease
      ? `<span class="chip chip-danger">${PescaApp.i18n.t('Devolver')}</span>`
      : `<span class="chip chip-ok">${PescaApp.i18n.t('Cumple lo comprobado')}</span>`;
    const issues = (record.assessment && record.assessment.alerts ? record.assessment.alerts : []).filter(
      (alert) => alert.level === 'danger' || alert.level === 'warning'
    );
    const conditions = record.conditions;
    const weatherLine = conditions && conditions.weather
      ? PescaApp.i18n.t('Aire {aire} · agua {agua} · viento {viento} · presión {presion}', {
          aire: fmt(conditions.weather.airTemperatureC, 1, '°C'),
          agua: fmt(conditions.weather.waterTemperatureC, 1, '°C'),
          viento: fmt(conditions.weather.windSpeedKmh, 0, 'km/h'),
          presion: fmt(conditions.weather.pressureHpa, 0, 'hPa'),
        })
      : PescaApp.i18n.t('Sin datos meteorológicos');

    return `
      <article class="catch-card">
        <header class="catch-head">
          <div>
            <p class="catch-title">${utils.escapeHtml(record.speciesName || PescaApp.i18n.t('Sin especificar'))}</p>
            <p class="muted">${utils.escapeHtml(formatDateTimeText(record.dateTime))} · ${utils.escapeHtml(record.place ? record.place.name : PescaApp.i18n.t('Lugar sin nombre'))}</p>
          </div>
          ${badge}
        </header>
        <p>${utils.escapeHtml(measures.join(' · ') || PescaApp.i18n.t('Sin medidas'))}</p>
        ${record.photo ? `<img class="catch-photo" src="${utils.escapeHtml(record.photo)}" alt="${PescaApp.i18n.t('Foto de la captura de {especie}', { especie: utils.escapeHtml(record.speciesName || PescaApp.i18n.t('Sin especificar')) })}">` : ''}
        ${issues.length ? `<ul class="alert-list">${issues.map((alert) => `<li class="alert-item alert-${alert.level}">${utils.escapeHtml(alert.message)}</li>`).join('')}</ul>` : ''}
        <details>
          <summary>${PescaApp.i18n.t('Condiciones del momento')}</summary>
          <p class="fineprint">${utils.escapeHtml(PescaApp.weather.describeConditionsSource(conditions ? conditions.source : null) || PescaApp.i18n.t('Sin origen'))}</p>
          <p>${utils.escapeHtml(weatherLine)}</p>
          <p>${utils.escapeHtml(catchTideLine(conditions ? conditions.tide : null))}${conditions && conditions.moon ? ` · ${PescaApp.i18n.t('Luna: {fase}', { fase: utils.escapeHtml(conditions.moon.name) })}` : ''}</p>
          ${conditions && conditions.activity && conditions.activity.score !== null ? `<p>${PescaApp.i18n.t('Índice de actividad: {puntos}/100 ({nivel})', { puntos: conditions.activity.score, nivel: utils.escapeHtml(conditions.activity.level) })}</p>` : ''}
          ${conditions && conditions.error ? renderAlert(conditions.error, 'warning') : ''}
        </details>
        ${record.bait || record.technique || record.notes ? `<p class="fineprint">${utils.escapeHtml([record.bait && PescaApp.i18n.t('Cebo: {valor}', { valor: record.bait }), record.technique && PescaApp.i18n.t('Técnica: {valor}', { valor: record.technique }), record.notes && PescaApp.i18n.t('Notas: {valor}', { valor: record.notes })].filter(Boolean).join(' · '))}</p>` : ''}
        <footer class="catch-foot">
          <button type="button" class="btn btn-ghost" data-action="delete-catch" data-catch-id="${utils.escapeHtml(record.id)}">${PescaApp.i18n.t('Eliminar')}</button>
        </footer>
      </article>`;
  }

  function deleteCatch(catchId) {
    if (!root.confirm(PescaApp.i18n.t('¿Eliminar esta captura? No se puede deshacer.'))) return;
    if (catchLog.deleteCatch(catchId)) {
      renderCatchList();
      setStatus(dom.logStatus, PescaApp.i18n.t('Captura eliminada.'), 'ok');
    } else {
      setStatus(dom.logStatus, PescaApp.i18n.t('No se pudo eliminar la captura.'), 'warning');
    }
  }

  function exportCatches(format) {
    const list = catchLog.loadAll();
    if (list.length === 0) {
      setStatus(dom.logStatus, PescaApp.i18n.t('No hay capturas para exportar.'), 'warning');
      return;
    }
    const stamp = utils.toDateString(new Date());
    if (format === 'json') {
      utils.downloadText(`pescaapp-capturas-${stamp}.json`, catchLog.toJson(list), 'application/json;charset=utf-8');
    } else {
      utils.downloadText(`pescaapp-capturas-${stamp}.csv`, catchLog.toCsv(list), 'text/csv;charset=utf-8');
    }
    setStatus(
      dom.logStatus,
      PescaApp.i18n.t('Exportación en {formato} preparada.', { formato: format === 'json' ? 'JSON' : 'CSV' }),
      'ok'
    );
  }

  // ---------------------------------------------------------------------------
  // Ajustes
  // ---------------------------------------------------------------------------

  function openSettings() {
    dom.settingsTideSource.value = tides.getSource();
    dom.settingsTidesKey.value = utils.storage.read('worldTidesKey', '') || '';
    setStatus(dom.settingsTidesStatus, '', 'info');
    applyTheme(currentTheme());
    openDialog(dom.settingsDialog);
  }

  function saveTideSourceFromSettings(event) {
    tides.saveSource(event.target.value);
    if (state.place) {
      refreshLiveData();
    }
  }

  function saveTidesKeyFromSettings(event) {
    event.preventDefault();
    const key = dom.settingsTidesKey.value.trim();
    tides.saveApiKey(key);
    setStatus(
      dom.settingsTidesStatus,
      key ? PescaApp.i18n.t('Clave guardada en este navegador.') : PescaApp.i18n.t('Clave eliminada.'),
      'ok'
    );
    if (state.place) {
      refreshLiveData();
    }
  }

  function clearAllData() {
    if (!root.confirm(PescaApp.i18n.t('Se borrarán todas las capturas, la ubicación y la caché de este navegador. ¿Continuar?'))) return;
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
    dom.settingsLanguage.addEventListener('change', () => {
      utils.storage.write(LOCALE_KEY, dom.settingsLanguage.value);
      applyLocale();
    });
    dom.settingsTheme.addEventListener('change', (event) => {
      utils.storage.write(THEME_KEY, event.target.value);
      applyTheme(event.target.value);
    });
    dom.settingsTideSource.addEventListener('change', saveTideSourceFromSettings);
    dom.settingsTidesForm.addEventListener('submit', saveTidesKeyFromSettings);
    dom.settingsClearData.addEventListener('click', clearAllData);

    dom.gpsButton.addEventListener('click', () => requestGps({ silent: false }));
    dom.refreshButton.addEventListener('click', () => refreshLiveData());
    // 'toggle' no burbujea; la captura lo recibe desde el contenedor de la tarjeta.
    dom.forecastBody.addEventListener(
      'toggle',
      (event) => {
        const day = event.target;
        if (!forecastOpenDays || !day.classList || !day.classList.contains('forecast-day')) return;
        if (day.open) forecastOpenDays.add(day.dataset.day);
        else forecastOpenDays.delete(day.dataset.day);
      },
      true
    );
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

  /** Preferencia de idioma guardada: 'auto' (según el lugar y el navegador) o un código de idioma. */
  const LOCALE_KEY = 'locale';

  /** Opciones del selector de idioma de Ajustes: automático y los idiomas de la aplicación. */
  function renderLanguageOptions() {
    if (!dom.settingsLanguage) return;
    const options = [
      { code: 'auto', name: PescaApp.i18n.t('Automático (según el lugar)') },
      ...PescaApp.i18n.localeOptions(),
    ];
    dom.settingsLanguage.innerHTML = options
      .map((option) => `<option value="${option.code}">${utils.escapeHtml(option.name)}</option>`)
      .join('');
    dom.settingsLanguage.value = utils.storage.read(LOCALE_KEY, 'auto');
  }

  /** Vuelve a pintar todos los textos. Se llama al cambiar de idioma. */
  function renderAll() {
    applyTheme(currentTheme());
    renderLanguageOptions();
    renderPlace();
    renderWeatherCard();
    renderMoonCard();
    renderActivityCard();
    renderTidesCard();
    renderForecastCard();
    renderSpeciesList();
    renderCatchPlace();
    renderCatchFormDefaults();
    renderCatchList();
    updateCatchAssessment();
    renderSearchResults(state.searchResults);
  }

  let localeRequestId = 0;

  /**
   * Activa el idioma que corresponde: el elegido en Ajustes o, si es automático, el del país
   * del lugar, el del navegador o inglés. Después vuelve a pintar los textos.
   */
  async function applyLocale() {
    const requestId = ++localeRequestId;
    const countryCode = state.place ? state.place.countryCode : null;
    const browserLanguages =
      navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    const code = PescaApp.i18n.resolveLocale({
      preferred: utils.storage.read(LOCALE_KEY, 'auto'),
      countryCode,
      browserLanguages,
    });
    await PescaApp.i18n.setLocale(code, { countryCode });
    if (requestId === localeRequestId) renderAll();
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
    renderForecastCard();
    renderLanguageOptions();
    applyLocale();

    const savedPlace = locationService.loadSavedPlace();
    if (savedPlace) {
      setPlace(savedPlace, { refresh: true });
      if (savedPlace.countryCode === undefined) completePlaceCountry(savedPlace);
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
      if (state.place) renderForecastCard();
      renderCatchFormDefaults();
    }, CLOCK_INTERVAL_MS);
  }

  PescaApp.app = Object.freeze({ init, computeCurrentRating, buildTideSvg });

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else if (root.document) {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
