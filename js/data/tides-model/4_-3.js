/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["4_-3"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[24.625,-15,23,4,67,86,783,16,14,5,156,51,15,17,4,330,26,2,18,346,73,30,31,11,71,353,324,358,281,29,242,349,35,295,354,44],[24.75,-15,23,4,67,85,775,15,13,5,154,51,15,17,5,327,26,2,18,346,74,30,31,11,71,352,322,359,281,30,243,338,36,295,353,45],[24.875,-15,23,4,67,84,767,14,13,5,153,51,15,17,6,322,26,2,18,347,76,31,32,12,70,351,319,359,280,31,245,329,36,296,354,46],[24.875,-14.875,23,4,66,84,771,14,13,4,154,51,15,17,5,322,26,2,19,348,75,31,32,12,71,350,318,0,280,31,246,338,37,296,354,47]]};
})(typeof window !== 'undefined' ? window : globalThis);
