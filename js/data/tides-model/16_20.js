/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["16_20"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[80,100,4,5,57,17,155,5,24,15,26,26,22,3,3,57,0,15,4,47,285,272,156,102,212,215,202,81,267,270,281,192,153,0,182,143],[80,100.125,4,4,56,17,154,5,24,15,25,26,22,3,3,56,0,15,4,47,285,272,156,102,212,215,202,81,268,270,280,190,154,0,182,143],[80,100.25,4,4,55,17,153,5,24,15,25,26,21,3,3,56,0,15,4,47,285,271,156,103,212,215,202,81,268,270,279,189,154,0,182,143]]};
})(typeof window !== 'undefined' ? window : globalThis);
