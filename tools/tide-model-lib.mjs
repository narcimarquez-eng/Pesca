/**
 * Funciones puras para convertir un modelo global de marea en rejilla (EOT20) en
 * «puntos de modelo» a lo largo de la costa. Las usa tools/build-tide-model.mjs y
 * las prueba tests/tide-model.test.js.
 */

/** Constituyentes con amplitud menor de 2 mm no cambian las predicciones de forma apreciable. */
export const MIN_AMPLITUDE_M = 0.002;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const round = (value, decimals) => Number(value.toFixed(decimals));

/** Longitud en el rango [-180, 180). */
export function normalizeLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Distancia de círculo máximo en km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Máscara de océano: 1 donde la amplitud y la fase son números válidos. EOT20 marca
 * la tierra con ceros (pyTMD la descarta igual) y algunos ficheros usan un valor de
 * relleno; ambos casos quedan fuera.
 */
export function oceanMask(amplitude, phase, fillValues = []) {
  const fills = new Set(fillValues.filter((value) => Number.isFinite(value)));
  const mask = new Uint8Array(amplitude.length);
  for (let index = 0; index < amplitude.length; index += 1) {
    const a = amplitude[index];
    const g = phase[index];
    mask[index] =
      Number.isFinite(a) && Number.isFinite(g) && a > 0 && g !== 0 && a < 1e5 && Math.abs(g) <= 720 && !fills.has(a) && !fills.has(g)
        ? 1
        : 0;
  }
  return mask;
}

/**
 * Celdas de océano que tocan tierra (alguna de sus 8 vecinas no es océano): la franja
 * más cercana a la costa que resuelve el modelo. La rejilla va en orden
 * [latitud][longitud] con `stride` valores por fila; solo se recorren las `nLon`
 * primeras columnas. Si la rejilla da la vuelta al mundo, la longitud es cíclica.
 */
export function coastalCells(mask, { nLat, nLon, stride = nLon, wrapsLon = false }) {
  const cells = [];
  for (let i = 0; i < nLat; i += 1) {
    for (let j = 0; j < nLon; j += 1) {
      if (!mask[i * stride + j]) continue;
      let touchesLand = false;
      for (let di = -1; di <= 1 && !touchesLand; di += 1) {
        const ii = i + di;
        if (ii < 0 || ii >= nLat) continue;
        for (let dj = -1; dj <= 1; dj += 1) {
          if (di === 0 && dj === 0) continue;
          let jj = j + dj;
          if (jj < 0 || jj >= nLon) {
            if (!wrapsLon) continue;
            jj = (jj + nLon) % nLon;
          }
          if (!mask[ii * stride + jj]) {
            touchesLand = true;
            break;
          }
        }
      }
      if (touchesLand) cells.push({ i, j });
    }
  }
  return cells;
}

/** Índice espacial de estaciones en celdas de `cellDeg` grados, para buscar la más cercana. */
export function buildStationIndex(stations, cellDeg = 1) {
  const cells = new Map();
  for (const station of stations) {
    const key = `${Math.floor(station.lat / cellDeg)}_${Math.floor(normalizeLon(station.lon) / cellDeg)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(station);
  }
  return { cellDeg, cells };
}

/** Estación más cercana a menos de `maxKm`, o null. */
export function nearestStation(index, lat, lon, maxKm) {
  const { cellDeg, cells } = index;
  const latSpan = Math.ceil(maxKm / 111 / cellDeg) + 1;
  const cosLat = Math.max(Math.cos(toRad(Math.min(Math.abs(lat) + latSpan * cellDeg, 89.9))), 0.01);
  const lonSpan = Math.min(Math.ceil(maxKm / (111 * cosLat) / cellDeg) + 1, Math.ceil(180 / cellDeg));
  const latIndex = Math.floor(lat / cellDeg);
  const lonIndex = Math.floor(normalizeLon(lon) / cellDeg);
  const lonCount = Math.round(360 / cellDeg);
  let best = null;
  for (let di = -latSpan; di <= latSpan; di += 1) {
    for (let dj = -lonSpan; dj <= lonSpan; dj += 1) {
      const wrapped = ((((lonIndex + dj + lonCount / 2) % lonCount) + lonCount) % lonCount) - lonCount / 2;
      const list = cells.get(`${latIndex + di}_${wrapped}`);
      if (!list) continue;
      for (const station of list) {
        const d = distanceKm(lat, lon, station.lat, station.lon);
        if (d <= maxKm && (best === null || d < best.distanceKm)) best = { station, distanceKm: d };
      }
    }
  }
  return best;
}

/**
 * Codifica un punto como [lat, lon, amplitudes en mm..., fases en grados...]. Las
 * amplitudes por debajo de 2 mm se guardan como 0 (constituyente omitido). Redondear a
 * 1 mm y a 1° cambia la predicción menos de 1 cm, muy por debajo del error del modelo.
 */
export function encodePoint(lat, lon, amplitudesM, phasesDeg) {
  const amplitudes = amplitudesM.map((a) => (Number.isFinite(a) && a >= MIN_AMPLITUDE_M ? Math.round(a * 1000) : 0));
  const phases = phasesDeg.map((g, k) => (amplitudes[k] && Number.isFinite(g) ? Math.round(((g % 360) + 360) % 360) % 360 : 0));
  return [round(lat, 3), round(normalizeLon(lon), 3), ...amplitudes, ...phases];
}

/** Constituyentes [nombre, amplitud en m, fase en grados] de un punto codificado. */
export function decodePoint(point, names) {
  const count = names.length;
  const constituents = [];
  for (let k = 0; k < count; k += 1) {
    const amplitudeMm = point[2 + k];
    if (amplitudeMm > 0) constituents.push([names[k], amplitudeMm / 1000, point[2 + count + k]]);
  }
  return constituents;
}

/** Clave de la tesela de `size` grados que contiene el punto. */
export function tileKey(lat, lon, size) {
  return `${Math.floor(lat / size)}_${Math.floor(normalizeLon(lon) / size)}`;
}
