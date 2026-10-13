/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["5_-2"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[29.75,-10,28,2,68,100,940,17,2,0,198,61,23,18,3,352,23,0,22,13,65,43,63,42,139,341,0,27,302,38,248,65,67,315,0,57],[29.875,-10,28,2,68,100,939,16,2,0,198,61,23,18,3,351,22,0,21,13,65,42,63,42,139,341,0,28,302,39,247,50,67,315,0,57],[29.875,-9.875,28,2,68,100,939,16,2,0,197,62,23,18,4,352,22,0,21,13,64,42,63,42,138,340,0,28,302,38,246,47,67,315,0,56]]};
})(typeof window !== 'undefined' ? window : globalThis);
