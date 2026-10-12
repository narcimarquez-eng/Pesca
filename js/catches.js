/**
 * Registro de capturas en localStorage: alta, borrado, exportación a JSON y CSV,
 * y reducción de fotos a base64 para que quepan en el almacenamiento del navegador.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  const STORAGE_KEY = 'catches';
  const CSV_SEPARATOR = ';';

  /**
   * Columnas del CSV. Se usa ";" como separador y se añade BOM UTF-8, así
   * Excel en español abre el archivo sin problemas. La foto no se exporta a CSV.
   */
  const CSV_COLUMNS = [
    { header: 'ID', value: (record) => record.id },
    { header: 'Fecha y hora', value: (record) => record.dateTime },
    { header: 'Especie', value: (record) => record.speciesName },
    { header: 'Nombre científico', value: (record) => record.scientificName },
    { header: 'Lugar', value: (record) => record.place && record.place.name },
    { header: 'Zona', value: (record) => record.zoneId },
    { header: 'Peso (kg)', value: (record) => record.weightKg },
    { header: 'Longitud (cm)', value: (record) => record.lengthCm },
    { header: 'Peso estimado (kg)', value: (record) => record.estimatedWeightKg },
    { header: 'Talla mínima de referencia (cm)', value: (record) => record.assessment && record.assessment.minSizeCm },
    { header: 'Devolver', value: (record) => (record.assessment && record.assessment.mustRelease ? 'Sí' : 'No') },
    { header: 'Cebo', value: (record) => record.bait },
    { header: 'Técnica', value: (record) => record.technique },
    { header: 'Notas', value: (record) => record.notes },
    { header: 'Temperatura del aire (°C)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.airTemperatureC },
    { header: 'Temperatura del agua (°C)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.waterTemperatureC },
    { header: 'Presión (hPa)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.pressureHpa },
    { header: 'Tendencia presión 3 h (hPa)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.pressureTrend3hHpa },
    { header: 'Viento (km/h)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.windSpeedKmh },
    { header: 'Dirección del viento (°)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.windDirectionDeg },
    { header: 'Nubosidad (%)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.cloudCoverPercent },
    { header: 'Precipitación (mm)', value: (record) => record.conditions && record.conditions.weather && record.conditions.weather.precipitationMm },
    { header: 'Fase lunar', value: (record) => record.conditions && record.conditions.moon && record.conditions.moon.name },
    { header: 'Altura de marea (m)', value: (record) => record.conditions && record.conditions.tide && record.conditions.tide.heightM },
    { header: 'Coeficiente de marea (aprox.)', value: (record) => record.conditions && record.conditions.tide && record.conditions.tide.coefficient },
    { header: 'Índice de actividad', value: (record) => record.conditions && record.conditions.activity && record.conditions.activity.score },
    { header: 'Origen de las condiciones', value: (record) => record.conditions && record.conditions.source },
  ];

  /** Lee todas las capturas guardadas. Devuelve una lista vacía si no hay datos válidos. */
  function loadAll() {
    const list = PescaApp.utils.storage.read(STORAGE_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  /** Guarda la lista completa. Devuelve false si el almacenamiento no admite más datos. */
  function saveAll(list) {
    return PescaApp.utils.storage.write(STORAGE_KEY, list);
  }

  /**
   * Crea un registro normalizado a partir de los datos del formulario.
   * Calcula las alertas de talla y veda y, si falta el peso, estima el peso con la longitud.
   */
  function createRecord(input) {
    const utils = PescaApp.utils;
    const dateTime = utils.parseDateTimeString(input.dateTimeText);
    if (!dateTime) {
      throw new Error('La fecha y la hora de la captura no son válidas.');
    }

    const species = input.species || null;
    const lengthCm = utils.toFiniteNumber(input.lengthCm);
    const weightKg = utils.toFiniteNumber(input.weightKg);
    const assessment = PescaApp.validation.evaluateCatch({
      species,
      zoneId: input.zoneId || null,
      lengthCm,
      dateTime,
    });
    const estimatedWeightKg =
      weightKg === null && lengthCm !== null && species
        ? PescaApp.validation.estimateWeightKg(lengthCm, species)
        : null;

    const cleanText = (value) => {
      const text = String(value || '').trim();
      return text ? text : null;
    };

    return {
      id: utils.createId(),
      savedAt: new Date().toISOString(),
      dateTime: input.dateTimeText,
      speciesId: species ? species.id : null,
      speciesName: species ? species.commonName : cleanText(input.speciesText) || 'Sin especificar',
      scientificName: species ? species.scientificName : null,
      zoneId: input.zoneId || null,
      place: input.place
        ? { name: input.place.name, lat: input.place.lat, lon: input.place.lon, region: input.place.region || null }
        : null,
      weightKg: weightKg === null ? null : utils.round(weightKg, 3),
      lengthCm: lengthCm === null ? null : utils.round(lengthCm, 1),
      estimatedWeightKg: estimatedWeightKg === null ? null : utils.round(estimatedWeightKg, 2),
      bait: cleanText(input.bait),
      technique: cleanText(input.technique),
      notes: cleanText(input.notes),
      photo: input.photo || null,
      conditions: input.conditions || null,
      assessment: {
        mustRelease: assessment.mustRelease,
        minSizeCm: assessment.minSizeCm,
        alerts: assessment.alerts.map((alert) => ({ level: alert.level, message: alert.message })),
      },
    };
  }

  /** Añade una captura. Devuelve { ok: false } si el almacenamiento no pudo guardarla (p. ej., cuota llena). */
  function addCatch(record) {
    const list = loadAll();
    list.push(record);
    const saved = saveAll(list);
    return { ok: saved, record };
  }

  function deleteCatch(catchId) {
    const remaining = loadAll().filter((record) => record.id !== catchId);
    return saveAll(remaining);
  }

  /** Exportación completa en JSON, incluidas las fotos en base64. */
  function toJson(list) {
    return JSON.stringify(
      {
        app: PescaApp.config.appName,
        exportedAt: new Date().toISOString(),
        count: list.length,
        catches: list,
      },
      null,
      2
    );
  }

  /** Escapa una celda de CSV: se entrecomilla si contiene separadores, comillas o saltos de línea. */
  function csvCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  /** Exportación en CSV (separador ";", codificación UTF-8 con BOM para Excel). */
  function toCsv(list) {
    const header = CSV_COLUMNS.map((column) => csvCell(column.header)).join(CSV_SEPARATOR);
    const rows = list.map((record) =>
      CSV_COLUMNS.map((column) => csvCell(column.value(record))).join(CSV_SEPARATOR)
    );
    return `﻿${[header, ...rows].join('\r\n')}\r\n`;
  }

  /**
   * Reduce una imagen a un JPEG pequeño (base64) para guardarla en localStorage.
   * Solo funciona en navegador.
   */
  function resizeImageFile(file) {
    const config = PescaApp.config.photo;
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || '').startsWith('image/')) {
        reject(new Error('El archivo seleccionado no es una imagen.'));
        return;
      }
      if (file.size > config.maxInputBytes) {
        reject(new Error('La imagen supera los 15 MB. Elige una más pequeña.'));
        return;
      }

      const reader = new root.FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.onload = () => {
        const image = new root.Image();
        image.onerror = () => reject(new Error('Formato de imagen no compatible.'));
        image.onload = () => {
          const scale = Math.min(1, config.maxSidePx / Math.max(image.width, image.height));
          const canvas = root.document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', config.jpegQuality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  PescaApp.catches = Object.freeze({
    STORAGE_KEY,
    CSV_COLUMNS,
    loadAll,
    saveAll,
    createRecord,
    addCatch,
    deleteCatch,
    toJson,
    toCsv,
    resizeImageFile,
  });
})(typeof window !== 'undefined' ? window : globalThis);
