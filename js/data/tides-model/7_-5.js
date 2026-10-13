/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["7_-5"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[36.875,-25,16,3,42,51,496,3,0,2,111,27,12,11,10,182,26,0,10,37,92,69,78,61,115,0,284,47,317,62,260,6,82,282,0,77],[37,-25,16,3,42,52,509,3,0,2,113,27,12,12,11,186,26,0,10,36,90,70,79,61,116,0,276,47,318,63,261,8,82,282,0,77],[37.125,-25,16,3,42,52,511,3,0,2,114,27,12,12,11,186,26,0,10,37,89,70,80,62,116,0,267,47,319,63,261,11,83,282,0,79]]};
})(typeof window !== 'undefined' ? window : globalThis);
