/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["9_-26"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[49.375,-126.625,21,24,432,74,972,4,14,7,202,268,132,49,13,278,26,5,22,195,238,242,261,239,257,163,173,215,227,240,220,85,268,359,184,263],[49.375,-126.5,21,24,429,74,974,5,14,7,203,266,131,49,14,278,28,5,22,195,238,242,261,239,253,163,174,215,227,240,220,87,268,0,185,262],[49.5,-126.875,21,25,435,74,972,5,14,7,202,270,133,50,14,280,24,5,22,196,238,243,262,240,266,164,169,216,227,241,219,89,269,356,182,263],[49.5,-126.75,21,25,434,75,976,5,14,7,203,270,133,50,14,281,26,5,23,195,238,242,262,239,263,164,171,216,227,241,220,90,269,358,183,263],[49.5,-126.625,21,25,433,75,979,5,14,7,204,269,132,50,14,281,27,5,23,195,238,242,261,239,259,164,173,215,227,241,220,92,268,0,184,262],[49.625,-127,21,25,437,75,973,4,14,8,202,272,133,50,14,281,23,5,23,196,238,243,263,240,270,164,166,216,228,242,219,91,270,355,182,261]]};
})(typeof window !== 'undefined' ? window : globalThis);
