// Rulare: npx tsx --test test/scan.test.ts
// Partituri „scanate”: paginile reale (aceleași primitive ca la export) sunt rotite, scalate, mutate,
// decolorate, cu zgomot și neclaritate – apoi citite. Color: celulele exacte; alb-negru: înălțimea și ritmul.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMelody, type MelodyNote } from '../src/core/imageMelody';
import { layoutScore, type ScorePage } from '../src/core/scoreLayout';
import { decodeScanPage } from '../src/core/scanDecode';
import { decodeScores } from '../src/core/scoreDecode';
import { render, scan, printed, dim, type Scan } from './scanSim';
import { cellColor, cellPitch, type RGB } from '../src/core/golden';

const meta = { title: 'T', subtitle: 's', instrument: 'Pian', bpm: 105 };

function melody(n: number, seed: number): MelodyNote[] {
  const colors: RGB[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 69069 + 1) >>> 0;
    const repeat = (s >>> 8) % 3 === 0 && i > 0;
    colors.push(repeat ? colors[i - 1] : cellColor((s >>> 3) % 8, ((s >>> 12) % 21) - 10));
  }
  return buildMelody(colors);
}
const perBeat = (p: ScorePage) => p.notes.flatMap(n => Array.from({ length: n.beats }, () => `${n.col}:${n.row}`));
const midiBeats = (cells: string[]) => cells.map(k => { const [c, r] = k.split(':').map(Number); return cellPitch(c, r, 'tempered').midi; });

// [nume, scanare, prag înălțimi corecte, prag nuanțe exacte (color)]
const CASES: [string, Scan, number, number][] = [
  ['curată (exportul aplicației)', { scale: 1, angle: 0, offX: 0, offY: 0, extraW: 0, extraH: 0 }, 1, 1],
  ['scaner 300 dpi, înclinată 0,8°, hârtie îngălbenită, decolorată', { scale: 1.9, angle: 0.8, offX: 40, offY: 60, extraW: 90, extraH: 140, color: printed, noise: 6, blur: true }, 1, 0.95],
  ['~110 dpi, înclinată −1,5°, ramă neagră, lumină slabă', { scale: 0.75, angle: -1.5, offX: 30, offY: 25, extraW: 60, extraH: 50, color: dim, noise: 8, blur: true, border: true }, 0.9, 0],
];

const share = (a: unknown[], b: unknown[]) => a.filter((x, i) => x === b[i]).length / b.length;

for (const [name, sc, pitchMin, cellMin] of CASES) {
  for (const gray of [false, true]) {
    const kind = gray ? 'alb-negru' : 'color';
    test(`${kind} – ${name}`, () => {
      const pages = layoutScore(melody(260, 11), meta);
      assert.ok(pages.length >= 2);
      for (let p = 0; p < pages.length; p++) {
        const res = decodeScanPage(scan(render(pages[p].prims), { ...sc, gray }), p === pages.length - 1);
        assert.equal(res.mode, gray ? 'gray' : 'color');
        const want = perBeat(pages[p]);
        const got = res.cells.map(c => `${c.col}:${c.row}`);
        assert.equal(got.length, want.length, `pagina ${p + 1}: numărul de pătrimi`);
        const pitch = share(midiBeats(got), midiBeats(want)), cell = share(got, want);
        console.log(`  ${kind} / ${name} / pagina ${p + 1}: înălțimi ${(pitch * 100).toFixed(1)}%, nuanțe ${(cell * 100).toFixed(1)}%`);
        assert.ok(pitch >= pitchMin, `pagina ${p + 1}: înălțimi corecte ${pitch}`);
        if (!gray) assert.ok(cell >= cellMin, `pagina ${p + 1}: nuanțe exacte ${cell}`);
      }
    });
  }
}

test('dus-întors pe mai multe pagini scanate (300 dpi): aceleași note', () => {
  const m = melody(300, 5);
  const pages = layoutScore(m, meta);
  const dec = decodeScores(pages.map(p => scan(render(p.prims), CASES[1][1])));
  const beatsOf = (ms: MelodyNote[]) => ms.flatMap(n => Array.from({ length: n.beats }, () => n.midi));
  assert.deepEqual(beatsOf(dec), beatsOf(m));
});

test('paginile exportate exact (fără scanare) se citesc identic', () => {
  const m = melody(300, 9);
  const pages = layoutScore(m, meta);
  const dec = decodeScores(pages.map(p => scan(render(p.prims), CASES[0][1])));
  assert.deepEqual(dec.map(n => [n.col, n.row, n.beats, n.startBeat]), m.map(n => [n.col, n.row, n.beats, n.startBeat]));
});
