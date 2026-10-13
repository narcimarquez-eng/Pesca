/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-10_7"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-46.5,37.75,9,2,18,43,274,0,11,6,58,27,5,10,6,141,5,5,11,37,130,147,91,74,0,200,180,66,297,120,282,132,98,138,174,69],[-46.5,37.875,9,2,17,43,269,0,11,6,57,27,5,10,6,139,4,5,11,37,132,148,90,74,0,201,179,66,296,119,284,131,98,139,174,70],[-46.5,38,9,3,17,42,264,0,11,6,57,27,5,10,6,137,4,5,11,39,135,150,90,74,0,202,178,66,296,119,285,128,97,141,174,70]]};
})(typeof window !== 'undefined' ? window : globalThis);
