/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["12_30"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[60,154.625,8,90,1584,30,367,19,17,9,53,959,513,164,25,132,10,7,15,349,138,111,156,120,96,181,196,74,66,106,48,257,171,337,183,148],[60.125,154.625,8,90,1600,33,381,19,17,8,55,966,517,165,25,138,9,7,14,346,139,111,155,119,89,181,202,72,65,106,48,252,169,327,183,150],[60.125,154.75,8,90,1595,33,377,19,17,8,55,964,515,164,24,136,9,7,14,344,139,111,154,118,86,181,205,71,65,106,48,249,168,330,182,150],[60.125,154.875,8,91,1589,33,372,18,17,7,55,961,513,164,24,133,8,7,13,342,140,110,152,117,83,181,207,69,65,105,47,246,167,335,181,149],[60.25,154.875,8,91,1611,36,392,18,17,7,58,971,518,165,24,141,8,7,13,338,139,110,152,115,76,180,214,69,64,105,47,241,165,316,182,151]]};
})(typeof window !== 'undefined' ? window : globalThis);
