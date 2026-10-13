/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["9_0"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[49.875,0.25,60,6,82,248,2600,100,19,24,498,50,19,12,9,869,37,5,59,259,207,122,346,300,113,229,206,278,17,114,340,45,348,301,205,337],[49.875,0.375,61,5,81,256,2686,106,20,24,513,49,19,12,9,895,37,5,61,260,211,123,348,302,131,230,205,280,18,116,343,49,350,301,205,339],[49.875,0.5,62,5,80,264,2780,124,20,25,529,48,19,12,9,924,37,5,62,262,216,123,349,303,144,230,205,282,19,117,345,53,352,301,205,340]]};
})(typeof window !== 'undefined' ? window : globalThis);
