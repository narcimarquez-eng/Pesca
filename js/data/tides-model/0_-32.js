/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["0_-32"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[1.625,-157.375,6,6,83,25,269,3,13,10,46,38,26,5,8,87,25,8,6,75,193,207,73,74,263,21,14,73,187,213,166,219,90,296,356,90],[1.625,-157.25,6,7,85,25,272,3,13,10,46,39,27,5,7,87,25,8,6,70,193,208,71,72,262,21,15,72,187,215,167,223,89,297,356,89],[1.625,-157.125,6,7,86,26,278,3,13,11,47,40,28,5,7,88,26,8,6,66,195,209,69,71,264,20,16,70,189,215,170,228,87,298,356,87],[1.75,-157.125,6,7,88,27,284,3,13,11,48,40,28,5,7,91,27,8,7,61,194,210,68,69,279,20,16,67,190,215,177,227,85,297,357,88],[1.875,-157.125,6,8,89,29,289,3,13,11,49,41,28,6,7,94,29,8,7,58,193,211,67,68,289,21,16,66,191,214,184,227,84,297,358,91]]};
})(typeof window !== 'undefined' ? window : globalThis);
