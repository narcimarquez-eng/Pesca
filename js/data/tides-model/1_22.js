/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["1_22"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[5,114.625,6,13,362,26,206,3,13,8,44,314,117,59,13,94,41,5,7,118,205,193,109,92,181,13,40,82,153,191,137,344,122,316,336,148],[5,114.75,7,13,365,27,211,4,13,8,47,316,118,60,13,97,41,5,8,121,207,193,108,92,194,13,38,82,152,191,137,343,122,315,335,150],[5,114.875,8,12,366,28,216,4,13,9,49,317,118,61,13,100,41,5,8,122,209,194,107,91,206,14,37,82,152,191,136,341,122,314,335,151],[5.125,114.875,7,13,367,29,218,5,12,9,49,318,118,61,13,100,41,5,8,119,207,193,108,91,204,13,36,82,152,191,137,343,121,315,335,152]]};
})(typeof window !== 'undefined' ? window : globalThis);
