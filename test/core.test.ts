// Rulare: npx tsx --test test/core.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHI, B, QUARTER, radiusAt, arcLength, curvatureAt, pointAt, noteSegment, fitSpiral, visibleCount } from '../src/core/spiral';
import { midiToStaff, staffY, ledgerSteps, BOTTOM_LINE_STEP, TOP_LINE_STEP } from '../src/core/staff';
import { cellPitch, cellColor, noteLabel } from '../src/core/golden';

const EPS = 1e-9;
const close = (a: number, b: number, eps = EPS) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const cfg = fitSpiral(390, 422, 9);

test('φ și rata de creștere', () => {
  close(PHI, 1.618033988749895);
  close(Math.exp(B * QUARTER), PHI); // un sfert de tură = ×φ
});

test('raporturi stricte de aur între note consecutive (u = 0..14)', () => {
  for (let u = 0; u < 14; u++) {
    const s0 = noteSegment(u, cfg), s1 = noteSegment(u + 1, cfg);
    close(s1.r0 / s0.r0, PHI);                       // distanța față de centru
    close(s1.length / s0.length, PHI);               // lungimea formei
    close(s1.curvature / s0.curvature, 1 / PHI);     // curbura
    close(s1.strokeWidth / s0.strokeWidth, PHI);     // grosimea
    close(s1.node.radius / s0.node.radius, PHI);     // nodul
    close(s0.r1 / s0.r0, PHI);                       // în interiorul aceleiași note
    const n0 = noteSegment(u, cfg).node, n1 = s1.node, n2 = noteSegment(u + 2, cfg).node;
    close(Math.hypot(n2.x - n1.x, n2.y - n1.y) / Math.hypot(n1.x - n0.x, n1.y - n0.y), PHI); // coarda
  }
});

test('lungimea arcului: formula exactă = integrare numerică', () => {
  const t0 = 2 * QUARTER, t1 = 3 * QUARTER, N = 200000;
  let L = 0, prev = pointAt(t0, cfg);
  for (let i = 1; i <= N; i++) { const p = pointAt(t0 + ((t1 - t0) * i) / N, cfg); L += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; }
  close(L, arcLength(t0, t1, cfg.a), 1e-6);
});

test('curbura: formula = estimare numerică din 3 puncte', () => {
  const t = 5 * QUARTER, h = 1e-4;
  const p0 = pointAt(t - h, cfg), p1 = pointAt(t, cfg), p2 = pointAt(t + h, cfg);
  const a = Math.hypot(p1.x - p0.x, p1.y - p0.y), b = Math.hypot(p2.x - p1.x, p2.y - p1.y), c = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const area2 = Math.abs((p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y));
  close((2 * area2) / (a * b * c), curvatureAt(t, cfg.a), 1e-5);
});

test('orientare: pleacă în SUS, apoi se curbează spre STÂNGA', () => {
  const p0 = pointAt(0, cfg), p1 = pointAt(QUARTER, cfg), p2 = pointAt(2 * QUARTER, cfg);
  close(p0.x, cfg.cx, 1e-9); assert.ok(p0.y < cfg.cy, 'θ=0 deasupra centrului');
  close(p1.y, cfg.cy, 1e-9); assert.ok(p1.x < cfg.cx, 'θ=π/2 la stânga centrului');
  assert.ok(p2.y > cfg.cy, 'θ=π sub centru (spirala continuă trigonometric)');
});

test('încadrare: 9 note vizibile până la marginea cea mai apropiată', () => {
  close(radiusAt(9 * QUARTER, cfg.a), Math.min(390, 422) / 2);
  assert.equal(visibleCount(cfg, Math.min(390, 422) / 2), 9);
});

test('portativ: Mi = linia de jos, Fa = linia de sus, Do = linie suplimentară', () => {
  assert.equal(midiToStaff(64).step, BOTTOM_LINE_STEP);
  assert.equal(midiToStaff(77).step, TOP_LINE_STEP);
  assert.deepEqual(ledgerSteps(midiToStaff(60).step), [BOTTOM_LINE_STEP - 2]);
  assert.equal(midiToStaff(61).sharp, true);
  assert.equal(midiToStaff(60.28).cents, 28);
  close(staffY(TOP_LINE_STEP, 100, 10), 60); // 4 intervale × 10 px
});

test('matricea aurie: identică cu DAW-ul', () => {
  close(cellPitch(5, 0, 'golden').freq, 440);
  close(cellPitch(0, 10, 'golden').freq, 261.63 * Math.pow(1.01618, 10));
  close(cellPitch(0, -3, 'golden').freq, 261.63 * Math.pow(1 - 0.01618, 3));
  assert.equal(cellPitch(0, 10, 'tempered').midi, 63);   // +2,77 semitonuri → Re#
  assert.equal(cellPitch(0, 10, 'diatonic').midi, 62);   // 62,77 → cea mai apropiată din Do major = Re
  assert.deepEqual(cellColor(0, 0), [204, 17, 0]);
});

