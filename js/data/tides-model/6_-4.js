/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["6_-4"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[32.375,-16.5,23,4,58,77,724,9,4,0,155,44,18,15,8,271,28,0,16,15,56,48,64,46,132,1,0,32,305,31,250,5,69,274,0,69],[32.375,-16.375,23,4,58,78,736,9,4,0,157,45,19,16,8,275,28,0,16,15,59,48,65,46,134,0,0,32,306,32,250,6,69,273,0,68],[32.5,-16.375,23,4,59,79,748,9,4,0,160,45,19,16,8,278,27,0,16,16,60,49,66,47,134,358,0,33,306,33,250,5,70,275,0,68],[32.625,-16.375,24,4,59,80,754,9,4,0,161,45,19,16,8,280,27,0,17,17,59,49,66,48,134,356,0,33,307,33,250,4,71,276,0,68],[32.875,-17.25,23,4,62,77,726,9,4,0,155,44,19,14,9,270,28,0,16,15,57,51,65,47,123,347,0,31,306,38,250,3,70,280,0,64]]};
})(typeof window !== 'undefined' ? window : globalThis);
