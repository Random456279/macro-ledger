// Builds the app two ways from the same src/:
//   node tools/build.mjs                 -> dist/macro-ledger.html   (artifact: page fragment the claude.ai host wraps)
//   node tools/build.mjs --standalone    -> dist/public/             (own URL: full document + manifest + sw + icons)
//   --out X copies the artifact build to X (the path the Artifact tool publishes). Both can run in one call.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
const args = process.argv.slice(2);
const standalone = args.includes('--standalone');

const result = await build({
  entryPoints: [path.join(root, 'src/js/main.js')],
  bundle: true, format: 'iife', write: false, minify: false, legalComments: 'none',
  target: ['safari15', 'chrome100', 'firefox100'],
});
const js = result.outputFiles[0].text;
if (js.includes('</script')) throw new Error('bundle contains "</script", which would end the inline script early');
const css = rd('src/css/app.css');
// Function replacements: a string replacement would reinterpret "$$" and "$&" inside the code.
const sub = (s, marker, text) => { if (!s.includes(marker)) throw new Error('template lacks ' + marker); return s.replace(marker, () => text); };

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

// Artifact build (always; it is cheap and keeps the two in lockstep)
{
  const tpl = rd('src/index.html');
  const html = sub(sub(tpl, '<!-- CSS -->', '<style>\n' + css + '</style>'), '<!-- JS -->', '<script>\n' + js + '</script>');
  const out = path.join(root, 'dist/macro-ledger.html');
  fs.writeFileSync(out, html);
  const i = args.indexOf('--out');
  if (i > -1 && args[i + 1]) { fs.copyFileSync(out, args[i + 1]); console.log('copied to', args[i + 1]); }
  console.log('built', path.relative(root, out), (html.length / 1024).toFixed(1) + ' KB', 'js', (js.length / 1024).toFixed(1) + ' KB');
}

if (standalone) {
  const pub = path.join(root, 'dist/public');
  fs.rmSync(pub, { recursive: true, force: true });
  fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
  // the markup shell is the artifact template minus its head lines
  const frag = rd('src/index.html');
  const markup = frag.slice(frag.indexOf('<!-- CSS -->') + '<!-- CSS -->'.length, frag.indexOf('<!-- JS -->')).trim();
  let html = rd('src/standalone.html');
  html = sub(html, '<!-- CSS -->', '<style>\n' + css + '</style>');
  html = sub(html, '<!-- MARKUP -->', markup);
  html = sub(html, '<!-- JS -->', '<script>\n' + js + '</script>');
  fs.writeFileSync(path.join(pub, 'index.html'), html);
  const hash = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
  fs.writeFileSync(path.join(pub, 'sw.js'), rd('src/public/sw.js').replace('__BUILD__', () => hash));
  fs.copyFileSync(path.join(root, 'src/public/manifest.webmanifest'), path.join(pub, 'manifest.webmanifest'));
  for (const f of fs.readdirSync(path.join(root, 'src/public/icons'))) fs.copyFileSync(path.join(root, 'src/public/icons', f), path.join(pub, 'icons', f));
  console.log('built dist/public (standalone)', 'build', hash);
}
