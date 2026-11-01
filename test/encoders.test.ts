// Rulare: npx tsx --test test/encoders.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, encodeTiff, toBase64 } from '../src/core/encoders';
import { renderMix } from '../src/core/audioRender';
import { INSTRUMENTS } from '../src/core/instruments';

test('Base64 identic cu Buffer (toate lungimile de rest)', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100, 0x8000 + 7]) {
    const b = new Uint8Array(n).map((_, i) => (i * 37 + 11) & 255);
    assert.equal(toBase64(b), Buffer.from(b).toString('base64'));
  }
});

test('WAV: antet RIFF corect și eșantioane PCM 16 biți', () => {
  const s = new Float32Array([0, 1, -1, 0.5, 2]);
  const w = encodeWav(s, 44100);
  const v = new DataView(w.buffer);
  assert.equal(Buffer.from(w.slice(0, 4)).toString(), 'RIFF');
  assert.equal(Buffer.from(w.slice(8, 12)).toString(), 'WAVE');
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getUint32(40, true), 10);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => v.getInt16(44 + i * 2, true)), [0, 32767, -32768, 16384, 32767]);
});

test('TIFF: antet little-endian, dimensiuni și pixeli RGB', () => {
  const w = 3, h = 2;
  const rgba = new Uint8Array(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : i));
  const t = encodeTiff(rgba, w, h);
  const v = new DataView(t.buffer);
  assert.equal(v.getUint16(0, true), 0x4949);
  assert.equal(v.getUint16(2, true), 42);
  const ifd = v.getUint32(4, true), n = v.getUint16(ifd, true);
  const tags: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    const p = ifd + 2 + i * 12, id = v.getUint16(p, true), type = v.getUint16(p + 2, true);
    tags[id] = type === 3 ? v.getUint16(p + 8, true) : v.getUint32(p + 8, true);
  }
  assert.equal(tags[256], w); assert.equal(tags[257], h); assert.equal(tags[277], 3);
  const off = tags[273];
  assert.equal(t.length, off + w * h * 3);
  assert.deepEqual([...t.slice(off, off + 6)], [0, 1, 2, 4, 5, 6]);
});

test('randare audio: durata, fără depășiri, sunet pentru fiecare instrument', () => {
  for (const ins of INSTRUMENTS) {
    const mix = renderMix([{ startSec: 0.1, durSec: 0.5, freq: 440, instrument: ins.id }], { sampleRate: 22050, tailSec: 0.5 });
    assert.equal(mix.length, Math.ceil((0.6 + 0.5) * 22050));
    let peak = 0; for (const x of mix) peak = Math.max(peak, Math.abs(x));
    assert.ok(peak > 0.01 && peak <= 0.98, `${ins.id}: vârf ${peak}`);
    assert.ok(mix.slice(0, 2000).every(x => x === 0), `${ins.id}: liniște înainte de notă`);
  }
});

test('randare audio: acorduri dense sunt normalizate sub 0,98', () => {
  const notes = Array.from({ length: 20 }, (_, i) => ({ startSec: 0, durSec: 1, freq: 200 + i * 30, instrument: 'vioara' }));
  const mix = renderMix(notes, { sampleRate: 22050 });
  let peak = 0; for (const x of mix) peak = Math.max(peak, Math.abs(x));
  assert.ok(peak <= 0.9800001);
});

test('randare audio cu sample-uri (buclă + transpunere)', () => {
  const sr = 22050, data = new Float32Array(sr).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / sr));
  const mix = renderMix([{ startSec: 0, durSec: 2, freq: 880, instrument: 'nai' }],
    { sampleRate: sr, samples: { nai: { list: [{ freq: 440, data, sampleRate: sr }], loop: true } } });
  // sunetul continuă până la sfârșitul notei (2 s), deși sample-ul are 1 s și e redat de 2× mai repede
  let e = 0; for (let i = Math.floor(1.8 * sr); i < 1.9 * sr; i++) e += Math.abs(mix[i]);
  assert.ok(e > 100);
});
