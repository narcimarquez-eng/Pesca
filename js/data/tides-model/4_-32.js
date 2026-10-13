/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["4_-32"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[20.125,-155.375,5,12,172,26,205,0,9,4,41,96,54,15,3,96,13,5,3,11,216,230,25,24,0,46,14,15,218,227,203,168,31,283,5,344],[20.125,-155.25,5,12,171,26,209,0,9,4,42,96,53,15,2,98,13,5,4,11,217,230,26,24,0,46,18,15,218,227,202,169,32,285,5,346],[20.25,-155.5,5,12,172,26,202,0,8,4,41,95,53,15,2,94,13,5,4,16,216,230,25,24,0,45,11,15,218,227,204,164,31,281,7,340]]};
})(typeof window !== 'undefined' ? window : globalThis);
