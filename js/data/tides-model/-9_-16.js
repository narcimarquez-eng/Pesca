/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-9_-16"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-45,-75.25,16,12,182,49,423,3,14,10,110,125,54,22,3,162,10,4,5,59,73,65,114,119,135,162,178,93,22,63,359,234,119,143,191,114],[-45,-75.125,16,12,182,49,427,3,14,10,111,125,54,22,3,163,10,5,5,60,73,65,114,119,137,162,179,93,22,63,359,223,119,147,192,117],[-44.875,-75.25,16,12,181,49,423,3,14,10,110,124,54,22,3,161,10,4,5,60,70,64,114,118,129,161,178,92,21,62,358,229,119,143,191,115],[-44.75,-75.25,16,11,179,48,420,3,14,10,109,123,54,22,3,161,10,4,5,60,69,64,113,117,122,161,179,92,21,62,359,229,119,143,192,115],[-44.75,-75.125,16,12,177,48,423,3,14,10,110,122,53,22,5,161,10,4,5,61,70,64,113,118,121,160,180,92,22,63,0,225,119,146,192,118]]};
})(typeof window !== 'undefined' ? window : globalThis);
