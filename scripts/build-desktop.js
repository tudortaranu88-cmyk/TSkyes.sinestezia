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

const appDir = path.join(root, 'desktop/app');
fs.rmSync(appDir, { recursive: true, force: true });
run('npx expo export -p web --output-dir desktop/app');

if (!process.argv.includes('--no-pack')) {
  const desk = path.join(root, 'desktop');
  run('npm install --no-audit --no-fund', desk);
  run('npm run dist', desk);
  console.log(`\nGata: ${path.join(desk, 'release', 'Music and Color.exe')}`);
}
