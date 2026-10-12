/**
 * Empaqueta @neaps/tide-predictor en un único script clásico (IIFE), para que la
 * app lo use en el navegador sin módulos ES. Así también funciona abriendo
 * index.html directamente (file://).
 *
 * Uso: npm run build:vendor
 * El resultado (js/vendor/tide-predictor.js) se versiona en el repositorio.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'js', 'vendor');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tide-predictor.js');

const packageInfo = JSON.parse(
  await readFile(path.join(ROOT, 'node_modules', '@neaps', 'tide-predictor', 'package.json'), 'utf8')
);

const result = await build({
  stdin: {
    contents: "export { createTidePredictor } from '@neaps/tide-predictor';",
    resolveDir: ROOT,
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  globalName: 'PescaVendorTide',
  platform: 'browser',
  target: 'es2019',
  minify: true,
  legalComments: 'none',
  write: false,
});

const bundled = result.outputFiles[0].text;
const header = `/*!
 * @neaps/tide-predictor ${packageInfo.version} · Licencia ${packageInfo.license}
 * Autor: ${packageInfo.author || 'ver el paquete original'}
 * Código original: ${packageInfo.repository ? packageInfo.repository.url : 'https://github.com/openwatersio/neaps'}
 *
 * Copyright de sus autores. Se distribuye bajo la licencia MIT: se concede
 * permiso, sin cargo, para usar, copiar, modificar, fusionar, publicar,
 * distribuir, sublicenciar y vender copias del software, con la única condición
 * de incluir este aviso de copyright y de permiso en todas las copias.
 *
 * Generado por tools/build-vendor.mjs. No editar a mano.
 */`;

const wrapped = `${header}
(function (root) {
  'use strict';
  const PescaApp = (root.PescaApp = root.PescaApp || {});
${bundled}
  PescaApp.vendor = Object.freeze({ createTidePredictor: PescaVendorTide.createTidePredictor });
})(typeof window !== 'undefined' ? window : globalThis);
`;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, wrapped, 'utf8');
console.log(`Predictor ${packageInfo.version} empaquetado en ${path.relative(ROOT, OUTPUT_FILE)} (${wrapped.length} bytes).`);
