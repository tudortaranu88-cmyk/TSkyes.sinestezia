// Rulare: npx tsx --test test/audio.test.ts
// Fișier audio → note → evenimente colorate; palete de culori.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeWav, detectNotes, midiToCell, notesToEvents, recolor } from '../src/core/audioMelody';
import { encodeWav } from '../src/core/encoders';
import { renderMix } from '../src/core/audioRender';
import { cellColor, midiToFreq, PALETTES, paletteColors, BASE_COLORS } from '../src/core/golden';

const SR = 44100;

function tones(midis: number[], dur = 0.4, gap = 0.08, harmonics = true): Float32Array {
  const out = new Float32Array(Math.ceil((midis.length * (dur + gap) + 0.3) * SR));
  midis.forEach((m, k) => {
    const f = midiToFreq(m), i0 = Math.floor((0.1 + k * (dur + gap)) * SR), n = Math.floor(dur * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR, env = Math.min(1, i / 400, (n - i) / 400);
      let s = Math.sin(2 * Math.PI * f * t);
      if (harmonics) s += 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t);
      out[i0 + i] = 0.4 * env * s;
    }
  });
  return out;
}

test('WAV: codare → decodare păstrează semnalul și rata', () => {
  const x = tones([60, 64], 0.1);
  const { data, sampleRate } = decodeWav(encodeWav(x, SR));
  assert.equal(sampleRate, SR);
  assert.equal(data.length, x.length);
  let err = 0;
  for (let i = 0; i < x.length; i++) err = Math.max(err, Math.abs(x[i] - data[i]));
  assert.ok(err < 1e-3, `eroare ${err}`);
});

test('WAV stereo pe 24 de biți se citește ca mono', () => {
  const frames = 1000, buf = new Uint8Array(44 + frames * 6), v = new DataView(buf.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + frames * 6, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, 48000, true); v.setUint32(28, 48000 * 6, true);
  v.setUint16(32, 6, true); v.setUint16(34, 24, true); str(36, 'data'); v.setUint32(40, frames * 6, true);
  for (let i = 0; i < frames; i++) {
    for (const [c, val] of [[0, 0.5], [1, -0.25]] as const) {
      const q = Math.round(val * 8388607), o = 44 + i * 6 + c * 3;
      buf[o] = q & 255; buf[o + 1] = (q >> 8) & 255; buf[o + 2] = (q >> 16) & 255;
    }
  }
  const { data, sampleRate } = decodeWav(buf);
  assert.equal(sampleRate, 48000);
  assert.equal(data.length, frames);
  assert.ok(Math.abs(data[10] - 0.125) < 1e-4);
});

test('fișier care nu e WAV → eroare clară', () => {
  assert.throws(() => decodeWav(new Uint8Array(100)), /WAV/);
});

test('detectează gama Do–Do (tonuri cu armonice)', () => {
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];
  const notes = detectNotes(tones(scale), SR);
  assert.deepEqual(notes.map(n => n.midi), scale);
  for (const n of notes) assert.ok(n.durSec > 0.25 && n.durSec < 0.55, `durata ${n.durSec}`);
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i].startSec > notes[i - 1].startSec);
});

test('detectează note grave și acute, ignoră liniștea', () => {
  const seq = [43, 48, 76, 81];
  assert.deepEqual(detectNotes(tones(seq, 0.5), SR).map(n => n.midi), seq);
  assert.equal(detectNotes(new Float32Array(SR), SR).length, 0);
});

test('melodie randată de aplicație (pian sintetizat) → aceleași note', () => {
  const seq = [60, 64, 67, 72, 67, 64];
  const mix = renderMix(seq.map((m, i) => ({ startSec: 0.1 + i * 0.5, durSec: 0.4, freq: midiToFreq(m), instrument: 'vioara' })), { sampleRate: SR });
  assert.deepEqual(detectNotes(mix, SR).map(n => n.midi), seq);
});

test('fișier lung: numărul de ferestre e plafonat', () => {
  const long = tones(Array.from({ length: 60 }, (_, i) => 60 + (i % 8)), 0.9, 0.1);
  const t = Date.now();
  const notes = detectNotes(long, SR, { maxFrames: 600 });
  assert.ok(notes.length >= 50, `note ${notes.length}`);
  assert.ok(Date.now() - t < 5000);
});

test('nota → celula claviaturii', () => {
  assert.deepEqual(midiToCell(60), { col: 0, row: 0 });   // Do
  assert.deepEqual(midiToCell(69), { col: 5, row: 0 });   // La
  assert.deepEqual(midiToCell(61), { col: 0, row: 1 });   // Do# = Do, un rând mai sus
  assert.deepEqual(midiToCell(72), { col: 0, row: 3 });   // octava de sus
  assert.deepEqual(midiToCell(59), { col: 6, row: -3 });  // Si, octava de jos
  assert.equal(midiToCell(120).row, 10);
  assert.equal(midiToCell(0).row, -10);
});

test('evenimentele iau culoarea paletei alese și pot fi recolorate', () => {
  const notes = detectNotes(tones([60, 67]), SR);
  const ev = notesToEvents(notes, 'cmyk');
  assert.equal(ev.length, 2);
  assert.deepEqual(ev[0].color, [237, 28, 36]);
  assert.equal(ev[0].label, 'Do');
  assert.ok(ev[1].startMs > ev[0].startMs && (ev[0].durationMs ?? 0) > 200);
  assert.deepEqual(recolor(ev, 'ral')[1].color, cellColor(4, 0, 'ral'));
});

test('palete: trei, câte 8 culori distincte; cea aurie e neschimbată', () => {
  assert.deepEqual(PALETTES.map(p => p.id), ['aurie', 'cmyk', 'ral']);
  for (const p of PALETTES) {
    assert.equal(p.colors.length, 8);
    assert.equal(new Set(p.colors.map(c => c.join(','))).size, 8);
  }
  assert.equal(paletteColors('aurie'), BASE_COLORS);
  assert.deepEqual(cellColor(3, 0), BASE_COLORS[3]);
  assert.deepEqual(cellColor(3, 0, 'cmyk'), [0, 174, 239]);
  assert.deepEqual(cellColor(0, 0, 'ral'), [204, 6, 5]);
  const up = cellColor(4, 5, 'cmyk'), down = cellColor(4, -5, 'cmyk'), base = cellColor(4, 0, 'cmyk');
  assert.ok(up[0] > base[0] && down[0] < base[0]);
});
