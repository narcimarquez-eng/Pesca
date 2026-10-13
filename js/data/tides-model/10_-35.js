/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["10_-35"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[52,-173.625,10,20,397,21,273,0,20,7,71,265,126,46,10,70,10,8,6,310,310,304,353,5,0,174,174,340,288,305,281,127,4,302,174,329],[52,-173.5,10,18,381,23,274,0,21,6,70,257,119,45,9,75,11,8,6,309,312,305,352,2,0,179,174,338,288,306,281,128,3,304,173,329],[52.125,-173.5,12,21,402,14,179,4,20,7,63,276,127,47,11,36,11,7,5,359,337,329,305,89,271,171,177,37,311,328,302,139,293,305,175,295],[52.25,-173.5,12,21,390,13,172,4,20,8,64,272,124,46,11,35,11,7,5,357,339,332,310,87,273,171,178,36,313,329,304,138,295,303,177,295]]};
})(typeof window !== 'undefined' ? window : globalThis);
