/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["3_-31"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[19.25,-155,6,11,165,25,242,0,9,5,45,91,52,16,3,102,13,5,4,6,210,227,40,40,0,44,21,29,215,224,200,269,47,282,5,55],[19.25,-154.875,6,11,166,25,241,0,8,5,45,91,53,16,3,102,14,5,5,7,210,227,38,38,0,43,20,28,215,224,199,284,46,283,5,52],[19.375,-154.875,6,11,166,25,241,0,9,5,45,91,53,16,3,103,13,5,4,3,209,227,36,36,0,44,19,26,215,224,199,271,44,285,5,47],[19.375,-154.75,7,11,167,26,239,0,8,5,44,92,53,16,2,101,14,5,4,7,209,227,35,36,0,43,21,26,215,224,199,289,44,286,5,46],[19.5,-154.75,7,12,168,26,236,0,9,5,44,92,53,16,0,104,14,5,4,1,209,228,32,33,0,44,20,23,216,225,199,0,40,288,5,37]]};
})(typeof window !== 'undefined' ? window : globalThis);
