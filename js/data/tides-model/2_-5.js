/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["2_-5"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[14.75,-24.5,10,3,51,37,399,7,16,7,81,38,10,10,4,129,6,4,7,202,349,346,285,247,290,1,351,224,251,337,194,230,285,273,349,265],[14.75,-24.375,10,3,51,36,396,7,16,7,81,38,11,10,4,128,6,4,7,201,347,345,285,247,289,1,352,223,252,337,195,226,285,275,350,265],[14.75,-24.25,10,4,51,36,393,7,16,7,80,38,11,11,3,127,6,4,7,201,345,344,285,247,288,1,353,223,253,335,197,221,285,280,350,265],[14.875,-24.5,10,3,51,36,390,7,16,7,79,38,10,10,4,125,6,4,6,202,350,346,286,247,293,1,350,224,252,336,195,235,285,266,349,265],[14.875,-24.25,9,3,50,35,370,7,16,7,75,39,11,10,3,119,6,4,6,202,347,343,288,248,291,1,352,224,254,333,200,228,287,276,350,264]]};
})(typeof window !== 'undefined' ? window : globalThis);
