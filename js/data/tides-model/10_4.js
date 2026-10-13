/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["10_4"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[54.625,20,0,4,13,7,17,0,3,3,0,10,9,5,20,3,34,4,7,0,85,222,39,340,0,337,274,0,227,243,122,354,295,298,235,331],[54.625,20.125,0,4,14,7,17,0,2,3,0,10,10,5,20,4,34,4,7,0,84,224,39,338,0,330,275,0,227,244,124,357,290,299,234,331],[54.625,20.25,2,4,14,7,17,0,3,3,2,10,10,6,21,5,34,4,7,69,82,226,39,336,0,323,274,359,226,245,125,359,287,299,234,331]]};
})(typeof window !== 'undefined' ? window : globalThis);
