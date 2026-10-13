/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["6_10"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[30,50,21,21,459,75,643,5,0,3,140,280,125,47,16,224,29,6,16,109,226,238,217,176,294,0,24,149,196,232,175,8,226,264,169,246],[30,50.125,21,20,461,75,646,4,0,3,140,282,125,48,17,225,29,6,16,107,226,238,216,175,302,0,21,148,196,232,175,8,225,264,170,245],[30.125,50,22,21,466,79,670,6,0,3,145,284,126,48,17,232,29,6,17,109,226,238,218,176,298,0,21,150,196,233,175,8,227,263,169,246]]};
})(typeof window !== 'undefined' ? window : globalThis);
