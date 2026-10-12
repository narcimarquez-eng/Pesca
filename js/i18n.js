/**
 * Idioma de la interfaz. El texto de origen es el castellano: `t('Índice de actividad')`
 * devuelve la traducción del idioma activo o, si falta, la inglesa, y si tampoco existe,
 * el propio texto en castellano. Los marcadores {nombre} se sustituyen por `vars.nombre`.
 *
 * Los catálogos están en js/i18n/<código>.js. El inglés se carga siempre, porque es el
 * respaldo; los demás solo cuando se necesitan. El castellano no tiene catálogo: es el origen.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const SOURCE_LOCALE = 'es';
  const DEFAULT_LOCALE = 'en';

  /** Idiomas de la aplicación: nombre en su idioma, formato de números y fechas, y dirección de la escritura. */
  const LOCALES = Object.freeze({
    es: { name: 'Español', intl: 'es-ES', dir: 'ltr' },
    en: { name: 'English', intl: 'en-GB', dir: 'ltr' },
    fr: { name: 'Français', intl: 'fr-FR', dir: 'ltr' },
    pt: { name: 'Português', intl: 'pt-BR', dir: 'ltr' },
    de: { name: 'Deutsch', intl: 'de-DE', dir: 'ltr' },
    it: { name: 'Italiano', intl: 'it-IT', dir: 'ltr' },
    nl: { name: 'Nederlands', intl: 'nl-NL', dir: 'ltr' },
    pl: { name: 'Polski', intl: 'pl-PL', dir: 'ltr' },
    ru: { name: 'Русский', intl: 'ru-RU', dir: 'ltr' },
    tr: { name: 'Türkçe', intl: 'tr-TR', dir: 'ltr' },
    ar: { name: 'العربية', intl: 'ar-u-nu-latn', dir: 'rtl' },
    hi: { name: 'हिन्दी', intl: 'hi-IN', dir: 'ltr' },
    id: { name: 'Bahasa Indonesia', intl: 'id-ID', dir: 'ltr' },
    ja: { name: '日本語', intl: 'ja-JP', dir: 'ltr' },
    ko: { name: '한국어', intl: 'ko-KR', dir: 'ltr' },
    'zh-Hans': { name: '简体中文', intl: 'zh-CN', dir: 'ltr' },
    th: { name: 'ไทย', intl: 'th-TH-u-nu-latn', dir: 'ltr' },
    vi: { name: 'Tiếng Việt', intl: 'vi-VN', dir: 'ltr' },
  });

  /** Idioma de cada país (código ISO 3166-1). Lo que no aparece aquí usa el idioma del navegador o inglés. */
  const COUNTRIES_BY_LOCALE = Object.freeze({
    es: 'AR BO CL CO CR CU DO EC ES GQ GT HN MX NI PA PE PR PY SV UY VE',
    pt: 'AO BR CV GW MZ PT ST TL',
    fr: 'BF BI BJ CD CF CG CI CM DJ FR GA GF GN GP HT KM LU MC MG ML MQ NC NE PF RE RW SC SN TD TG VU WF YT',
    de: 'AT CH DE LI',
    it: 'IT SM VA',
    nl: 'AW BE CW NL SR',
    pl: 'PL',
    ru: 'BY KG KZ RU',
    tr: 'TR',
    ar: 'AE BH DZ EG IQ JO KW LB LY MA MR OM PS QA SA SD SY TN YE',
    hi: 'IN',
    id: 'ID',
    ja: 'JP',
    ko: 'KP KR',
    'zh-Hans': 'CN',
    th: 'TH',
    vi: 'VN',
  });

  /** Formato de números y fechas cuando el país cambia la convención de su idioma. */
  const INTL_BY_COUNTRY = Object.freeze({
    en: { US: 'en-US', CA: 'en-CA', AU: 'en-AU', NZ: 'en-NZ', IE: 'en-IE', IN: 'en-IN', ZA: 'en-ZA' },
    pt: { PT: 'pt-PT' },
    de: { AT: 'de-AT', CH: 'de-CH' },
    fr: { BE: 'fr-BE', CA: 'fr-CA', CH: 'fr-CH' },
    nl: { BE: 'nl-BE' },
  });

  /** Chinos tradicionales (Taiwán, Hong Kong, Macao) no tienen catálogo: usan inglés. */
  const TRADITIONAL_CHINESE_REGIONS = ['TW', 'HK', 'MO'];

  const COUNTRY_LOCALE = new Map();
  Object.keys(COUNTRIES_BY_LOCALE).forEach((code) => {
    COUNTRIES_BY_LOCALE[code].split(' ').forEach((country) => COUNTRY_LOCALE.set(country, code));
  });

  /** Catálogos cargados: idioma → (texto de origen normalizado → traducción). */
  const catalogs = new Map();
  let current = SOURCE_LOCALE;
  let currentCountry = null;

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isLocale = (code) => typeof code === 'string' && hasOwn(LOCALES, code);

  /** Espacios repetidos o saltos de línea: así se buscan las claves, sin cambiar el texto mostrado. */
  function normalize(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  /** Registra las traducciones de un idioma. Lo llama cada archivo de js/i18n/. */
  function register(code, messages) {
    const table = {};
    Object.keys(messages).forEach((key) => {
      table[normalize(key)] = messages[key];
    });
    catalogs.set(code, table);
  }

  /** Traducción de una clave: primero el idioma activo y luego el inglés. Null si no hay ninguna. */
  function lookup(key) {
    if (current === SOURCE_LOCALE) return null;
    const codes = current === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [current, DEFAULT_LOCALE];
    for (const code of codes) {
      const table = catalogs.get(code);
      if (table && hasOwn(table, key) && table[key] !== '') return table[key];
    }
    return null;
  }

  function interpolate(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (hasOwn(vars, name) ? String(vars[name]) : match));
  }

  /**
   * Texto traducido al idioma activo. Si no hay traducción, devuelve el texto de origen
   * (en castellano) tal cual, así que la versión en castellano no cambia.
   */
  function t(source, vars) {
    const translated = lookup(normalize(source));
    return interpolate(translated === null ? String(source) : translated, vars);
  }

  /** Marca un texto como traducible sin cambiarlo. Para etiquetas guardadas en constantes. */
  function mark(source) {
    return source;
  }

  function locale() {
    return current;
  }

  function direction() {
    return (LOCALES[current] || LOCALES[DEFAULT_LOCALE]).dir;
  }

  /** Formato de números y fechas del idioma activo, con la convención del país del lugar. */
  function intlLocale() {
    const byCountry = INTL_BY_COUNTRY[current] || {};
    return (currentCountry && byCountry[currentCountry]) || LOCALES[current].intl;
  }

  /** Idioma de un país, o null si no está en la tabla (entonces decide el navegador). */
  function localeForCountry(countryCode) {
    if (!countryCode) return null;
    return COUNTRY_LOCALE.get(String(countryCode).toUpperCase()) || null;
  }

  /** Idioma que pide Nominatim para los nombres de lugar: el del idioma activo. */
  function nominatimLanguage() {
    return current === 'zh-Hans' ? 'zh-CN' : current;
  }

  /** Idioma que pide el navegador (en orden de preferencia), si la aplicación lo tiene. */
  function browserLocale(languages) {
    for (const language of languages || []) {
      const [base = '', region = ''] = String(language).split('-');
      const code = base.toLowerCase();
      if (code === 'zh') {
        if (!TRADITIONAL_CHINESE_REGIONS.includes(region.toUpperCase())) return 'zh-Hans';
        continue;
      }
      if (isLocale(code)) return code;
    }
    return null;
  }

  /**
   * Idioma que corresponde: el elegido a mano; si no, el del país del lugar; si no, el del
   * navegador; y, si nada encaja, inglés.
   */
  function resolveLocale({ preferred = 'auto', countryCode = null, browserLanguages = [] } = {}) {
    if (isLocale(preferred)) return preferred;
    return localeForCountry(countryCode) || browserLocale(browserLanguages) || DEFAULT_LOCALE;
  }

  /** Carga el catálogo de un idioma si hace falta. Resuelve a true si quedó disponible. */
  function loadCatalog(code) {
    if (code === SOURCE_LOCALE || catalogs.has(code)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = root.document.createElement('script');
      script.src = `js/i18n/${code}.js`;
      script.onload = () => resolve(catalogs.has(code));
      script.onerror = () => resolve(false);
      root.document.head.appendChild(script);
    });
  }

  /** Traduce los elementos marcados del HTML: data-i18n (contenido) y data-i18n-attrs (atributos). */
  function applyDom(doc) {
    doc.querySelectorAll('[data-i18n]').forEach((element) => {
      if (!element.hasAttribute('data-i18n-src')) element.setAttribute('data-i18n-src', element.innerHTML);
      element.innerHTML = t(element.getAttribute('data-i18n-src'));
    });
    doc.querySelectorAll('[data-i18n-attrs]').forEach((element) => {
      element
        .getAttribute('data-i18n-attrs')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((name) => {
          const sourceName = `data-i18n-src-${name}`;
          if (!element.hasAttribute(sourceName)) element.setAttribute(sourceName, element.getAttribute(name) || '');
          element.setAttribute(name, t(element.getAttribute(sourceName)));
        });
    });
  }

  function applyDocument() {
    const doc = root.document;
    if (!doc) return;
    doc.documentElement.lang = current;
    doc.documentElement.dir = direction();
    applyDom(doc);
  }

  /**
   * Activa un idioma (y el país del lugar, para el formato de números). Carga su catálogo si
   * hace falta. Si no se puede cargar, usa inglés. Resuelve al código que quedó activo.
   */
  function setLocale(code, { countryCode = null } = {}) {
    currentCountry = countryCode ? String(countryCode).toUpperCase() : null;
    const target = isLocale(code) ? code : DEFAULT_LOCALE;
    return loadCatalog(target).then((available) => {
      current = available || target === SOURCE_LOCALE ? target : DEFAULT_LOCALE;
      applyDocument();
      return current;
    });
  }

  /** Idiomas para el selector de Ajustes. */
  function localeOptions() {
    return Object.keys(LOCALES).map((code) => ({ code, name: LOCALES[code].name }));
  }

  PescaApp.i18n = Object.freeze({
    SOURCE_LOCALE,
    DEFAULT_LOCALE,
    LOCALES,
    register,
    t,
    mark,
    normalize,
    locale,
    direction,
    intlLocale,
    isLocale,
    localeForCountry,
    browserLocale,
    nominatimLanguage,
    resolveLocale,
    setLocale,
    applyDom,
    localeOptions,
  });
})(typeof window !== 'undefined' ? window : globalThis);
