// Construiește programul Windows „Music and Color.exe” (portabil, un singur fișier).
//   1. copiază canvaskit.wasm (Skia pentru calculator) în public/
//   2. exportă aplicația pentru web în desktop/app/
//   3. împachetează cu Electron → desktop/release/Music and Color.exe
// Folosire: node scripts/build-desktop.js [--no-pack]
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd, cwd = root) => { console.log(`\n> ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }); };

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.copyFileSync(
  path.join(root, 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm'),
  path.join(root, 'public/canvaskit.wasm'),
);
// pdf.js (citirea partiturilor PDF la Nivelul 3): modulul, worker-ul și fonturile standard
const pdfSrc = path.join(root, 'node_modules/pdfjs-dist');
const pdfDst = path.join(root, 'public/pdfjs');
fs.rmSync(pdfDst, { recursive: true, force: true });
fs.mkdirSync(path.join(pdfDst, 'standard_fonts'), { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(pdfSrc, 'build', f), path.join(pdfDst, f));
for (const f of fs.readdirSync(path.join(pdfSrc, 'standard_fonts'))) {
  fs.copyFileSync(path.join(pdfSrc, 'standard_fonts', f), path.join(pdfDst, 'standard_fonts', f));
}

const appDir = path.join(root, 'desktop/app');
fs.rmSync(appDir, { recursive: true, force: true });
run('npx expo export -p web --output-dir desktop/app');

if (!process.argv.includes('--no-pack')) {
  const desk = path.join(root, 'desktop');
  run('npm install --no-audit --no-fund', desk);
  run('npm run dist', desk);
  console.log(`\nGata: ${path.join(desk, 'release', 'Music and Color.exe')}`);
}
