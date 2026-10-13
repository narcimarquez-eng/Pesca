/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["8_-13"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[43.625,-65,21,7,129,36,678,8,6,4,155,80,40,9,3,132,22,5,11,314,149,150,30,1,288,252,217,335,127,155,112,63,33,334,173,30],[43.75,-65,20,8,132,36,666,10,6,5,153,80,41,8,4,131,23,5,11,314,148,146,28,359,293,251,213,334,122,152,103,67,32,337,173,31],[44.875,-62.25,19,5,85,38,601,43,5,5,131,36,26,3,10,128,29,5,7,313,54,101,19,348,260,229,197,326,68,98,37,82,22,310,173,21],[44.875,-62.125,18,5,82,38,601,44,5,5,131,35,25,2,10,129,29,5,7,313,55,100,19,348,260,230,200,326,65,97,30,82,22,309,173,23],[44.875,-62,18,5,79,39,600,44,5,5,131,33,24,0,10,129,29,5,8,314,52,98,19,348,259,229,201,325,60,96,0,81,22,309,173,23]]};
})(typeof window !== 'undefined' ? window : globalThis);
