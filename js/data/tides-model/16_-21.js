/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["16_-21"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[80,-100.125,3,3,49,3,59,3,23,15,12,19,16,0,3,15,0,15,0,188,27,46,339,260,23,218,204,231,333,39,0,346,312,0,183,0],[80.125,-100.125,3,3,57,3,49,3,23,15,10,25,18,0,3,13,0,15,0,197,30,50,2,275,42,217,204,245,336,44,0,347,334,0,183,0]]};
})(typeof window !== 'undefined' ? window : globalThis);
