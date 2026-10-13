/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-10_14"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-49.75,70,14,3,54,41,423,0,11,8,98,16,16,4,8,154,23,7,8,113,97,128,206,171,0,212,217,153,17,113,349,96,209,48,179,214],[-49.75,70.125,14,2,55,44,434,0,11,8,99,11,16,3,7,163,23,7,9,117,103,133,211,175,0,211,215,157,36,119,2,94,214,48,179,218],[-49.75,70.25,14,0,55,46,439,0,11,9,99,6,15,0,7,169,23,7,10,121,0,141,217,180,0,209,213,161,85,128,0,86,220,47,179,224],[-49.75,70.375,13,0,51,46,433,0,11,9,97,6,14,0,6,171,23,7,10,124,0,148,222,183,0,208,211,165,187,136,0,81,225,46,179,228],[-49,70.5,11,0,44,63,445,2,11,7,92,48,11,11,8,227,23,7,15,166,0,200,264,221,334,210,210,203,237,195,233,62,264,48,179,268],[-49,70.625,11,0,43,61,438,0,11,7,91,44,11,11,7,220,22,6,15,162,0,197,261,218,0,209,208,200,237,191,234,63,261,48,179,266]]};
})(typeof window !== 'undefined' ? window : globalThis);