import { buildScene } from '../src/core/scene';
const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, col: i % 8, row: 0, label: '', freq: 440, midiFloat: 69, color: [255, 0, 0] as [number, number, number], startMs: i * 500, durationMs: 300 }));

test('scenă: zoom continuu la sosirea unei note noi (fără salt)', () => {
  for (let n = 1; n < 10; n++) {
    const before = buildScene({ width: 390, height: 422, events: mk(n), nowMs: 9000, insertPhase: 1, pxPerSec: 60 });
    const after = buildScene({ width: 390, height: 422, events: mk(n + 1), nowMs: 9000, insertPhase: 0, pxPerSec: 60 });
    close(after.spiral.a, before.spiral.a);
    // nodul notei existente k rămâne în același loc
    for (let k = 0; k < Math.min(n, before.nodes.length); k++) {
      const b = before.nodes[before.nodes.length - 1 - k], a = after.nodes[after.nodes.length - 2 - k];
      if (a && b) { close(a.x, b.x, 1e-9); close(a.y, b.y, 1e-9); }
    }
  }
});

test('scenă: raporturile φ se păstrează și în scena randată', () => {
  const s = buildScene({ width: 390, height: 422, events: mk(12), nowMs: 9000, insertPhase: 1, pxPerSec: 60 });
  const nd = s.nodes; // de la cea mai veche (centru) spre cea mai nouă (exterior)
  assert.equal(nd.length, 12);
  for (let k = 0; k + 1 < nd.length; k++) close(nd[k + 1].radius / nd[k].radius, PHI);
});

test('scenă: zoom out – vârful notei celei mai noi stă la marginea zonei, oricâte note ar fi', () => {
  for (const n of [1, 5, 20, 60]) {
    const s = buildScene({ width: 390, height: 422, events: mk(n), nowMs: 99000, insertPhase: 1, pxPerSec: 60 });
    const tip = s.arcs[s.arcs.length - 1].points.at(-1)!;
    close(Math.hypot(tip.x - s.spiral.cx, tip.y - s.spiral.cy), (390 / 2) * 0.92, 1e-9);
    for (const a of s.arcs) for (const p of a.points) assert.ok(Math.hypot(p.x - s.spiral.cx, p.y - s.spiral.cy) <= 390 / 2);
  }
});

test('scenă cover (export A4): vârful atinge jumătatea diagonalei → colțurile se umplu', () => {
  const W = 1240, H = 1754; // proporția A4 a exportului
  const s = buildScene({ width: W, height: H, events: mk(8), nowMs: 9000, insertPhase: 1, pxPerSec: 60, fill: 0.98, cover: true });
  const half = Math.hypot(W, H) / 2;
  const tip = s.arcs[s.arcs.length - 1].points.at(-1)!;
  close(Math.hypot(tip.x - s.spiral.cx, tip.y - s.spiral.cy), half * 0.98, 1e-9);
  assert.ok(half * 0.98 > Math.min(W, H) / 2, 'raza depășește latura scurtă → spirala intră în colțuri');
});

import { sunflowerDots } from '../src/core/tablou';

test('tablou floarea-soarelui: toate notele devin puncte, în discul înscris', () => {
  const W = 1240, H = 1754, fill = 0.92;
  for (const n of [1, 12, 150, 600]) {
    const dots = sunflowerDots(n, W, H, fill);
    assert.equal(dots.length, n, 'fiecare notă are un punct');
    const R = (Math.min(W, H) / 2) * fill, cx = W / 2, cy = H / 2;
    for (const d of dots) assert.ok(Math.hypot(d.x - cx, d.y - cy) <= R + 1e-6, 'punctul stă în disc');
    // raza punctului scade cu √n (punctele se ating la orice densitate)
    close(dots[0].r, (0.85 * R) / Math.sqrt(n));
    assert.ok(dots[0].r > 0);
  }
  // primul punct e lângă centru, ultimul aproape de margine
  const d = sunflowerDots(100, W, H, 0.92);
  const R = (Math.min(W, H) / 2) * 0.92;
  assert.ok(Math.hypot(d[0].x - W / 2, d[0].y - H / 2) < R * 0.1, 'primul punct lângă centru');
  assert.ok(Math.hypot(d[99].x - W / 2, d[99].y - H / 2) > R * 0.9, 'ultimul punct lângă margine');
});

test('denumirea notelor: rândul 0 fără cifră, sufix pe rânduri, Do\' la octava de sus', () => {
  assert.equal(noteLabel(0, 0), 'Do');          // fundamentala, fără cifră
  assert.equal(noteLabel(6, 0), 'Si');
  assert.equal(noteLabel(7, 0), "Do'");         // ultimul Do al rândului → apostrof
  assert.equal(noteLabel(0, 1), 'Do+1');
  assert.equal(noteLabel(4, 2), 'Sol+2');
  assert.equal(noteLabel(7, 3), "Do'+3");
  assert.equal(noteLabel(2, -1), 'Mi-1');
  assert.equal(noteLabel(7, -5), "Do'-5");
});
