/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["12_6"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[60,30,15,9,25,6,23,4,6,5,7,16,14,3,20,10,61,9,14,301,283,298,40,355,105,307,315,268,325,322,134,313,109,319,255,59],[64.5,34.875,17,5,84,35,582,62,11,0,120,9,29,18,19,129,37,9,8,28,150,80,147,99,132,245,0,74,339,52,176,243,146,267,170,117]]};
})(typeof window !== 'undefined' ? window : globalThis);
