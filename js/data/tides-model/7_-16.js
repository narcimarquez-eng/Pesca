/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["7_-16"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[35.375,-76.5,7,9,26,18,117,11,10,11,25,19,20,15,8,29,34,4,11,358,240,244,77,172,44,337,49,141,304,217,203,87,180,260,134,136],[36,-76.25,3,11,29,9,298,10,12,15,21,29,11,15,15,3,35,4,10,357,233,133,126,6,77,347,47,4,148,240,244,11,151,261,134,153]]};
})(typeof window !== 'undefined' ? window : globalThis);
