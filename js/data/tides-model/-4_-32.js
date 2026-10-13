/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-4_-32"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-20,-158.25,8,2,22,16,215,2,9,4,49,21,7,7,0,65,6,5,6,162,111,64,304,212,333,38,14,180,76,86,111,0,297,204,8,271],[-20,-158,7,2,20,17,206,3,9,5,46,21,6,6,3,66,6,5,6,164,112,65,309,214,337,36,11,180,77,82,106,357,299,204,8,269],[-19.875,-158.25,8,2,22,16,209,2,9,4,48,21,6,7,0,63,6,5,6,160,111,62,305,211,333,38,13,179,76,89,110,0,298,202,8,271],[-19.875,-158.125,7,2,21,16,206,2,9,4,47,21,6,6,2,63,6,5,6,160,113,61,307,211,337,36,11,178,76,85,108,359,298,202,9,269],[-19.875,-158,7,2,20,17,200,3,8,5,45,21,6,6,3,63,6,5,5,161,113,61,310,212,337,36,9,178,76,83,105,358,299,202,9,267]]};
})(typeof window !== 'undefined' ? window : globalThis);
