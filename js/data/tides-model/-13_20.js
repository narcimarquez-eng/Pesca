/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-13_20"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-65,102.75,13,10,218,41,292,7,29,23,77,256,116,70,77,180,178,24,9,113,139,244,256,158,153,188,183,130,236,261,227,8,221,54,196,60],[-65,102.875,12,9,222,39,290,6,30,24,77,256,111,70,71,183,164,23,9,114,141,243,256,157,157,187,183,130,236,260,227,12,221,55,197,44],[-65,103,12,8,227,39,290,5,30,25,77,256,104,69,66,185,155,22,10,116,146,242,256,157,160,187,182,130,236,260,227,17,220,56,197,30]]};
})(typeof window !== 'undefined' ? window : globalThis);
