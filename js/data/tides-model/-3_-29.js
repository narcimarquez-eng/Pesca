/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-3_-29"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-14.625,-145,6,2,28,19,285,0,11,6,59,13,5,4,5,72,5,7,3,322,184,235,352,21,0,20,6,359,157,210,112,308,0,113,2,252],[-14.625,-144.875,5,2,28,19,288,0,11,7,60,13,6,5,5,72,5,7,3,324,179,236,353,21,0,20,5,358,157,210,113,306,0,113,2,254],[-14.5,-144.875,5,3,28,20,291,0,11,7,61,14,6,5,5,73,5,7,2,325,180,235,354,21,0,21,6,359,159,209,113,307,1,109,2,259],[-14.375,-145,5,3,30,19,291,0,10,6,60,14,6,4,5,71,5,7,0,327,184,237,358,24,0,22,8,2,166,214,114,310,4,104,2,0],[-14.375,-144.875,5,3,30,20,296,0,10,6,62,14,7,4,5,72,5,7,0,328,181,236,357,23,0,22,7,0,165,212,114,307,4,105,2,0]]};
})(typeof window !== 'undefined' ? window : globalThis);
