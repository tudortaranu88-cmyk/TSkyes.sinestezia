// Autotest (doar când e setată variabila MUSICCOLOR_SELFTEST=<folder>): cântă câteva note,
// salvează imaginea (PNG/JPEG/TIFF) și melodia (MP3/WAV/AAC) în <folder>, face o captură și închide.
const fs = require('fs');
const path = require('path');

const RENDERER = `(async () => {
  const log = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const all = t => [...document.querySelectorAll('[tabindex]')].filter(d => d.textContent === t);
  const fire = (el, hold) => new Promise(async res => {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o));
    await sleep(hold);
    const u = { ...o, buttons: 0 };
    el.dispatchEvent(new PointerEvent('pointerup', u)); el.dispatchEvent(new MouseEvent('mouseup', u)); el.dispatchEvent(new MouseEvent('click', u));
    res();
  });
  for (const f of ['segoeui.ttf', 'seguisym.ttf']) {
    try { const r = await fetch('/__winfonts/' + f); log.push('font ' + f + ': ' + r.status + ' ' + (await r.arrayBuffer()).byteLength); }
    catch (e) { log.push('font ' + f + ': ' + e.message); }
  }
  const L2 = location.search.includes('selftest2');
  if (L2) {
    for (let i = 0; i < 100 && !all('▶ Ascultă').length; i++) await sleep(100);
    log.push('Nivelul 2: ' + (all('▶ Ascultă').length ? 'deschis' : 'NU s-a deschis'));
    await sleep(1000);
  } else {
    for (let i = 0; i < 100 && !all('Sol').length; i++) await sleep(100);
    log.push('taste: ' + all('Sol').length);
    for (const n of ['Do', 'Mi', 'Sol', 'Do+1', 'Si-1', 'Re', 'Fa+2', 'La-2']) {
      const k = all(n)[0]; if (k) { await fire(k, 250); await sleep(120); } else log.push('lipsește ' + n);
    }
    await sleep(1500);
  }
  log.push('Salvează activ: ' + (all('Salvează')[0]?.getAttribute('aria-disabled') !== 'true'));
  try {
    const s = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 1, bitrate: 128000 });
    log.push('AAC suportat: ' + s.supported);
  } catch (e) { log.push('AAC: ' + e.message); }
  await fire(all('Salvează')[0], 30);
  await sleep(500);
  const status = () => [...document.querySelectorAll('div')].map(d => d.textContent).filter(t => /^(Salvat:|Nu a reușit|Salvarea|\\d+ fișiere salvate)/.test(t)).pop();
  const runOne = async (chip, btnIdx) => {
    await fire(all(chip)[0], 30); await sleep(200);
    await fire(all('Salvează pe calculator')[btnIdx], 30);
    let s;
    for (let i = 0; i < 300; i++) { await sleep(100); s = status(); if (s && !s.startsWith('Se ')) break; }
    log.push(chip + ' → ' + s);
    await sleep(300);
  };
  for (const c of L2 ? ['PNG', 'JPEG'] : ['PNG', 'JPEG', 'TIFF']) await runOne(c, 0);
  for (const c of L2 ? ['MP3'] : ['MP3', 'WAV', 'AAC']) await runOne(c, 1);
  return log;
})()`;

