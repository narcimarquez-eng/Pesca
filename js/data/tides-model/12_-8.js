/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["12_-8"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[64.875,-40,32,6,139,113,1005,13,17,14,193,69,44,8,13,402,19,13,22,169,178,146,241,204,229,221,230,182,112,148,57,73,241,300,174,228],[64.875,-39.875,32,5,139,112,1000,13,17,14,192,69,43,7,12,400,19,13,22,169,177,146,241,204,228,221,230,182,112,148,56,73,241,300,174,229],[64.875,-39.75,32,5,139,111,997,13,17,14,191,69,43,7,12,398,19,13,21,169,176,146,241,203,227,220,230,182,112,147,56,72,241,300,174,230],[64.875,-39.625,31,5,139,111,994,12,17,14,190,69,42,7,11,397,18,13,21,168,175,146,241,203,226,219,229,182,111,147,56,70,241,300,174,230]]};
})(typeof window !== 'undefined' ? window : globalThis);
