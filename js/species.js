/**
 * Acceso al catálogo de especies: zonas de España (con tallas de referencia),
 * regiones del resto del mundo (especies comunes, sin tallas), búsquedas y
 * asignación de una ubicación a su zona o región.
 *
 * Los datos viven en js/data/species-data.js (España) y js/data/species-world.js
 * (resto del mundo). Las técnicas, cebos, hábitats, momentos del día, estilos de
 * anzuelo y avisos de las fichas son códigos: este módulo los traduce al mostrarlos.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});
  const { mark } = PescaApp.i18n;
  const t = (source, vars) => PescaApp.i18n.t(source, vars);

  /** Abreviaturas de los meses: se marcan para traducirlas al mostrarse (formatMonths). */
  const MONTH_NAMES = [
    mark('ene'), mark('feb'), mark('mar'), mark('abr'), mark('may'), mark('jun'),
    mark('jul'), mark('ago'), mark('sep'), mark('oct'), mark('nov'), mark('dic'),
  ];

  /** Vocabulario de las fichas: código → texto en castellano (se traduce al mostrarse). */
  const VOCAB = Object.freeze({
    techniques: Object.freeze({
      surfcasting: mark('Surfcasting desde playa'),
      'bottom-shore': mark('Pesca a fondo desde rocas o escolleras'),
      rockfishing: mark('Rockfishing (señuelos ligeros entre rocas)'),
      spinning: mark('Spinning (lanzado y recogida de señuelos desde orilla)'),
      topwater: mark('Señuelos de superficie (popper, stickbait)'),
      float: mark('Pesca con boya (corcheo)'),
      'harbor-light': mark('Pesca ligera en puertos y escolleras (caña corta y cebo pequeño)'),
      'boat-bottom': mark('Fondo desde embarcación (anclado o a la deriva)'),
      jigging: mark('Jigging vertical desde embarcación'),
      'light-jigging': mark('Light jigging y slow jigging'),
      trolling: mark('Curricán (costero o de altura)'),
      'live-bait': mark('Cebo vivo'),
      egi: mark('Egi o potera (cefalópodos)'),
      chambel: mark('Chambel o paternóster (varios anzuelos desde embarcación)'),
      sabiki: mark('Sabiki o plumas (pequeños pelágicos)'),
      'big-game': mark('Pesca de altura (grandes pelágicos)'),
      fly: mark('Pesca a mosca'),
    }),
    baits: Object.freeze({
      'korean-worm': mark('Gusana coreana'),
      ragworm: mark('Gusana americana, de rosca o miñoca'),
      lugworm: mark('Arenícola'),
      shrimp: mark('Gamba, quisquilla o camarón'),
      crab: mark('Cangrejo'),
      mussel: mark('Mejillón'),
      clam: mark('Almeja, navaja, berberecho o chirla'),
      limpet: mark('Lapa'),
      squid: mark('Calamar o pota'),
      sardine: mark('Sardina'),
      mackerel: mark('Caballa o jurel en tiras'),
      'cut-fish': mark('Pescado en tiras'),
      sandeel: mark('Lanzón o pez de arena'),
      'live-fish': mark('Pez vivo'),
      bread: mark('Pan o masilla'),
      chum: mark('Engodo (cebado del agua)'),
      'soft-plastic': mark('Vinilo'),
      minnow: mark('Minnow (pez artificial)'),
      'surface-lure': mark('Señuelo de superficie'),
      'metal-jig': mark('Jig metálico o cucharilla'),
      egi: mark('Potera o egi'),
      sabiki: mark('Sabiki o plumas'),
      'trolling-lure': mark('Señuelo de curricán'),
      fly: mark('Mosca'),
    }),
    habitats: Object.freeze({
      rock: mark('Fondos rocosos'),
      sand: mark('Playas y fondos de arena'),
      mud: mark('Fondos de fango'),
      seagrass: mark('Praderas marinas'),
      estuary: mark('Estuarios, rías y desembocaduras'),
      harbor: mark('Puertos y escolleras'),
      reef: mark('Arrecifes'),
      'open-water': mark('Aguas abiertas (pelágico)'),
      deep: mark('Fondos profundos (más de 100 m)'),
      mangrove: mark('Manglares'),
      flats: mark('Bajíos y planicies de marea'),
      kelp: mark('Bosques de algas (kelp)'),
    }),
    bestTimes: Object.freeze({
      dawn: mark('Amanecer'),
      dusk: mark('Atardecer'),
      night: mark('Noche'),
      day: mark('Día'),
    }),
    hookStyles: Object.freeze({
      'long-shank': mark('Pata larga (para gusana)'),
      'short-shank': mark('Pata corta y forjado (boca dura)'),
      circle: mark('Circular (clava en la comisura; mejor para soltar)'),
      treble: mark('Triple (en señuelos)'),
      assist: mark('Assist hook (en jigs)'),
      'live-bait-hook': mark('Para cebo vivo (abierto y fuerte)'),
    }),
    alerts: Object.freeze({
      regulated: mark('Captura muy regulada (autorización, cupos o marcado). Consulta la normativa antes de pescarla.'),
      protected: mark('Especie protegida en muchas zonas: no debe retenerse.'),
      'closed-seasons': mark('Suele tener vedas o cupos propios según la zona.'),
      venomous: mark('Espinas venenosas: manipúlala con guantes y pinzas.'),
      'sharp-teeth': mark('Dientes afilados: usa bajo de acero o fluorocarbono grueso y pinzas.'),
      ciguatera: mark('Riesgo de ciguatera en ejemplares grandes de zonas tropicales: mejor no consumirlos.'),
      toxic: mark('Tóxica: no se debe consumir.'),
    }),
  });

  /** Texto traducido de un código del vocabulario (o el propio código si no existe). */
  function label(kind, code) {
    const source = VOCAB[kind] && VOCAB[kind][code];
    return source ? t(source) : String(code);
  }

  function labels(kind, codes) {
    return Array.isArray(codes) ? codes.map((code) => label(kind, code)) : [];
  }

  /** Texto en el idioma activo de un campo {es, en}: castellano en español; inglés en el resto. */
  function localized(text) {
    if (!text) return '';
    if (typeof text === 'string') return text;
    const lang = PescaApp.i18n.locale();
    if (lang === 'es') return text.es || text.en || '';
    return text[lang] || text.en || text.es || '';
  }

  // ---------------------------------------------------------------------------
  // Catálogo combinado
  // ---------------------------------------------------------------------------

  let merged = null;
  let mergedFrom = null;

  /**
   * España y el resto del mundo en un solo catálogo. Las zonas de España llevan
   * kind 'spain' (con tallas); las regiones, kind 'region' (sin tallas). Cada especie
   * reúne en `zones` las zonas de España y las regiones donde aparece.
   */
  function catalog() {
    const spain = PescaApp.speciesData;
    const world = PescaApp.speciesWorld || { regions: [], species: [] };
    if (merged && mergedFrom && mergedFrom.spain === spain && mergedFrom.world === world) return merged;

    const zones = [
      ...spain.zones.map((zone) => ({ ...zone, kind: 'spain' })),
      ...world.regions.map((region) => ({ id: region.id, names: region.names, kind: 'region' })),
    ];
    const spainAnchors = spain.zoneAnchors.slice();
    const regionAnchors = world.regions.flatMap((region) =>
      (region.anchors || []).map((anchor) => ({ ...anchor, zoneId: region.id }))
    );
    const byId = new Map();
    [...spain.species, ...world.species].forEach((item) => {
      const names = item.names || { es: item.commonName, en: item.commonName };
      byId.set(item.id, { ...item, names, commonName: item.commonName || names.es, zones: [...(item.zones || [])] });
    });
    world.regions.forEach((region) =>
      (region.species || []).forEach((speciesId) => {
        const item = byId.get(speciesId);
        if (item && !item.zones.includes(region.id)) item.zones.push(region.id);
      })
    );
    merged = { zones, spainAnchors, regionAnchors, species: [...byId.values()] };
    mergedFrom = { spain, world };
    return merged;
  }

  function getZones() {
    return catalog().zones.slice();
  }

  function getZoneById(zoneId) {
    return catalog().zones.find((zone) => zone.id === zoneId) || null;
  }

  /** Nombre de una zona o región en el idioma activo. */
  function zoneLabel(zoneId) {
    const zone = getZoneById(zoneId);
    if (!zone) return '';
    return zone.names ? localized(zone.names) : zone.name;
  }

  /** true si la zona tiene tallas de referencia en la app (solo las de España). */
  function isRegulatedZone(zoneId) {
    const zone = getZoneById(zoneId);
    return Boolean(zone && zone.kind === 'spain');
  }

  function getSpeciesList() {
    return catalog().species.slice();
  }

  function getSpeciesById(speciesId) {
    return catalog().species.find((species) => species.id === speciesId) || null;
  }

  /** Nombre común de la especie en el idioma activo (castellano; inglés en el resto de idiomas). */
  function displayName(species) {
    if (!species) return '';
    return localized(species.names) || species.commonName || species.scientificName;
  }

  /** Especies de una zona o región, ordenadas por su nombre en el idioma activo. */
  function getSpeciesForZone(zoneId) {
    const collator = new Intl.Collator(PescaApp.i18n.intlLocale());
    return getSpeciesList()
      .filter((species) => species.zones.includes(zoneId))
      .sort((a, b) => collator.compare(displayName(a), displayName(b)));
  }

  /** Todos los nombres por los que se puede buscar una especie. */
  function searchableNames(species) {
    const names = species.names || {};
    return [species.commonName, ...Object.values(names), species.scientificName, ...(species.aliases || [])].filter(Boolean);
  }

  /**
   * Busca especies por nombre común (en cualquier idioma del catálogo), científico o alias,
   * sin acentos ni mayúsculas. Prioriza las coincidencias que empiezan por el texto buscado.
   *
   * @param {string} query Texto escrito por el usuario.
   * @param {{zoneId?: string|null, limit?: number}} [options]
   */
  function searchSpecies(query, options = {}) {
    const { zoneId = null, limit = 10 } = options;
    const utils = PescaApp.utils;
    const needle = utils.normalizeText(query);
    const pool = zoneId ? getSpeciesForZone(zoneId) : getSpeciesList();

    if (!needle) return pool.slice(0, limit);

    const collator = new Intl.Collator(PescaApp.i18n.intlLocale());
    const ranked = [];
    pool.forEach((species) => {
      const names = searchableNames(species).map(utils.normalizeText);
      const startsWithNeedle = names.some((name) => name.startsWith(needle));
      const containsNeedle = names.some((name) => name.includes(needle));
      if (startsWithNeedle || containsNeedle) {
        ranked.push({ species, rank: startsWithNeedle ? 0 : 1 });
      }
    });

    return ranked
      .sort((a, b) => a.rank - b.rank || collator.compare(displayName(a.species), displayName(b.species)))
      .slice(0, limit)
      .map((item) => item.species);
  }

  /** Busca una especie por nombre exacto (común, científico o alias). Devuelve null si no existe. */
  function findSpeciesByName(name) {
    const utils = PescaApp.utils;
    const needle = utils.normalizeText(name);
    if (!needle) return null;
    return (
      getSpeciesList().find((species) =>
        searchableNames(species).some((candidate) => utils.normalizeText(candidate) === needle)
      ) || null
    );
  }

  /** Punto de referencia más cercano de una lista, con su distancia. */
  function nearestAnchor(lat, lon, anchors) {
    const utils = PescaApp.utils;
    let best = null;
    anchors.forEach((anchor) => {
      const distance = utils.distanceKm(lat, lon, anchor.lat, anchor.lon);
      if (!best || distance < best.distanceKm) best = { anchor, distanceKm: distance };
    });
    return best;
  }

  function zoneResult(best, maxDistanceKm) {
    if (!best) return { zoneId: null, zoneName: null, anchorName: null, distanceKm: null, inCoverage: false };
    return {
      zoneId: best.anchor.zoneId,
      zoneName: zoneLabel(best.anchor.zoneId) || best.anchor.zoneId,
      anchorName: best.anchor.name,
      distanceKm: PescaApp.utils.round(best.distanceKm, 1),
      inCoverage: best.distanceKm <= maxDistanceKm,
    };
  }

  /**
   * Asigna unas coordenadas de España a la zona del punto de referencia más cercano.
   * `inCoverage` indica si la distancia a ese punto es razonable para usar el catálogo.
   */
  function classifyZone(lat, lon) {
    return zoneResult(nearestAnchor(lat, lon, catalog().spainAnchors), PescaApp.config.maxZoneDistanceKm);
  }

  /** Asigna unas coordenadas fuera de España a la región del mundo del punto de referencia más cercano. */
  function classifyRegion(lat, lon) {
    return zoneResult(nearestAnchor(lat, lon, catalog().regionAnchors), PescaApp.config.maxRegionDistanceKm);
  }

  /** Lista de meses en abreviatura, en orden del año. Ejemplo: [10, 11, 1] → "ene, oct, nov". */
  function formatMonths(months) {
    if (!Array.isArray(months) || months.length === 0) return t('Sin periodo definido');
    return [...months]
      .sort((a, b) => a - b)
      .map((month) => MONTH_NAMES[month - 1])
      .map((source) => (source === undefined ? source : t(source)))
      .join(', ');
  }

  /**
   * Tramos de anzuelo de la ficha: [{ fromKg, toKg, size }]. El primer tramo empieza en 0
   * y el último no tiene límite (toKg null).
   */
  function hookRows(species) {
    let fromKg = 0;
    return (species && Array.isArray(species.hooks) ? species.hooks : []).map((hook) => {
      const row = { fromKg, toKg: hook.maxKg === undefined ? null : hook.maxKg, size: hook.size };
      fromKg = hook.maxKg;
      return row;
    });
  }

  PescaApp.species = Object.freeze({
    VOCAB,
    label,
    labels,
    localized,
    getZones,
    getZoneById,
    zoneLabel,
    isRegulatedZone,
    getSpeciesList,
    getSpeciesById,
    displayName,
    getSpeciesForZone,
    searchSpecies,
    findSpeciesByName,
    classifyZone,
    classifyRegion,
    formatMonths,
    hookRows,
  });
})(typeof window !== 'undefined' ? window : globalThis);
