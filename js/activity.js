/**
 * Índice de actividad de pesca (0–100), estimado a partir de la presión, la
 * fase lunar, el viento y la marea.
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
    const definitions = [
      {
        key: 'pressure',
        label: 'Presión atmosférica',
        weight: WEIGHTS.pressure,
        score: scorePressure(input.pressureHpa, input.pressureTrend3hHpa),
        explanation: Number.isFinite(input.pressureHpa)
          ? explainPressure(input.pressureHpa, input.pressureTrend3hHpa)
          : '',
      },
      {
        key: 'moon',
        label: 'Fase lunar',
        weight: WEIGHTS.moon,
        score: scoreMoon(input.moonDistanceToSyzygy),
        explanation: Number.isFinite(input.moonDistanceToSyzygy) ? explainMoon(input.moonDistanceToSyzygy) : '',
      },
      {
        key: 'wind',
        label: 'Viento',
        weight: WEIGHTS.wind,
        score: scoreWind(input.windSpeedKmh),
        explanation: Number.isFinite(input.windSpeedKmh) ? explainWind(input.windSpeedKmh) : '',
      },
      {
        key: 'tide',
        label: 'Marea',
        weight: WEIGHTS.tide,
        score: scoreTide(input.hoursFromTideExtreme, input.tideCoefficient),
        explanation: Number.isFinite(input.hoursFromTideExtreme)
          ? explainTide(input.hoursFromTideExtreme, input.tideCoefficient)
          : '',
      },
    ];

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

    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    const weightedScore =
      available.reduce((sum, item) => sum + item.weight * clamp01(item.score), 0) / totalWeight;
    const score = Math.round(weightedScore * 100);

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

  PescaApp.activity = Object.freeze({
    WEIGHTS,
    LEVELS,
    describeLevel,
    scorePressure,
    scoreMoon,
    scoreWind,
    scoreTide,
    computeActivityIndex,
  });
})(typeof window !== 'undefined' ? window : globalThis);
