/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-4_6"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-20,34.875,27,2,18,260,1643,57,13,10,258,46,9,17,32,948,12,4,60,21,340,70,89,52,122,358,6,36,344,124,307,84,92,57,359,93],[-19.875,34.75,28,2,18,263,1669,60,13,10,262,47,10,17,33,963,12,4,61,22,334,71,90,53,123,358,7,37,344,123,307,82,93,58,359,93],[-19.875,34.875,27,2,18,261,1653,56,13,10,259,47,10,17,32,953,12,4,60,23,340,71,90,53,123,359,6,37,344,123,307,82,93,57,359,93],[-19.75,34.75,29,2,19,266,1690,77,13,11,264,47,10,17,34,976,12,4,63,24,336,72,90,54,122,358,5,38,344,122,307,80,94,58,359,94]]};
})(typeof window !== 'undefined' ? window : globalThis);
