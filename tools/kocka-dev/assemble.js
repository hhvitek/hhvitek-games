// Copies the Kočka source blocks (tools/kocka-dev/src/*.js) into games/kocka/index.html between their markers.
// During development the source files are the truth; the shipped game stays one HTML file (project rule).
// Usage: node tools/kocka-dev/assemble.js        (then node tools/check.js kocka)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const GAME = path.join(ROOT, 'games', 'kocka', 'index.html');
const BLOCKS = [['Cat art', 'art.js'], ['Input', 'input.js'], ['Life engine', 'engine.js']];
let html = fs.readFileSync(GAME, 'utf8');
for (const [name, file] of BLOCKS) {
  const start = `/* ---------- ${name} ---------- */`, end = `/* ---------- ${name} end ---------- */`;
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < a) { console.error(`marker "${name}" missing in games/kocka/index.html`); process.exit(1); }
  const src = fs.readFileSync(path.join(__dirname, 'src', file), 'utf8').replace(/\r\n/g, '\n').trim();
  if (src.includes('</script')) { console.error(`${file} contains "</script": it would end the inline script`); process.exit(1); }
  html = html.slice(0, a + start.length) + '\n' + src + '\n' + html.slice(b);
}
fs.writeFileSync(GAME, html);
console.log('assembled games/kocka/index.html from', BLOCKS.map(b => b[1]).join(', '));
