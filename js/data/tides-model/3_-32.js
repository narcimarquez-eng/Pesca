/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["3_-32"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[18.875,-155.875,5,10,155,23,231,2,7,4,43,85,49,14,5,87,16,5,3,47,206,226,58,51,183,33,42,41,214,221,203,319,59,277,5,133],[19,-156,6,11,153,23,226,3,7,4,41,84,48,13,4,83,16,5,4,50,205,226,60,52,193,37,38,43,215,221,205,326,61,275,5,147],[19.25,-155.125,5,11,163,25,244,0,9,4,46,90,52,16,4,101,13,5,4,7,210,227,43,41,0,45,22,29,215,224,200,260,48,281,5,58]]};
})(typeof window !== 'undefined' ? window : globalThis);
