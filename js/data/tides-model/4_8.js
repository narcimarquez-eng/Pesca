/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["4_8"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[20,40.25,4,2,31,2,33,2,11,2,12,18,13,0,10,10,92,3,7,228,274,162,39,328,278,23,339,316,169,138,0,298,359,28,224,79],[20,40.375,5,2,31,3,39,0,11,0,14,19,13,0,12,12,92,3,8,225,276,163,23,328,0,20,0,316,170,139,0,313,0,28,223,79],[20.125,40,3,2,32,2,22,4,11,2,9,18,12,0,12,7,93,3,5,245,269,159,79,334,255,29,346,321,168,137,0,276,4,27,223,84],[20.125,40.125,4,2,32,2,26,4,11,2,10,18,13,0,12,8,92,3,6,238,271,160,66,333,262,27,342,320,168,137,0,289,2,27,222,82],[20.125,40.25,4,2,32,3,31,3,11,2,12,18,13,0,13,10,92,3,7,232,272,162,45,333,273,24,338,320,169,137,0,307,2,27,222,81]]};
})(typeof window !== 'undefined' ? window : globalThis);
