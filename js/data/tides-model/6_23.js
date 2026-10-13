/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["6_23"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[34.5,119.875,42,9,297,131,1509,120,15,8,305,228,83,42,22,437,58,3,26,271,278,258,356,320,241,219,169,292,205,248,172,226,1,248,85,353],[34.625,119.875,41,9,292,128,1480,96,14,8,295,224,82,41,21,428,58,3,27,268,283,257,352,315,236,221,167,288,203,247,172,224,356,248,87,351]]};
})(typeof window !== 'undefined' ? window : globalThis);
