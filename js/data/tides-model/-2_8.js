/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["-2_8"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[-10,40,19,5,155,155,1080,5,17,3,197,90,48,22,25,542,4,5,36,335,4,357,61,25,145,4,60,3,2,355,349,94,65,152,352,67],[-7.875,40,20,10,169,152,1066,6,14,5,197,100,49,25,31,536,4,6,36,334,32,356,61,25,161,3,15,3,1,355,349,111,64,140,357,64],[-7.75,40,20,9,170,152,1064,6,15,5,196,101,50,25,31,535,4,6,36,334,31,356,61,25,159,2,6,3,1,355,350,110,64,142,358,64],[-7.625,40,19,9,171,152,1064,6,15,4,196,101,50,24,30,535,4,6,36,333,30,356,61,25,159,1,357,3,2,355,351,110,64,144,358,65]]};
})(typeof window !== 'undefined' ? window : globalThis);
