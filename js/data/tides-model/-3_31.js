/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-3_31"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-11.625,159.875,0,11,215,21,73,0,11,8,17,112,65,18,6,76,16,7,6,0,46,43,211,205,0,3,8,243,18,37,357,250,213,291,357,196],[-11.5,159.875,0,11,215,21,77,0,10,7,17,112,65,18,6,79,14,6,6,0,45,43,207,199,0,3,8,236,18,37,357,252,210,293,357,194],[-11.375,159.875,0,11,214,21,81,2,10,7,15,111,65,18,6,79,12,6,6,0,45,44,201,187,271,3,8,223,19,38,357,253,204,296,356,191]]};
})(typeof window !== 'undefined' ? window : globalThis);
