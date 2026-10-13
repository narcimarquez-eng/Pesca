/**
 * Índice de actividad de pesca (0–100), estimado a partir de la presión, la
 * fase lunar, el viento, la marea y la hora del día (luz del sol). La valoración de 1 a 5 estrellas (computeFishingRating)
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
  const { t, mark } = PescaApp.i18n;

  /** Peso relativo de cada factor. */
  const WEIGHTS = Object.freeze({ pressure: 0.25, moon: 0.15, wind: 0.2, tide: 0.2, light: 0.2 });

  /** Niveles textuales según la puntuación final. */
  const LEVELS = Object.freeze([
    { below: 30, label: mark('Muy baja') },
    { below: 45, label: mark('Baja') },
    { below: 60, label: mark('Moderada') },
    { below: 75, label: mark('Buena') },
    { below: Infinity, label: mark('Muy buena') },
  ]);

  function describeLevel(score) {
    if (!Number.isFinite(score)) return t('Sin datos');
    return t(LEVELS.find((level) => score < level.below).label);
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

  /**
   * Puntuación 0–1 de la luz: máxima en el crepúsculo (sol entre −6° y +6°), buena de
   * noche y más baja con el sol alto. Muchos depredadores cazan más con poca luz, cuando
   * sus presas los ven peor. De día, las nubes suavizan la luz y suben algo la puntuación.
   */
  function scoreLight(sunElevationDeg, cloudCoverPct) {
    const utils = PescaApp.utils;
    if (!Number.isFinite(sunElevationDeg)) return null;
    const base = utils.interpolateTable(
      [[-18, 0.6], [-12, 0.75], [-6, 1], [6, 1], [12, 0.75], [25, 0.5], [90, 0.45]],
      sunElevationDeg
    );
    if (!Number.isFinite(cloudCoverPct)) return base;
    const daylight = clamp01((sunElevationDeg - 12) / 13);
    return base + 0.15 * daylight * clamp01(cloudCoverPct / 100);
  }

  function explainPressure(pressureHpa, trendHpa) {
    const utils = PescaApp.utils;
    const parts = [t('Presión de {value}', { value: utils.formatNumber(pressureHpa, 0, 'hPa') })];
    if (Number.isFinite(trendHpa)) {
      if (trendHpa <= -3) {
        parts.push(
          t('bajada rápida ({value} hPa en 3 h), que suele anticipar cambio de tiempo', {
            value: utils.formatNumber(trendHpa, 1),
          })
        );
      } else if (trendHpa <= -1) {
        parts.push(t('bajando, lo que suele favorecer la alimentación'));
      } else if (trendHpa >= 3) {
        parts.push(
          t('subida rápida (+{value} hPa en 3 h), que suele frenar la actividad', {
            value: utils.formatNumber(trendHpa, 1),
          })
        );
      } else if (trendHpa >= 1) {
        parts.push(t('subiendo ligeramente'));
      } else {
        parts.push(t('estable'));
      }
    }
    return `${parts.join(', ')}.`;
  }

  function explainMoon(distanceToSyzygy) {
    if (distanceToSyzygy < 0.0625) {
      return t('Luna nueva o llena: mareas vivas, que mueven más agua y alimento.');
    }
    if (distanceToSyzygy > 0.1875) {
      return t('Cuarto creciente o menguante: mareas muertas, con menos movimiento de agua.');
    }
    return t('Fase intermedia: efecto lunar moderado.');
  }

  function explainWind(windSpeedKmh) {
    const text = PescaApp.utils.formatNumber(windSpeedKmh, 0, 'km/h');
    if (windSpeedKmh <= 10) return t('Viento flojo ({value}): condiciones muy cómodas.', { value: text });
    if (windSpeedKmh <= 20) return t('Viento moderado ({value}).', { value: text });
    if (windSpeedKmh <= 30) {
      return t('Viento fuerte ({value}): dificulta el lanzado y el control del cebo.', { value: text });
    }
    return t('Viento muy fuerte ({value}): poco recomendable para pescar desde orilla o embarcaciones pequeñas.', {
      value: text,
    });
  }

  function explainTide(hoursFromExtreme, coefficient) {
    let timing;
    if (hoursFromExtreme < 1) {
      timing = t('Pleamar o bajamar muy cercana: el agua está casi parada');
    } else if (hoursFromExtreme < 2.5) {
      timing = t('Marea moviéndose con intensidad moderada');
    } else {
      timing = t('Marea en plena corriente, que suele activar la alimentación');
    }
    const strength =
      Number.isFinite(coefficient) && coefficient >= 95 ? t(', con coeficiente alto (corrientes fuertes)') : '';
    return `${timing}${strength}.`;
  }

  function explainLight(sunElevationDeg, sunRising, cloudCoverPct) {
    const { NIGHT_BELOW_DEG, DAY_ABOVE_DEG } = PescaApp.sun;
    if (sunElevationDeg < NIGHT_BELOW_DEG) {
      return t('Noche: muchas especies nocturnas se acercan a la orilla; suele rendir el cebo natural a fondo.');
    }
    if (sunElevationDeg <= DAY_ABOVE_DEG) {
      return sunRising
        ? t('Amanecer: con poca luz, muchos depredadores cazan más y cerca de la superficie; buen momento para señuelos.')
        : t('Atardecer: con poca luz, muchos depredadores cazan más y cerca de la superficie; buen momento para señuelos.');
    }
    if (Number.isFinite(cloudCoverPct) && cloudCoverPct >= 70) {
      return t('De día, pero nublado: la luz suave alarga la actividad.');
    }
    return t('Pleno día con sol: muchas especies bajan al fondo o buscan sombra; pesca más hondo o junto a las rocas.');
  }

  /** Tono de un factor para los resúmenes: favorable, neutral o desfavorable. */
  function toneOf(score) {
    if (score >= 0.75) return 'favorable';
    if (score >= 0.45) return 'neutral';
    return 'desfavorable';
  }

  function buildSummary(factors, score, missing) {
    let text = t('Índice {score}/100 ({level}).', { score, level: describeLevel(score) });
    if (factors.length > 1) {
      const sorted = [...factors].sort((a, b) => b.score - a.score);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      if (best.score !== worst.score) {
        const highlights = t('Lo que más ayuda: {best}. Lo que más resta: {worst}.', {
          best: best.label.toLowerCase(),
          worst: worst.label.toLowerCase(),
        });
        text += ` ${highlights}`;
      }
    }
    if (missing.length) {
      const list = missing.map((label) => label.toLowerCase()).join(', ');
      text += ` ${t('Sin datos de: {list}.', { list })}`;
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
   * @param {number|null} input.sunElevationDeg Elevación del sol en grados (sun.solarElevation).
   * @param {boolean} [input.sunRising] true si el sol sube (mañana), para distinguir amanecer y atardecer.
   * @param {number|null} [input.cloudCoverPct] Nubosidad (%), que suaviza la luz de día.
   * @returns {{score: number|null, level: string, factors: object[], missing: string[], summary: string}}
   */
  function computeActivityIndex(input = {}) {
    const definitions = scoreFactors(input).map((item) => ({
      ...item,
      explanation: explainFactor(item.key, input),
    }));
    const available = definitions.filter((item) => item.score !== null);
    const missing = definitions.filter((item) => item.score === null).map((item) => t(item.label));

    if (available.length === 0) {
      return {
        score: null,
        level: t('Sin datos'),
        factors: [],
        missing,
        summary: t('No hay datos suficientes para calcular el índice.'),
      };
    }

    const { score, totalWeight } = weightedScoreOf(available);

    const factors = available.map((item) => {
      const factorScore = Math.round(clamp01(item.score) * 100);
      return {
        key: item.key,
        label: t(item.label),
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
        label: mark('Presión atmosférica'),
        weight: WEIGHTS.pressure,
        score: scorePressure(input.pressureHpa, input.pressureTrend3hHpa),
      },
      { key: 'moon', label: mark('Fase lunar'), weight: WEIGHTS.moon, score: scoreMoon(input.moonDistanceToSyzygy) },
      { key: 'wind', label: mark('Viento'), weight: WEIGHTS.wind, score: scoreWind(input.windSpeedKmh) },
      {
        key: 'tide',
        label: mark('Marea'),
        weight: WEIGHTS.tide,
        score: scoreTide(input.hoursFromTideExtreme, input.tideCoefficient),
      },
      {
        key: 'light',
        label: mark('Hora del día'),
        weight: WEIGHTS.light,
        score: scoreLight(input.sunElevationDeg, input.cloudCoverPct),
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
    if (key === 'light') {
      return Number.isFinite(input.sunElevationDeg)
        ? explainLight(input.sunElevationDeg, input.sunRising, input.cloudCoverPct)
        : '';
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
    { min: 80, stars: 5, label: mark('Excelente') },
    { min: 65, stars: 4, label: mark('Buena') },
    { min: 50, stars: 3, label: mark('Aceptable') },
    { min: 35, stars: 2, label: mark('Floja') },
    { min: -Infinity, stars: 1, label: mark('Mala') },
  ]);

  /** Estrellas y etiqueta de una puntuación final. Sin puntuación, "Sin datos". */
  function ratingFor(score) {
    if (!Number.isFinite(score)) return { stars: null, label: t('Sin datos') };
    const { stars, label } = STAR_THRESHOLDS.find((threshold) => score >= threshold.min);
    return { stars, label: t(label) };
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
      adjustments.push({ key: 'storm', label: mark('tormenta'), cap: 20 });
    }
    if (rain !== null && rain >= 4) {
      adjustments.push({ key: 'heavy-rain', label: mark('lluvia intensa'), penalty: 30 });
    } else if (rain !== null && rain >= 1) {
      adjustments.push({ key: 'rain', label: mark('lluvia'), penalty: 10 });
    }
    if ((wind !== null && wind >= 40) || (gusts !== null && gusts >= 50)) {
      adjustments.push({ key: 'strong-wind', label: mark('viento fuerte'), cap: 25 });
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
    if (rating.score === null) return t('No hay datos suficientes para valorar las condiciones.');
    const parts = [];
    if (rating.adjustments.length) {
      const reasons = rating.adjustments.map((item) => `${item.label} (${item.effect})`);
      parts.push(t('Ajustes de seguridad: {reasons}.', { reasons: reasons.join(', ') }));
    } else {
      parts.push(t('Sin ajustes de seguridad: no hay tormenta, lluvia ni viento fuerte.'));
    }
    if (rating.missing.length) {
      const list = rating.missing.map((label) => label.toLowerCase()).join(', ');
      parts.push(t('Sin datos de: {list}.', { list }));
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
        label: t('Sin datos'),
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
        label: t(item.label),
        effect: item.penalty ? `−${item.penalty}` : t('máximo {value}', { value: item.cap }),
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
    scoreLight,
    computeActivityIndex,
    ratingFor,
    buildRatingSummary,
    computeFishingRating,
    fishingScore,
  });
})(typeof window !== 'undefined' ? window : globalThis);
