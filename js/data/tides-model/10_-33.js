/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["10_-33"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[54.5,-164.125,17,20,427,49,578,0,20,7,133,274,132,50,13,182,28,7,14,277,286,288,352,338,0,182,152,313,273,287,270,113,359,354,186,351],[54.5,-164,17,20,427,49,579,0,20,7,132,274,132,50,13,184,28,7,14,276,286,288,351,337,0,181,153,312,273,287,270,115,358,353,186,350],[54.625,-164,16,19,426,50,586,0,21,7,133,273,132,49,13,185,28,7,15,275,284,288,351,337,0,183,150,312,273,287,270,118,358,353,186,352]]};
})(typeof window !== 'undefined' ? window : globalThis);
