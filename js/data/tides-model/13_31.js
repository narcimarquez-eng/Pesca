/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["13_31"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[69.875,159.875,0,2,15,9,73,8,18,12,9,9,6,0,6,26,0,13,2,0,290,197,20,113,290,288,240,98,167,211,0,331,189,0,187,159]]};
})(typeof window !== 'undefined' ? window : globalThis);
