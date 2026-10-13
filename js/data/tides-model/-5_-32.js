/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-5_-32"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-20.125,-158.25,8,2,23,17,218,2,9,4,50,21,7,7,0,67,6,5,6,164,112,67,304,213,334,38,15,181,77,84,112,0,298,206,7,271],[-20.125,-158.125,7,2,22,17,214,3,9,5,48,21,7,6,2,67,6,5,6,165,112,68,306,214,337,37,14,182,77,82,111,356,299,206,8,270],[-20.125,-158,7,2,21,17,209,3,8,5,47,21,7,6,3,67,6,5,6,165,112,68,308,215,338,37,13,182,78,81,108,357,300,206,8,270]]};
})(typeof window !== 'undefined' ? window : globalThis);
