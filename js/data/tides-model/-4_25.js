/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-4_25"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-15.125,125.375,36,19,306,497,2460,81,13,11,399,175,93,40,23,1656,26,3,100,11,203,188,140,78,110,306,235,53,181,188,176,339,143,96,144,148],[-15.125,129.625,53,46,701,352,2497,145,12,20,452,329,189,82,44,1170,41,2,71,266,257,213,345,296,172,64,24,279,199,214,194,36,351,45,30,355]]};
})(typeof window !== 'undefined' ? window : globalThis);
