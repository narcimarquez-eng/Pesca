/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["12_8"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[64.625,40,11,5,60,35,385,74,6,4,70,10,22,9,9,88,32,9,14,26,24,75,88,52,193,246,100,11,295,45,192,213,106,274,179,121],[64.625,40.375,12,5,59,35,383,77,7,4,71,10,22,9,10,88,32,9,14,27,24,75,90,53,197,243,103,14,296,46,195,213,107,274,179,122],[64.75,40,11,5,58,35,384,75,6,4,70,10,22,9,8,87,33,9,14,25,28,74,89,52,193,246,103,10,294,47,192,210,106,275,179,123],[64.75,40.5,12,4,57,35,380,78,7,4,71,10,22,9,9,86,32,9,15,27,29,74,90,53,197,242,106,13,295,48,196,211,108,276,179,124],[64.875,40,11,4,57,34,374,71,6,4,70,10,22,9,7,84,33,9,14,25,37,74,90,52,193,246,107,10,293,50,193,206,107,276,180,125],[64.875,40.125,11,4,56,34,376,74,6,4,71,10,21,9,7,85,33,9,14,26,37,74,91,53,195,246,109,12,293,51,194,206,108,276,179,126],[64.875,40.375,11,4,56,35,378,78,6,4,72,10,22,9,7,85,33,9,15,26,36,73,90,53,196,244,109,13,293,50,195,209,108,276,179,126]]};
})(typeof window !== 'undefined' ? window : globalThis);
