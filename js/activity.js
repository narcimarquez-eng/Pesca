/**
 * Índice de actividad de pesca (0–100), estimado a partir de la presión, la
 * fase lunar, el viento y la marea. La valoración de 1 a 5 estrellas (computeFishingRating)
 * parte de ese índice y le aplica límites de seguridad por tormenta, lluvia y viento fuerte.
 *
 * Es una heurística orientativa, no una predicción. Los pesos y las curvas
 * están pensados para ser fáciles de ajustar: cambia WEIGHTS o las tablas de
 * cada función de puntuación. Si falta un dato (por ejemplo, la marea sin
 * clave de WorldTides), su peso se reparte entre los factores disponibles.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  /** Peso relativo de cada factor. */
  const WEIGHTS = Object.freeze({ pressure: 0.3, moon: 0.2, wind: 0.25, tide: 0.25 });

  /** Niveles textuales según la puntuación final. */
  const LEVELS = Object.freeze([
    { below: 30, label: 'Muy baja' },
    { below: 45, label: 'Baja' },
    { below: 60, label: 'Moderada' },
    { below: 75, label: 'Buena' },
    { below: Infinity, label: 'Muy buena' },
  ]);

  function describeLevel(score) {
    if (!Number.isFinite(score)) return 'Sin datos';
    return LEVELS.find((level) => score < level.below).label;
  }

  function clamp01(value) {
    return PescaApp.utils.clamp(value, 0, 1);
  }

  /** Puntuación 0–1 de la presión: nivel (ideal entre 1010 y 1020 hPa) y tendencia de 3 h. */
  function scorePressure(pressureHpa, trendHpa) {
    const utils = PescaApp.utils;
    if (!Number.isFinite(pressureHpa)) return null;
    const levelScore = utils.interpolateTable(
      [[995, 0.5], [1005, 0.9], [1010, 1], [1020, 1], [1030, 0.5]],
      pressureHpa
    );
    if (!Number.isFinite(trendHpa)) return levelScore;
    // Una bajada suave suele favorecer la alimentación; las bajadas y subidas bruscas restan.
    const trendScore = utils.interpolateTable(
      [[-6, 0.4], [-3, 0.8], [-1, 1], [0, 1], [1, 0.9], [3, 0.7], [6, 0.5]],
      trendHpa
    );
    return 0.6 * levelScore + 0.4 * trendScore;
  }

  /** Puntuación 0–1 de la luna: máxima en sizigias (luna nueva o llena). */
  function scoreMoon(distanceToSyzygy) {
    if (!Number.isFinite(distanceToSyzygy)) return null;
    return PescaApp.utils.interpolateTable(
      [[0, 1], [0.0625, 0.9], [0.125, 0.75], [0.25, 0.6]],
      distanceToSyzygy
    );
  }

  /** Puntuación 0–1 del viento (km/h): flojo es lo mejor, muy fuerte resta mucho. */
  function scoreWind(windSpeedKmh) {
    if (!Number.isFinite(windSpeedKmh)) return null;
    return PescaApp.utils.interpolateTable(
      [[0, 1], [10, 1], [20, 0.85], [30, 0.55], [40, 0.3], [60, 0.05]],
      windSpeedKmh
    );
  }

  /**
   * Puntuación 0–1 de la marea. Heurística: la actividad es menor cerca de un
   * extremo (agua casi parada) y mayor cuando la marea se mueve. El coeficiente
   * modula la intensidad de la corriente.
   */
  function scoreTide(hoursFromExtreme, coefficient) {
    const utils = PescaApp.utils;
    if (!Number.isFinite(hoursFromExtreme)) return null;
    const timing = utils.interpolateTable([[0, 0.35], [1, 0.7], [2, 0.9], [3, 1]], hoursFromExtreme);
    const strength = Number.isFinite(coefficient)
      ? utils.interpolateTable([[20, 0.8], [50, 1], [90, 1], [120, 0.9]], coefficient)
      : 1;
    return timing * strength;
  }

  function explainPressure(pressureHpa, trendHpa) {
    const utils = PescaApp.utils;
    const parts = [`Presión de ${utils.formatNumber(pressureHpa, 0, 'hPa')}`];
    if (Number.isFinite(trendHpa)) {
      if (trendHpa <= -3) {
        parts.push(`bajada rápida (${utils.formatNumber(trendHpa, 1)} hPa en 3 h), que suele anticipar cambio de tiempo`);
      } else if (trendHpa <= -1) {
        parts.push('bajando, lo que suele favorecer la alimentación');
      } else if (trendHpa >= 3) {
        parts.push(`subida rápida (+${utils.formatNumber(trendHpa, 1)} hPa en 3 h), que suele frenar la actividad`);
      } else if (trendHpa >= 1) {
        parts.push('subiendo ligeramente');
      } else {
        parts.push('estable');
      }
    }
    return `${parts.join(', ')}.`;
  }

  function explainMoon(distanceToSyzygy) {
    if (distanceToSyzygy < 0.0625) {
      return 'Luna nueva o llena: mareas vivas, que mueven más agua y alimento.';
    }
    if (distanceToSyzygy > 0.1875) {
      return 'Cuarto creciente o menguante: mareas muertas, con menos movimiento de agua.';
    }
    return 'Fase intermedia: efecto lunar moderado.';
  }

  function explainWind(windSpeedKmh) {
    const text = PescaApp.utils.formatNumber(windSpeedKmh, 0, 'km/h');
    if (windSpeedKmh <= 10) return `Viento flojo (${text}): condiciones muy cómodas.`;
    if (windSpeedKmh <= 20) return `Viento moderado (${text}).`;
    if (windSpeedKmh <= 30) return `Viento fuerte (${text}): dificulta el lanzado y el control del cebo.`;
    return `Viento muy fuerte (${text}): poco recomendable para pescar desde orilla o embarcaciones pequeñas.`;
  }

  function explainTide(hoursFromExtreme, coefficient) {
    let timing;
    if (hoursFromExtreme < 1) {
      timing = 'Pleamar o bajamar muy cercana: el agua está casi parada';
    } else if (hoursFromExtreme < 2.5) {
      timing = 'Marea moviéndose con intensidad moderada';
    } else {
      timing = 'Marea en plena corriente, que suele activar la alimentación';
    }
    const strength =
      Number.isFinite(coefficient) && coefficient >= 95 ? ', con coeficiente alto (corrientes fuertes)' : '';
    return `${timing}${strength}.`;
  }

  /** Tono de un factor para los resúmenes: favorable, neutral o desfavorable. */
  function toneOf(score) {
    if (score >= 0.75) return 'favorable';
    if (score >= 0.45) return 'neutral';
    return 'desfavorable';
  }

  function buildSummary(factors, score, missing) {
    let text = `Índice ${score}/100 (${describeLevel(score)}).`;
    if (factors.length > 1) {
      const sorted = [...factors].sort((a, b) => b.score - a.score);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      if (best.score !== worst.score) {
        text += ` Lo que más ayuda: ${best.label.toLowerCase()}. Lo que más resta: ${worst.label.toLowerCase()}.`;
      }
    }
    if (missing.length) {
      text += ` Sin datos de: ${missing.map((label) => label.toLowerCase()).join(', ')}.`;
    }
    return text;
  }

  /**
   * Calcula el índice de actividad.
   *
   * @param {object} input
   * @param {number|null} input.pressureHpa Presión a nivel del mar (hPa).
   * @param {number|null} input.pressureTrend3hHpa Variación de presión en 3 h (hPa).
   * @param {number|null} input.moonDistanceToSyzygy Distancia a sizigia (0–0,25), de moon.getMoonPhase.
   * @param {number|null} input.windSpeedKmh Viento medio (km/h).
   * @param {number|null} input.hoursFromTideExtreme Horas desde el extremo de marea más cercano (null sin datos).
   * @param {number|null} input.tideCoefficient Coeficiente de marea (20–120), si se conoce.
   * @returns {{score: number|null, level: string, factors: object[], missing: string[], summary: string}}
   */
  function computeActivityIndex(input = {}) {
    const definitions = scoreFactors(input).map((item) => ({
      ...item,
      explanation: explainFactor(item.key, input),
    }));
    const available = definitions.filter((item) => item.score !== null);
    const missing = definitions.filter((item) => item.score === null).map((item) => item.label);

    if (available.length === 0) {
      return {
        score: null,
        level: 'Sin datos',
        factors: [],
        missing,
        summary: 'No hay datos suficientes para calcular el índice.',
      };
    }

    const { score, totalWeight } = weightedScoreOf(available);

    const factors = available.map((item) => {
      const factorScore = Math.round(clamp01(item.score) * 100);
      return {
        key: item.key,
        label: item.label,
        score: factorScore,
        sharePercent: Math.round((item.weight / totalWeight) * 100),
        tone: toneOf(clamp01(item.score)),
        explanation: item.explanation,
      };
    });

    return {
      score,
      level: describeLevel(score),
      factors,
      missing,
      summary: buildSummary(factors, score, missing),
    };
  }

  /**
   * Factores con su puntuación 0–1 (null si falta el dato), sin textos. Es el cálculo que
   * comparten computeActivityIndex y fishingScore, para que no puedan separarse.
   */
  function scoreFactors(input) {
    return [
      {
        key: 'pressure',
        label: 'Presión atmosférica',
        weight: WEIGHTS.pressure,
        score: scorePressure(input.pressureHpa, input.pressureTrend3hHpa),
      },
      { key: 'moon', label: 'Fase lunar', weight: WEIGHTS.moon, score: scoreMoon(input.moonDistanceToSyzygy) },
      { key: 'wind', label: 'Viento', weight: WEIGHTS.wind, score: scoreWind(input.windSpeedKmh) },
      {
        key: 'tide',
        label: 'Marea',
        weight: WEIGHTS.tide,
        score: scoreTide(input.hoursFromTideExtreme, input.tideCoefficient),
      },
    ];
  }

  /** Explicación en castellano de un factor, o '' si falta su dato. */
  function explainFactor(key, input) {
    if (key === 'pressure') {
      return Number.isFinite(input.pressureHpa) ? explainPressure(input.pressureHpa, input.pressureTrend3hHpa) : '';
    }
    if (key === 'moon') {
      return Number.isFinite(input.moonDistanceToSyzygy) ? explainMoon(input.moonDistanceToSyzygy) : '';
    }
    if (key === 'wind') {
      return Number.isFinite(input.windSpeedKmh) ? explainWind(input.windSpeedKmh) : '';
    }
    return Number.isFinite(input.hoursFromTideExtreme)
      ? explainTide(input.hoursFromTideExtreme, input.tideCoefficient)
      : '';
  }

  /** Puntuación 0–100 ponderada de los factores disponibles, con el peso total que se ha usado. */
  function weightedScoreOf(available) {
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    const weightedScore = available.reduce((sum, item) => sum + item.weight * clamp01(item.score), 0) / totalWeight;
    return { score: Math.round(weightedScore * 100), totalWeight };
  }

  /** Códigos WMO de tormenta: se limita la valoración aunque el resto de factores sean buenos. */
  const THUNDERSTORM_CODES = Object.freeze([95, 96, 99]);

  /** Estrellas (1–5) y etiqueta según la puntuación final ajustada (0–100). */
  const STAR_THRESHOLDS = Object.freeze([
    { min: 80, stars: 5, label: 'Excelente' },
    { min: 65, stars: 4, label: 'Buena' },
    { min: 50, stars: 3, label: 'Aceptable' },
    { min: 35, stars: 2, label: 'Floja' },
    { min: -Infinity, stars: 1, label: 'Mala' },
  ]);

  /** Estrellas y etiqueta de una puntuación final. Sin puntuación, "Sin datos". */
  function ratingFor(score) {
    if (!Number.isFinite(score)) return { stars: null, label: 'Sin datos' };
    const { stars, label } = STAR_THRESHOLDS.find((threshold) => score >= threshold.min);
    return { stars, label };
  }

  /**
   * Ajustes de seguridad sobre el índice. Son límites, no factores: una tormenta o un
   * viento fuerte no se compensan con una buena marea ni con una luna favorable.
   * Las penalizaciones restan puntos y los topes fijan una puntuación máxima.
   */
  function collectAdjustments(input) {
    const utils = PescaApp.utils;
    const adjustments = [];
    const rain = utils.toFiniteNumber(input.precipitationMm);
    const wind = utils.toFiniteNumber(input.windSpeedKmh);
    const gusts = utils.toFiniteNumber(input.windGustsKmh);

    if (THUNDERSTORM_CODES.includes(input.weatherCode)) {
      adjustments.push({ key: 'storm', label: 'tormenta', cap: 20 });
    }
    if (rain !== null && rain >= 4) {
      adjustments.push({ key: 'heavy-rain', label: 'lluvia intensa', penalty: 30 });
    } else if (rain !== null && rain >= 1) {
      adjustments.push({ key: 'rain', label: 'lluvia', penalty: 10 });
    }
    if ((wind !== null && wind >= 40) || (gusts !== null && gusts >= 50)) {
      adjustments.push({ key: 'strong-wind', label: 'viento fuerte', cap: 25 });
    }
    return adjustments;
  }

  /** Aplica los límites de seguridad a una puntuación base. Devuelve la final y los ajustes usados. */
  function applyAdjustments(baseScore, input) {
    const adjustments = collectAdjustments(input);
    const penalty = adjustments.reduce((sum, item) => sum + (item.penalty || 0), 0);
    const caps = adjustments.filter((item) => item.cap !== undefined).map((item) => item.cap);
    const score = Math.round(Math.max(0, Math.min(baseScore - penalty, 100, ...caps)));
    return { score, adjustments };
  }

  /**
   * Frase para la tarjeta: los ajustes de seguridad aplicados (o su ausencia) y los datos
   * que faltan. No repite la etiqueta ni la puntuación, que la tarjeta ya muestra.
   */
  function buildRatingSummary(rating) {
    if (rating.score === null) return 'No hay datos suficientes para valorar las condiciones.';
    const parts = [];
    if (rating.adjustments.length) {
      const reasons = rating.adjustments.map((item) => `${item.label} (${item.effect})`);
      parts.push(`Ajustes de seguridad: ${reasons.join(', ')}.`);
    } else {
      parts.push('Sin ajustes de seguridad: no hay tormenta, lluvia ni viento fuerte.');
    }
    if (rating.missing.length) {
      parts.push(`Sin datos de: ${rating.missing.map((label) => label.toLowerCase()).join(', ')}.`);
    }
    return parts.join(' ');
  }

  /**
   * Valoración de pesca de 1 a 5 estrellas: el índice de actividad con los límites de
   * seguridad aplicados. Recibe los mismos datos que computeActivityIndex, más las
   * condiciones de precipitación, viento racheado y código de tiempo.
   *
   * @param {object} input Datos de computeActivityIndex y, además:
   * @param {number|null} input.precipitationMm Lluvia de la última hora (mm).
   * @param {number|null} input.windGustsKmh Rachas de viento (km/h).
   * @param {number|null} input.weatherCode Código WMO del tiempo.
   * @returns {{score: number|null, baseScore: number|null, stars: number|null, label: string, adjustments: object[], factors: object[], missing: string[], summary: string}}
   */
  function computeFishingRating(input = {}) {
    const index = computeActivityIndex(input);
    if (index.score === null) {
      return {
        score: null,
        baseScore: null,
        stars: null,
        label: 'Sin datos',
        adjustments: [],
        factors: [],
        missing: index.missing,
        summary: index.summary,
      };
    }

    const { score, adjustments } = applyAdjustments(index.score, input);
    const { stars, label } = ratingFor(score);

    const rating = {
      score,
      baseScore: index.score,
      stars,
      label,
      adjustments: adjustments.map((item) => ({
        key: item.key,
        label: item.label,
        effect: item.penalty ? `−${item.penalty}` : `máximo ${item.cap}`,
      })),
      factors: index.factors,
      missing: index.missing,
    };
    return { ...rating, summary: buildRatingSummary(rating) };
  }

  /**
   * Solo la puntuación final (0–100, con los límites de seguridad), sin explicaciones.
   * Hace el mismo cálculo que computeFishingRating; sirve para muchos escenarios a la vez.
   */
  function fishingScore(input = {}) {
    const available = scoreFactors(input).filter((item) => item.score !== null);
    if (!available.length) return null;
    return applyAdjustments(weightedScoreOf(available).score, input).score;
  }

  PescaApp.activity = Object.freeze({
    WEIGHTS,
    LEVELS,
    THUNDERSTORM_CODES,
    STAR_THRESHOLDS,
    describeLevel,
    scorePressure,
    scoreMoon,
    scoreWind,
    scoreTide,
    computeActivityIndex,
    ratingFor,
    buildRatingSummary,
    computeFishingRating,
    fishingScore,
  });
})(typeof window !== 'undefined' ? window : globalThis);
