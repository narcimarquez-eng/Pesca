/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["13_4"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[65.125,24.5,4,9,40,12,3,3,0,9,0,9,5,5,15,19,61,7,10,315,96,256,199,121,45,0,242,0,239,196,233,329,127,334,234,147],[65.25,21.75,0,6,35,11,5,3,6,5,4,9,9,3,26,21,57,7,8,0,104,263,191,58,220,229,255,17,237,128,309,347,118,334,231,125],[69.75,20.375,34,8,73,101,1048,24,20,13,233,35,17,17,8,321,0,13,22,311,177,203,41,2,217,207,198,338,45,196,352,102,40,0,182,36],[69.75,20.5,34,8,73,100,1046,24,20,13,232,35,17,17,8,321,0,13,21,311,177,203,41,2,219,207,198,338,45,197,352,102,41,0,182,36],[69.875,20.5,32,8,72,93,987,13,21,13,217,34,17,17,8,298,0,13,20,309,177,202,41,1,226,207,198,336,45,195,351,104,40,0,182,34]]};
})(typeof window !== 'undefined' ? window : globalThis);
