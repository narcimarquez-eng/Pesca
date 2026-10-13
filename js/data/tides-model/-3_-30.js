/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-3_-30"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-14.625,-145.125,6,2,27,19,278,0,10,6,58,13,5,4,5,70,5,7,3,320,185,237,352,21,0,21,7,359,157,213,110,311,0,113,2,255],[-14.5,-145.125,5,2,29,19,282,0,10,6,58,13,6,4,5,70,5,7,3,321,185,237,355,23,0,21,8,1,161,215,111,312,2,108,2,265],[-14.375,-145.125,5,3,30,19,284,0,10,6,58,13,6,4,5,69,5,7,2,323,185,238,357,25,0,22,9,2,166,218,111,313,5,102,2,273]]};
})(typeof window !== 'undefined' ? window : globalThis);
