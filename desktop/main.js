// Music and Color – învelișul Windows (Electron).
// Încarcă aplicația exportată (folderul app/, produs de `expo export -p web`) printr-un protocol local
// app://, blochează orice cerere spre internet și oferă salvarea fișierelor prin „Salvează ca”.
// Nu se înregistrează la pornirea Windows și nu scrie nimic în registry.

const { app, BrowserWindow, protocol, ipcMain, dialog, session, Menu, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const APP_DIR = path.join(__dirname, 'app');
const MIME = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const WIN_FONTS = new Set(['segoeui.ttf', 'segoeuib.ttf', 'seguisym.ttf']);
const TITLE = 'Music and Color';
// Autotest: folderul în care se scriu fișierele fără fereastra „Salvează ca” (vezi selftest.js).
const SELFTEST = process.env.MUSICCOLOR_SELFTEST || '';

app.setName(TITLE);
// autotestul rulează separat (date proprii), chiar dacă programul e deschis de utilizator
if (SELFTEST) app.setPath('userData', path.join(SELFTEST, '_userdata'));
// Datele interne ale Chromium (cache etc.) stau în %APPDATA%\Music and Color; fișierele utilizatorului nu.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// O singură fereastră: al doilea dublu click aduce fereastra existentă în față.
if (!SELFTEST && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    // app://musiccolor/<cale> → fișierul din app/ (fără ieșire din folder)
    protocol.handle('app', req => {
      const url = new URL(req.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      // fonturile Windows pentru textul partiturii (doar lista de mai jos, citite local)
      const m = /^\/__winfonts\/([a-z]+\.ttf)$/i.exec(rel);
      if (m) {
        if (!WIN_FONTS.has(m[1].toLowerCase())) return new Response('', { status: 404 });
        const font = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', m[1]);
        return fs.existsSync(font) ? net.fetch(pathToFileURL(font).toString()) : new Response('', { status: 404 });
      }
      const file = path.normalize(path.join(APP_DIR, rel));
      if (!file.startsWith(APP_DIR)) return new Response('Interzis', { status: 403 });
      if (!fs.existsSync(file)) {
        // un fișier lipsă (ex. un font pdf.js) primește 404; doar navigarea cade pe index.html
        if (/\.[a-z0-9]+$/i.test(rel)) return new Response('', { status: 404 });
        return net.fetch(pathToFileURL(path.join(APP_DIR, 'index.html')).toString());
      }
      // modulele JS (pdf.js) cer tipul MIME corect ca să poată fi importate
      const type = MIME[path.extname(file).toLowerCase()];
      if (type) return new Response(fs.readFileSync(file), { headers: { 'content-type': type } });
      return net.fetch(pathToFileURL(file).toString());
    });

    // 100% offline: orice cerere în afara aplicației (http, https, ws…) este anulată.
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
      const ok = /^(app|data|blob|devtools|chrome-extension):/i.test(details.url) || details.url.startsWith('file:');
      cb({ cancel: !ok });
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1400, height: 880, minWidth: 1000, minHeight: 640,
      title: TITLE, backgroundColor: '#0e0e12', show: false, autoHideMenuBar: true,
      icon: path.join(__dirname, 'build', 'icon.png'),   // discul TSkyes (bara de titlu și bara de activități)
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
      },
    });
    win.on('page-title-updated', e => e.preventDefault());
    win.once('ready-to-show', () => win.show());
    // linkurile externe nu se deschid nici în aplicație, nici în browser
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
    if (SELFTEST) require('./selftest')(win, SELFTEST);
    win.loadURL('app://musiccolor/index.html' + (SELFTEST && process.env.MUSICCOLOR_SELFTEST_L2 ? '?selftest2' : ''));
  });

  app.on('window-all-closed', () => app.quit());
}

// ── Salvarea pe calculator ─────────────────────────────────────────────────────────────────────
// Implicit în Documente\Music and Color (folderul se creează la nevoie). Mai multe fișiere
// (paginile unei partituri): se alege locul primului, celelalte se pun alături.
const FILTERS = {
  png: ['Imagine PNG', ['png']], jpg: ['Imagine JPEG', ['jpg', 'jpeg']], tiff: ['Imagine TIFF', ['tif', 'tiff']],
  mp3: ['Melodie MP3', ['mp3']], wav: ['Melodie WAV', ['wav']], m4a: ['Melodie AAC', ['m4a']],
};

function defaultDir() {
  const dir = path.join(app.getPath('documents'), TITLE);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* rămâne Documente */ }
  return fs.existsSync(dir) ? dir : app.getPath('documents');
}

function safeName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'MusicColor';
}

ipcMain.handle('save-files', async (event, files) => {
  if (!Array.isArray(files) || !files.length) return [];
  const win = BrowserWindow.fromWebContents(event.sender);
  const first = safeName(files[0].name);
  const ext = path.extname(first).slice(1).toLowerCase();
  const f = FILTERS[ext];
  const res = SELFTEST ? { canceled: false, filePath: path.join(SELFTEST, first) } : await dialog.showSaveDialog(win, {
    title: files.length > 1 ? `Salvează ${files.length} fișiere` : 'Salvează',
    defaultPath: path.join(defaultDir(), first),
    filters: f ? [{ name: f[0], extensions: f[1] }] : [],
    buttonLabel: 'Salvează',
  });
  if (res.canceled || !res.filePath) return [];
  const dir = path.dirname(res.filePath);
  const out = [];
  files.forEach((file, i) => {
    const target = i === 0 ? res.filePath : path.join(dir, safeName(file.name));
    fs.writeFileSync(target, Buffer.from(file.bytes));
    out.push(target);
  });
  return out;
});

ipcMain.handle('show-in-folder', (_e, p) => { if (typeof p === 'string' && fs.existsSync(p)) shell.showItemInFolder(p); });
