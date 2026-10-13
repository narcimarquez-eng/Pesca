/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-16_-23"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-75.125,-111,16,24,343,61,78,17,27,16,78,290,108,61,8,181,0,15,11,162,120,119,140,248,147,197,189,198,99,115,90,89,152,0,181,127],[-75.125,-110.375,16,24,342,60,77,16,27,16,78,289,107,60,8,180,0,15,11,162,120,118,140,247,145,197,189,198,99,115,90,89,151,0,182,127],[-75.125,-110.25,16,24,343,60,77,15,27,16,78,290,108,60,8,180,0,15,11,162,120,118,140,247,145,197,189,197,99,115,90,88,151,0,182,127],[-75.125,-110.125,16,24,344,60,77,15,27,16,77,291,108,61,7,179,0,15,11,162,120,118,139,246,144,197,189,197,98,115,90,88,151,0,182,126]]};
})(typeof window !== 'undefined' ? window : globalThis);
