/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["11_34"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[59.875,170.125,9,24,401,16,295,0,24,11,70,276,124,51,12,58,13,10,0,7,347,340,171,104,0,181,177,56,323,339,315,150,172,332,180,0],[59.875,170.25,9,24,404,16,296,0,24,11,70,278,125,51,13,57,13,10,0,7,347,340,171,104,0,181,177,56,323,339,315,150,172,329,181,0],[59.875,170.375,9,24,404,15,296,0,24,11,70,277,126,52,12,56,13,10,0,8,347,340,170,103,0,181,177,55,323,338,315,150,170,326,181,0],[59.875,170.5,9,23,403,14,295,0,24,11,70,277,126,52,12,55,13,10,0,8,347,339,168,102,0,181,177,55,323,338,314,149,169,322,181,0]]};
})(typeof window !== 'undefined' ? window : globalThis);
