/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["3_-6"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[16.875,-25.375,9,2,43,33,323,7,14,7,64,39,10,11,6,111,6,4,5,216,5,348,303,262,300,0,349,237,255,346,212,282,305,294,356,270],[17,-25.375,9,2,42,32,309,7,14,7,61,40,10,11,7,107,6,4,5,216,3,348,307,264,300,0,348,238,256,347,213,286,308,295,357,271],[17.125,-25.375,8,2,41,32,300,7,14,7,58,40,9,12,7,108,6,4,5,220,2,350,312,269,304,0,347,243,256,349,214,289,313,295,357,277],[17.125,-25.25,8,3,41,33,296,8,13,7,57,41,10,11,7,110,6,4,5,226,3,351,316,273,307,1,349,247,256,350,216,287,317,295,357,284],[17.25,-25.25,7,3,41,32,284,8,13,7,54,41,9,11,8,108,6,4,4,226,1,351,319,275,306,1,349,249,257,350,216,290,320,295,357,288],[17.25,-25.125,7,3,41,32,279,8,13,7,53,41,9,11,8,108,6,4,4,230,3,351,321,278,307,0,349,252,257,350,217,290,323,295,357,291]]};
})(typeof window !== 'undefined' ? window : globalThis);
