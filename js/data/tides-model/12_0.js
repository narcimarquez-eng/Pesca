/* Generado por tools/build-tide-model.mjs. No editar a mano.
 * Puntos de modelo de marea: constantes armónicas del modelo global EOT20 en la franja costera.
 * EOT20: Hart-Davis, M. G. et al. (2021), DGFI-TUM, https://doi.org/10.17882/79489, licencia CC BY 4.0.
 * Cada punto: [lat, lon, amplitudes en mm..., fases en grados...] en el orden de `constituents`.
 */
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
  PescaApp.tideModelTiles = PescaApp.tideModelTiles || {};
  PescaApp.tideModelTiles["12_0"] = {"model":"eot20","name":"EOT20","source":"DGFI-TUM","sourceUrl":"https://doi.org/10.17882/79489","license":"cc-by-4.0","constituents":["2N2","J1","K1","K2","M2","M4","MF","MM","N2","O1","P1","Q1","S1","S2","SA","SSA","T2"],"points":[[60.75,4.75,12,0,33,44,439,8,18,10,85,31,8,12,5,157,33,11,11,238,0,163,313,279,271,206,190,258,8,159,305,69,319,312,181,313],[60.75,4.875,12,0,33,43,437,8,18,9,84,31,8,12,5,156,34,11,11,237,0,163,313,278,275,206,189,257,7,160,305,68,319,313,181,313],[60.875,4.75,13,0,34,45,452,8,18,10,88,31,8,12,5,161,33,11,11,237,0,162,313,279,273,205,191,257,8,156,303,67,318,313,181,311],[61.5,4.875,15,0,38,50,525,4,19,11,104,35,10,13,3,183,36,11,11,239,0,157,316,281,294,200,197,258,7,148,303,33,320,315,181,309]]};
})(typeof window !== 'undefined' ? window : globalThis);
