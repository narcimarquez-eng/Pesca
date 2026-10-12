#!/usr/bin/env node
/**
 * Comprueba los textos traducibles de PescaApp.
 *
 * - Extrae las claves (texto castellano) de las llamadas t(...) y mark(...) de js/*.js y de
 *   los elementos data-i18n / data-i18n-attrs de index.html.
 * - Lee cada catálogo js/i18n/<idioma>.js y comprueba que sus marcadores {nombre} coinciden
 *   con los del texto original.
 * - Informa de la cobertura de cada idioma (las claves que faltan usan inglés).
 *
 * Uso: node tools/i18n-check.mjs [--keys ruta.json]
 * Sale con código 1 si hay errores (marcadores distintos o claves dinámicas).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const normalize = (text) => String(text).replace(/\s+/g, ' ').trim();
const placeholders = (text) => [...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');

function listFiles(dir, predicate) {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile() && predicate(path));
}

/** Llamadas t('…') y mark('…') con literal. Las plantillas con ${} se marcan como errores. */
function extractCalls(code, file, problems) {
  const keys = [];
  const pattern = /(?<![\w.$])(?:PescaApp\.i18n\.)?(t|mark)\(\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
  for (const match of code.matchAll(pattern)) {
    const literal = match[3];
    if (match[2] === '`' && literal.includes('${')) {
      problems.push(`${file}: clave dinámica en ${match[1]}(\`${literal.slice(0, 40)}…\`)`);
      continue;
    }
    keys.push(normalize(literal.replace(/\\(['"`\\])/g, '$1')));
  }
  return keys;
}

/** Elementos data-i18n (contenido) y data-i18n-attrs (atributos) de index.html. */
function extractHtml(html) {
  const keys = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w-]*)((?:\s[^>]*?)?)\s*(\/?)>/g;
  const stack = [];
  let match;
  while ((match = tagPattern.exec(html))) {
    const [whole, closing, name, attrs, selfClosing] = match;
    const tag = name.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === tag) {
          const open = stack[i];
          stack.length = i;
          if (open.i18n) keys.push(normalize(html.slice(open.end, match.index)));
          break;
        }
      }
      continue;
    }
    const attributes = [...attrs.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)];
    const attr = (wanted) => attributes.find((item) => item[1] === wanted);
    const i18nAttrs = attr('data-i18n-attrs');
    if (i18nAttrs && i18nAttrs[2]) {
      i18nAttrs[2].split(/\s+/).filter(Boolean).forEach((name2) => {
        const value = attr(name2);
        if (value && value[2]) keys.push(normalize(value[2]));
      });
    }
    if (!selfClosing && !VOID.has(tag)) {
      stack.push({ name: tag, i18n: Boolean(attr('data-i18n')), end: match.index + whole.length });
    }
  }
  return keys;
}

function collectSourceKeys(problems) {
  const jsFiles = [
    ...listFiles(join(ROOT, 'js'), (path) => path.endsWith('.js')),
  ].filter((path) => !relative(join(ROOT, 'js'), path).startsWith('vendor') && !relative(join(ROOT, 'js'), path).startsWith('data'));
  const keys = new Set();
  jsFiles.forEach((file) => extractCalls(readFileSync(file, 'utf8'), relative(ROOT, file), problems).forEach((key) => keys.add(key)));
  extractHtml(readFileSync(join(ROOT, 'index.html'), 'utf8')).forEach((key) => keys.add(key));
  return [...keys].filter(Boolean).sort();
}

function loadCatalogs() {
  const dir = join(ROOT, 'js', 'i18n');
  return listFiles(dir, (path) => path.endsWith('.js')).map((file) => {
    const code = file.split('/').pop().replace(/\.js$/, '');
    const captured = {};
    const sandbox = { PescaApp: { i18n: { register: (name, messages) => { captured.name = name; captured.messages = messages; } } } };
    vm.runInNewContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
    return { code, registeredAs: captured.name, messages: captured.messages || {} };
  });
}

const problems = [];
const sourceKeys = collectSourceKeys(problems);
const catalogs = loadCatalogs();
const failures = [...problems];
const keysOut = process.argv.indexOf('--keys');
if (keysOut !== -1) writeFileSync(process.argv[keysOut + 1], `${JSON.stringify(sourceKeys, null, 2)}\n`);

console.log(`Claves de origen: ${sourceKeys.length}`);
for (const catalog of catalogs) {
  const table = Object.fromEntries(Object.entries(catalog.messages).map(([key, value]) => [normalize(key), value]));
  if (catalog.registeredAs !== catalog.code) failures.push(`${catalog.code}.js registra "${catalog.registeredAs}"`);
  const missing = sourceKeys.filter((key) => !(key in table) || table[key] === '');
  const unknown = Object.keys(table).filter((key) => !sourceKeys.includes(key));
  let mismatches = 0;
  for (const key of sourceKeys) {
    if (!(key in table) || table[key] === '') continue;
    if (placeholders(key) !== placeholders(table[key])) {
      mismatches += 1;
      failures.push(`${catalog.code}: marcadores distintos en «${key.slice(0, 60)}»`);
    }
  }
  const coverage = Math.round(((sourceKeys.length - missing.length) / Math.max(sourceKeys.length, 1)) * 100);
  console.log(`${catalog.code.padEnd(8)} cobertura ${String(coverage).padStart(3)} %  faltan ${missing.length}  sobran ${unknown.length}  marcadores incorrectos ${mismatches}`);
}
problems.forEach((problem) => console.log(`ERROR ${problem}`));
failures.filter((item) => !problems.includes(item)).forEach((item) => console.log(`ERROR ${item}`));
process.exit(failures.length ? 1 : 0);
