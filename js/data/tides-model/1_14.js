/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["1_14"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[5,72.875,3,11,175,25,200,0,16,9,35,88,55,20,4,105,22,8,4,93,1,340,261,199,0,17,355,170,351,336,0,58,253,88,348,211],[5,73,0,10,158,29,201,0,16,9,32,79,50,18,4,114,22,9,4,0,359,340,269,207,0,16,355,180,351,336,1,40,261,85,348,224],[5,73.125,0,9,148,32,208,0,16,10,31,74,46,17,4,121,23,9,4,0,358,340,271,213,0,17,355,187,353,336,1,27,265,84,348,235]]};
})(typeof window !== 'undefined' ? window : globalThis);
