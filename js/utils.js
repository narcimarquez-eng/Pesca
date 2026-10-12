/**
 * Utilidades generales de PescaApp: conversiones numéricas, fechas, formato,
 * peticiones de red, caché y almacenamiento local.
 *
 * No depende del DOM (salvo la descarga de archivos), así que se puede
 * probar con Node.js.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const MINUTE_MS = 60 * 1000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;
  const KM_PER_KNOT = 1.852;
  const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Prefijo de las claves de localStorage (se toma de la configuración). */
  function storagePrefix() {
    return (PescaApp.config && PescaApp.config.storagePrefix) || 'pescaapp.';
  }

  /** Acceso seguro a localStorage: puede no existir o lanzar excepciones (modo privado, cookies bloqueadas). */
  function getLocalStorage() {
    try {
      return root.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Números
  // ---------------------------------------------------------------------------

  /** Convierte un valor a número finito. Acepta coma decimal. Devuelve null si no es válido. */
  function toFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** Redondea a un número de decimales. Devuelve null si el valor no es finito. */
  function round(value, decimals = 0) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  /** Módulo positivo: el resultado siempre está en [0, modulus). */
  function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
  }

  /**
   * Interpolación lineal sobre una tabla de puntos [[x, y], ...] ordenada por x.
   * Fuera del rango devuelve el valor del extremo más cercano.
   */
  function interpolateTable(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (let index = 1; index < table.length; index += 1) {
      const [x1, y1] = table[index];
      if (x <= x1) {
        const [x0, y0] = table[index - 1];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return table[table.length - 1][1];
  }

  /** Distancia en kilómetros entre dos coordenadas (fórmula de Haversine). */
  function distanceKm(lat1, lon1, lat2, lon2) {
    const earthRadiusKm = 6371;
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** Grados → punto cardinal en castellano. Indica desde dónde sopla el viento. */
  function cardinalDirection(degrees) {
    if (!Number.isFinite(degrees)) return '—';
    const sector = Math.round(positiveModulo(degrees, 360) / 22.5) % 16;
    return COMPASS_POINTS[sector];
  }

  /** km/h → nudos (1 nudo = 1,852 km/h). */
  function kmhToKnots(kmh) {
    return Number.isFinite(kmh) ? kmh / KM_PER_KNOT : null;
  }

  /** Formato numérico español (coma decimal). Devuelve "—" si no hay valor. */
  function formatNumber(value, decimals = 0, unit = '') {
    if (!Number.isFinite(value)) return '—';
    const text = value.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return unit ? `${text} ${unit}` : text;
  }

  // ---------------------------------------------------------------------------
  // Texto
  // ---------------------------------------------------------------------------

  /** Escapa caracteres especiales de HTML para insertar texto de forma segura. */
  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(
      /[&<>"']/g,
      (char) => HTML_ESCAPES[char]
    );
  }

  /** Minúsculas y sin acentos, para comparar textos en las búsquedas. */
  function normalizeText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  // ---------------------------------------------------------------------------
  // Fechas (hora local del dispositivo; las horas de Open-Meteo son locales del lugar)
  // ---------------------------------------------------------------------------

  function pad2(number) {
    return String(number).padStart(2, '0');
  }

  /** Fecha local en formato "YYYY-MM-DD". */
  function toDateString(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /** Fecha y hora local en formato "YYYY-MM-DDTHH:MM" (el que usa input datetime-local). */
  function toDateTimeString(date) {
    return `${toDateString(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  /** Convierte "YYYY-MM-DDTHH:MM" a Date local. Devuelve null si el formato no es válido. */
  function parseDateTimeString(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(text || ''));
    if (!match) return null;
    const [year, month, day, hours, minutes] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Suma días a una fecha "YYYY-MM-DD" y devuelve otra en el mismo formato. */
  function shiftDateString(dateText, days) {
    const [year, month, day] = dateText.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  /** Días naturales entre dos fechas "YYYY-MM-DD" (to - from). */
  function daysBetweenDateStrings(fromText, toText) {
    const toUtc = (text) => {
      const [year, month, day] = text.split('-').map(Number);
      return Date.UTC(year, month - 1, day);
    };
    return Math.round((toUtc(toText) - toUtc(fromText)) / DAY_MS);
  }

  // ---------------------------------------------------------------------------
  // Almacenamiento local y caché
  // ---------------------------------------------------------------------------

  const storage = {
    /** Lee un valor guardado en JSON. Si falla, devuelve el valor por defecto. */
    read(key, fallback) {
      const target = getLocalStorage();
      if (!target) return fallback;
      try {
        const raw = target.getItem(storagePrefix() + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    },

    /** Guarda un valor en JSON. Devuelve false si no se pudo (cuota llena o acceso bloqueado). */
    write(key, value) {
      const target = getLocalStorage();
      if (!target) return false;
      try {
        target.setItem(storagePrefix() + key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    },

    remove(key) {
      const target = getLocalStorage();
      if (!target) return;
      try {
        target.removeItem(storagePrefix() + key);
      } catch (error) {
        /* Nada que hacer: la clave no se puede borrar. */
      }
    },

    /** Borra todas las claves de PescaApp (las que empiezan por el prefijo). */
    clearAll() {
      const target = getLocalStorage();
      if (!target) return;
      try {
        const prefix = storagePrefix();
        const keys = [];
        for (let index = 0; index < target.length; index += 1) {
          const key = target.key(index);
          if (key && key.startsWith(prefix)) keys.push(key);
        }
        keys.forEach((key) => target.removeItem(key));
      } catch (error) {
        /* Sin acceso a localStorage no hay nada que borrar. */
      }
    },
  };

  /** Caché sencilla con caducidad, guardada en localStorage. */
  const cache = {
    get(key, maxAgeMs) {
      const entry = storage.read(`cache.${key}`, null);
      if (!entry || !Number.isFinite(entry.savedAt)) return null;
      if (Date.now() - entry.savedAt > maxAgeMs) return null;
      return entry.data;
    },

    set(key, data) {
      storage.write(`cache.${key}`, { savedAt: Date.now(), data });
    },
  };

  // ---------------------------------------------------------------------------
  // Red
  // ---------------------------------------------------------------------------

  /**
   * Petición GET con JSON y tiempo máximo de espera.
   * Lanza un error con la propiedad `status` si el servicio responde con error HTTP.
   */
  async function fetchJson(url, options = {}) {
    const limitMs = options.timeoutMs || PescaApp.config.requestTimeoutMs;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), limitMs) : null;
    try {
      const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
      let body = null;
      try {
        body = await response.json();
      } catch (parseError) {
        body = null;
      }
      if (!response.ok) {
        const error = new Error(`El servicio respondió con error ${response.status}.`);
        error.status = response.status;
        error.body = body;
        throw error;
      }
      return body;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado. Inténtalo de nuevo.');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Mensaje legible para mostrar al usuario a partir de cualquier error. */
  function describeError(error) {
    if (!error) return 'Error desconocido.';
    if (error instanceof TypeError) {
      return 'No se pudo conectar con el servicio (sin conexión, bloqueo del navegador o CORS).';
    }
    return error.message || 'Error inesperado.';
  }

  /** Construye una URL con parámetros. Omite los vacíos y une las listas con comas. */
  function buildUrl(baseUrl, params) {
    const search = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value === null || value === undefined || value === '') return;
      search.append(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const query = search.toString().replace(/%2C/gi, ',');
    return query ? `${baseUrl}?${query}` : baseUrl;
  }

  // ---------------------------------------------------------------------------
  // Varios
  // ---------------------------------------------------------------------------

  function createId() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') {
      return root.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Retrasa la ejecución de `fn` hasta que pasan `waitMs` sin nuevas llamadas. */
  function debounce(fn, waitMs) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  /** Descarga un texto como archivo (solo en navegador). */
  function downloadText(fileName, content, mimeType) {
    if (!root.document || !root.URL || typeof root.URL.createObjectURL !== 'function') return;
    const blob = new Blob([content], { type: mimeType });
    const url = root.URL.createObjectURL(blob);
    const link = root.document.createElement('a');
    link.href = url;
    link.download = fileName;
    root.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }

  PescaApp.utils = Object.freeze({
    MINUTE_MS,
    HOUR_MS,
    DAY_MS,
    toFiniteNumber,
    clamp,
    round,
    positiveModulo,
    interpolateTable,
    distanceKm,
    cardinalDirection,
    kmhToKnots,
    formatNumber,
    escapeHtml,
    normalizeText,
    toDateString,
    toDateTimeString,
    parseDateTimeString,
    shiftDateString,
    daysBetweenDateStrings,
    storage,
    cache,
    fetchJson,
    describeError,
    buildUrl,
    createId,
    debounce,
    downloadText,
  });
})(typeof window !== 'undefined' ? window : globalThis);
