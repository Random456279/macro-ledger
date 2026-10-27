// Bundles src/ into the single HTML file the app is published from.
//   node tools/build.mjs            -> dist/macro-ledger.html
//   node tools/build.mjs --out X    -> also copies the result to X (the path the Artifact tool publishes)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');

const result = await build({
  entryPoints: [path.join(root, 'src/js/main.js')],
  bundle: true, format: 'iife', write: false, minify: false, legalComments: 'none',
  target: ['safari15', 'chrome100', 'firefox100'],
});
let js = result.outputFiles[0].text;
if (js.includes('</script')) throw new Error('bundle contains "</script", which would end the inline script early');

const css = rd('src/css/app.css');
const tpl = rd('src/index.html');
if (!tpl.includes('<!-- CSS -->') || !tpl.includes('<!-- JS -->')) throw new Error('src/index.html needs <!-- CSS --> and <!-- JS --> placeholders');
// Function replacements: a string replacement would reinterpret "$$" and "$&" inside the code.
const html = tpl.replace('<!-- CSS -->', () => '<style>\n' + css + '</style>').replace('<!-- JS -->', () => '<script>\n' + js + '</script>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/macro-ledger.html');
fs.writeFileSync(out, html);
const i = process.argv.indexOf('--out');
if (i > -1 && process.argv[i + 1]) { fs.copyFileSync(out, process.argv[i + 1]); console.log('copied to', process.argv[i + 1]); }
console.log('built', path.relative(root, out), (html.length / 1024).toFixed(1) + ' KB', 'js', (js.length / 1024).toFixed(1) + ' KB');
