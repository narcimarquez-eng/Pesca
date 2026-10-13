/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["11_6"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[59.875,30,15,9,25,5,23,3,6,5,6,17,14,3,20,9,61,8,13,302,280,300,36,354,103,309,319,269,325,321,138,315,112,319,255,56],[59.875,30.125,15,9,25,6,23,4,7,5,6,16,15,3,20,9,60,9,13,303,279,301,35,355,105,307,318,268,326,323,138,312,110,318,254,56]]};
})(typeof window !== 'undefined' ? window : globalThis);
