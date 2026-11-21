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
  const status = () => [...document.querySelectorAll('div')].map(d => d.textContent).filter(t => /^(Salvat:|Nu a reușit|Salvarea)/.test(t)).pop();
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
      const lines = await win.webContents.executeJavaScript(RENDERER, true);
      await done(lines);
    } catch (e) { await done(['eroare: ' + (e && e.message)]); }
  });
};
