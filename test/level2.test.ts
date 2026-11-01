// Rulare: npx tsx --test test/level2.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spiralCells, continuousSpiralCells, sampleColors, nearestCell, buildMelody, melodyBeats, GOLDEN_ANGLE } from '../src/core/imageMelody';
import { layoutScore, PAGE_W, PAGE_H } from '../src/core/scoreLayout';
import { cellColor, type RGB } from '../src/core/golden';
import { PHI } from '../src/core/spiral';

test('unghiul de aur = 2π/φ² ≈ 137,5°', () => {
  assert.ok(Math.abs((GOLDEN_ANGLE * 180) / Math.PI - 137.5077640500378) < 1e-9);
  assert.ok(Math.abs(GOLDEN_ANGLE - 2 * Math.PI * (1 - 1 / PHI)) < 1e-12);
});

test('celulele: ~N în imagine, din centru spre exterior, acoperă colțurile (ambele trasee)', () => {
  for (const gen of [spiralCells, continuousSpiralCells]) for (const [w, h] of [[400, 300], [300, 400], [256, 256]]) {
    const cells = gen(w, h, 256);
    assert.ok(Math.abs(cells.length - 256) <= 16, `${gen.name} ${cells.length}`);
    const d = cells.map(c => Math.hypot(c.x - w / 2, c.y - h / 2));
    for (let i = 1; i < d.length; i++) assert.ok(d[i] >= d[i - 1]);
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const near = Math.min(...cells.map(c => Math.hypot(c.x - cx, c.y - cy)));
      assert.ok(near < 3 * cells[0].r, `colț ${cx},${cy}: ${near}`);
    }
  }
});

test('spirala continuă: celulele consecutive sunt vecine', () => {
  const cells = continuousSpiralCells(400, 300, 256);
  for (let i = 1; i < cells.length; i++) {
    const d = Math.hypot(cells[i].x - cells[i - 1].x, cells[i].y - cells[i - 1].y);
    // vecine pe curbă (≈ un pas) sau, la ieșirea/intrarea din imagine, pe spira următoare
    assert.ok(d <= 2 * cells[0].r * 1.15 || Math.hypot(cells[i].x - 200, cells[i].y - 150) > 140, `${i}: ${d}`);
  }
});

test('culoarea exactă a unei celule din matrice → aceeași celulă', () => {
  for (let row = -10; row <= 10; row++) for (let col = 0; col < 8; col++) assert.deepEqual(nearestCell(cellColor(col, row)), { col, row });
});

test('eșantionarea: o imagine în două culori dă culorile corecte', () => {
  const w = 40, h = 20, px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; px.set(x < 20 ? [204, 17, 0, 255] : [0, 32, 96, 255], i); }
  const cells = spiralCells(w, h, 40);
  const cols = sampleColors(px, w, h, cells);
  cells.forEach((c, i) => { if (Math.abs(c.x - 20) > c.r + 1) assert.deepEqual(cols[i], c.x < 20 ? [204, 17, 0] : [0, 32, 96]); });
});

test('ritm: repetițiile se unesc, fără a trece peste bara de măsură', () => {
  const red = cellColor(0, 0), blue = cellColor(4, 0);
  const colors: RGB[] = [red, red, red, blue, blue, blue, blue, blue, blue, red];
  const m = buildMelody(colors);
  assert.deepEqual(m.map(n => [n.startBeat, n.beats]), [[0, 3], [3, 1], [4, 4], [8, 1], [9, 1]]);
  assert.equal(melodyBeats(m), colors.length);
  for (const n of m) assert.ok(Math.floor(n.startBeat / 4) === Math.floor((n.startBeat + n.beats - 1) / 4));
});

test('partitura: toate notele apar o singură dată, totul în pagină', () => {
  const colors: RGB[] = Array.from({ length: 600 }, (_, i) => cellColor((i * 7) % 8, ((i * 3) % 21) - 10));
  const m = buildMelody(colors);
  const pages = layoutScore(m, { title: 'T', subtitle: 's', instrument: 'Pian', bpm: 96 });
  assert.ok(pages.length >= 2);
  assert.equal(pages.reduce((a, p) => a + p.notes.length, 0), m.length);
  for (const p of pages) {
    assert.equal(p.prims.filter(x => x.k === 'head').length, p.notes.length);
    for (const x of p.prims) {
      const xs = 'x' in x ? [x.x] : 'cx' in x ? [x.cx] : [x.x1, x.x2];
      const ys = 'y' in x ? [x.y] : 'cy' in x ? [x.cy] : [x.y1, x.y2];
      for (const v of xs) assert.ok(v >= 0 && v <= PAGE_W, `x ${v} (${x.k})`);
      for (const v of ys) assert.ok(v >= 0 && v <= PAGE_H, `y ${v} (${x.k})`);
    }
  }
});