// Nivelul 3: paginile reale (PNG) → trase în fereastră (drag and drop) în trei variante:
//  A. exact cum le-a exportat aplicația; B. „scanate” (rotite, neclare, decolorate, hârtie
//  îngălbenită, JPEG); C. aceleași scanări puse într-un PDF (câte o imagine JPEG pe pagină, ca la scaner).
const RENDERER_L3 = `(async () => {
  const log = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const all = t => [...document.querySelectorAll('[tabindex]')].filter(d => d.textContent === t);
  const click = el => { const r = el.getBoundingClientRect(); const o = { bubbles: true, clientX: r.x + 5, clientY: r.y + 5, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })); el.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 })); el.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0 })); };
  for (let i = 0; i < 100 && !all('N3').length; i++) await sleep(100);
  click(all('N3')[0]);
  await sleep(800);
  const pages = __PAGES__;
  log.push('pagini sursă: ' + pages.length);
  const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const orig = pages.map(p => new File([bytes(p.b64)], p.name, { type: 'image/png' }));

  // „scanarea”: rotire 0,9°, scară 1,4, neclaritate, saturație −30%, sepia, JPEG 85%
  const scanned = [];
  for (const f of orig) {
    const bmp = await createImageBitmap(f);
    const W = Math.round(bmp.width * 1.4) + 120, H = Math.round(bmp.height * 1.4) + 160;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#f4efe2'; x.fillRect(0, 0, W, H);
    x.translate(W / 2, H / 2); x.rotate(0.9 * Math.PI / 180); x.scale(1.4, 1.4);
    x.filter = 'blur(0.8px) saturate(70%) sepia(18%) contrast(92%) brightness(97%)';
    x.globalCompositeOperation = 'multiply';
    x.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    scanned.push({ file: new File([blob], f.name.replace('.png', '_scan.jpg'), { type: 'image/jpeg' }), w: W, h: H, jpg: new Uint8Array(await blob.arrayBuffer()) });
  }

  // PDF minimal: o pagină A4 pe scanare, cu imaginea JPEG (DCTDecode) întinsă pe toată pagina
  const enc = new TextEncoder();
  const parts = []; const offs = []; let len = 0;
  const add = d => { const b = typeof d === 'string' ? enc.encode(d) : d; parts.push(b); len += b.length; };
  add('%PDF-1.4\\n');
  const n = scanned.length;
  const obj = (id, body) => { offs[id] = len; add(id + ' 0 obj\\n'); for (const b of [].concat(body)) add(b); add('\\nendobj\\n'); };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Count ' + n + ' /Kids [' + scanned.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>');
  scanned.forEach((s, i) => {
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
    const pw = 595, ph = Math.round(595 * s.h / s.w);
    obj(pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>');
    const cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    obj(cid, ['<< /Length ' + cs.length + ' >>\\nstream\\n', cs, '\\nendstream']);
    obj(iid, ['<< /Type /XObject /Subtype /Image /Width ' + s.w + ' /Height ' + s.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + s.jpg.length + ' >>\\nstream\\n', s.jpg, '\\nendstream']);
  });
  const xref = len; const total = 3 + n * 3;
  add('xref\\n0 ' + total + '\\n0000000000 65535 f \\n');
  for (let i = 1; i < total; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \\n');
  add('trailer\\n<< /Size ' + total + ' /Root 1 0 R >>\\nstartxref\\n' + xref + '\\n%%EOF');
  const pdf = new File(parts, 'partitura_scanata.pdf', { type: 'application/pdf' });

  const info = () => [...document.querySelectorAll('div')].map(d => d.textContent).filter(t => /reconstruite|Pagina|Nu |nu pare|Banda|Trage/.test(t) && t.length < 400).pop();
  const drop = async (files, label) => {
    window.__mcMelody = null;
    const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
    const target = [...document.querySelectorAll('div')].find(d => /partituri/.test(d.textContent) && d.children.length === 0) || document.body;
    for (const t of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
    for (let i = 0; i < 300 && !window.__mcMelody; i++) { await sleep(100); if (/Pagina|nu pare|Banda|Trage/.test(info() || '')) break; }
    await sleep(300);
    const m = window.__mcMelody || [];
    log.push(label + ': ' + (info() || '(fără mesaj)'));
    const dbg = (window.__mcDecodeDebug || []).map(d => { const { cells, midis, strip, ...rest } = d || {}; return rest; });
    log.push('   ' + JSON.stringify(dbg, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
    return m;
  };
  const A = await drop(orig, 'A. PNG exportate');
  const B = await drop(scanned.map(s => s.file), 'B. scanate (JPEG)');
  const C = await drop([pdf], 'C. PDF scanat');
  const same = (x, y) => x.length === y.length && x.every((v, i) => v[0] === y[i][0] && v[1] === y[i][1] && v[2] === y[i][2]);
  const midiEq = (x, y) => { const f = a => a.flatMap(v => Array(v[2]).fill(v[0] * 100 + v[1])); const p = f(x), q = f(y); let k = 0; for (let i = 0; i < Math.min(p.length, q.length); i++) if (p[i] === q[i]) k++; return k + '/' + p.length + ' pătrimi identice'; };
  log.push('B față de A: ' + (same(A, B) ? 'IDENTIC' : midiEq(A, B)));
  log.push('C față de A: ' + (same(A, C) ? 'IDENTIC' : midiEq(A, C)));
  log.push('JSON ' + JSON.stringify({ A, B, C }));
  window.__mcDebugLast = true;
  return log;
})()`;

module.exports = function runSelfTest(win, outDir) {
  const done = async (lines) => {
    try {
      const img = await win.capturePage();
      fs.writeFileSync(path.join(outDir, '_captura.png'), img.toPNG());
    } catch (e) { lines.push('captura: ' + e.message); }
    fs.writeFileSync(path.join(outDir, '_selftest.txt'), lines.join('\n'), 'utf8');
    require('electron').app.quit();
  };
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) fs.appendFileSync(path.join(outDir, '_console.txt'), message + '\n');
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      // Nivelul 3: paginile de partitură reale din MUSICCOLOR_SELFTEST_L3 (exportate de aplicație)
      const l3 = process.env.MUSICCOLOR_SELFTEST_L3;
      let script = RENDERER;
      if (l3) {
        const files = fs.readdirSync(l3).filter(f => /partitura_p\d+\.png$/i.test(f)).sort()
          .map(f => ({ name: f, b64: fs.readFileSync(path.join(l3, f)).toString('base64') }));
        script = RENDERER_L3.replace('__PAGES__', JSON.stringify(files));
      }
      const lines = await win.webContents.executeJavaScript(script, true);
      await done(lines);
    } catch (e) { await done(['eroare: ' + (e && e.message)]); }
  });
};
