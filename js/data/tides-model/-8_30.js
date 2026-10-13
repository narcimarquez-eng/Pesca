/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-8_30"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-37.625,150,18,10,161,29,441,6,8,4,101,99,52,22,4,89,27,3,6,291,344,313,308,310,273,189,209,302,283,310,267,36,321,130,185,340],[-37.5,150,19,10,165,29,447,7,8,5,101,101,53,23,3,91,27,3,5,292,346,315,306,309,272,194,216,302,284,313,270,24,321,129,185,340]]};
})(typeof window !== 'undefined' ? window : globalThis);
