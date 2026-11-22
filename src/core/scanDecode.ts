// NIVEL 3 – citirea partiturilor Music&Color ajunse pe hârtie: scanate, fotografiate sau din PDF.
//
// Ce știm sigur despre o pagină generată de aplicație (scoreLayout.ts):
//  • banda de culori de jos merge de la x=100 la x=1140 (unități de pagină), începe cu blocul negru de
//    calibrare (1 pătrime), apoi câte un bloc pe notă, cu goluri magenta între blocuri;
//  • portativele merg pe aceeași lățime (100…1140), câte 4 măsuri × 4 pătrimi = 16 pătrimi pe portativ,
//    iar toate paginile în afară de ultima sunt pline ⇒ pătrimi pe pagină = 16 × portative;
//  • melodia se reface exact din culoarea fiecărei pătrimi (buildMelody unește repetițiile, ca la generare).
//
// Pașii: găsim banda (și înclinarea ei) → sistem de coordonate (u de-a lungul paginii, v perpendicular) →
// portativele (câte sunt, unde sunt) → numărul de pătrimi → culoarea fiecărei pătrimi.
// Color: culorile se corectează după negrul de calibrare, hârtie și o potrivire afină pe paletă.
// Alb-negru: culorile s-au pierdut, așa că notele se citesc de pe portativ (înălțime + ritm), iar
// nuanța se alege dintre celulele cu aceeași înălțime după luminozitatea blocului din bandă.

import { cellColor, cellPitch, NOTES, ROW_MIN, ROW_MAX, type RGB } from './golden';
import { nearestCell, colorDistance } from './imageMelody';
import {
  PAGE_H, STRIP_X0, STRIP_X1, STRIP_Y, STRIP_H, MARGIN, GAP, SYSTEM_H,
  BARS_PER_SYSTEM, BEATS_PER_BAR, FIRST_TOP, OTHER_TOP,
} from './scoreLayout';
import { BOTTOM_LINE_STEP } from './staff';

export interface ScanImage { rgba: Uint8Array; width: number; height: number }
export interface PageCell { col: number; row: number }
export interface ScanResult {
  cells: PageCell[];          // câte o celulă pe pătrime, în ordine
  mode: 'color' | 'gray';
  systems: number;
  beats: number;
}

const STRIP_W = STRIP_X1 - STRIP_X0;                 // 1040
const STRIP_CY = STRIP_Y + STRIP_H / 2;              // 1640
const BEATS_PER_SYSTEM = BARS_PER_SYSTEM * BEATS_PER_BAR;
const GAP_UNITS = 3;                                  // golul magenta dintre blocuri (unități de pagină)
const AFFINE_PASSES = 3;
const MAX_BEATS =16 * Math.ceil((PAGE_H - 150 - OTHER_TOP) / SYSTEM_H);

// ───────────────────────── imaginea: luminozitate, cromă, eșantionare ─────────────────────────

class Img {
  readonly lum: Float32Array;
  readonly paper: number;
  constructor(readonly rgba: Uint8Array, readonly w: number, readonly h: number) {
    const n = w * h;
    this.lum = new Float32Array(n);
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      const l = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
      this.lum[i] = l;
      hist[l | 0]++;
    }
    // hârtia = luminozitatea la percentila 90 (pagina e în mare parte albă)
    let acc = 0, p = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.9) { p = v; break; } }
    this.paper = Math.max(p, 60);
  }
  inside(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  /** „Cerneală”: mai închis decât hârtia sau colorat. */
  ink(x: number, y: number): boolean {
    const xi = x | 0, yi = y | 0;
    if (!this.inside(xi, yi)) return false;
    const i = yi * this.w + xi;
    if (this.lum[i] < this.paper * 0.78) return true;
    const r = this.rgba[i * 4], g = this.rgba[i * 4 + 1], b = this.rgba[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) > 48;
  }
  /** Închis (linii, capete de note) – doar după luminozitate. */
  dark(x: number, y: number): boolean {
    const xi = Math.round(x), yi = Math.round(y);
    if (!this.inside(xi, yi)) return false;
    return this.lum[yi * this.w + xi] < this.paper * 0.6;
  }
  rgb(x: number, y: number): RGB | null {
    const xi = Math.round(x), yi = Math.round(y);
    if (!this.inside(xi, yi)) return null;
    const i = (yi * this.w + xi) * 4;
    return [this.rgba[i], this.rgba[i + 1], this.rgba[i + 2]];
  }
}

/** Cadrul paginii: u de-a lungul benzii (orizontala paginii), v perpendicular (în jos). */
class Frame {
  readonly c: number; readonly s: number;
  constructor(readonly b: number, slope: number) {
    const t = Math.atan(slope);
    this.c = Math.cos(t); this.s = Math.sin(t);
  }
  x(u: number, v: number) { return u * this.c - v * this.s; }
  y(u: number, v: number) { return this.b + u * this.s + v * this.c; }
}

/** Informații de diagnostic despre ultima pagină citită (pentru teste și mesaje). */
export const scanDebug: Record<string, any> = {};

const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };

// ───────────────────────────── 1. banda de culori ─────────────────────────────

interface Strip { frame: Frame; u0: number; u1: number; thick: number }

function findStrip(img: Img): Strip {
  const { w, h } = img;
  const minL = Math.max(3, w * 0.006), maxL = w * 0.04;
  const cands: { x: number; y: number; L: number }[] = [];
  const COLS = 28;
  for (let k = 0; k < COLS; k++) {
    const x = Math.round(w * (0.1 + (0.8 * k) / (COLS - 1)));
    let start = -1;
    for (let y = Math.floor(h * 0.4); y <= h; y++) {
      const on = y < h && img.ink(x, y);
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        const L = y - start;
        // tronsoanele lipite de marginea de jos a imaginii sunt rama scanerului, nu banda
        if (L >= minL && L <= maxL && y < h - 1) cands.push({ x, y: (start + y - 1) / 2, L });
        start = -1;
      }
    }
  }
  scanDebug.cands = cands.length;
  scanDebug.paper = img.paper;
  if (cands.length < 5) throw new Error('Banda de culori nu a fost găsită (nu pare o partitură Music&Color)');

  // RANSAC: dreapta pe care stau cele mai multe tronsoane de grosime asemănătoare (banda e cea mai
  // lungă bandă groasă și dreaptă din jumătatea de jos a paginii).
  let best: { a: number; b: number; inl: typeof cands } | null = null;
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
    const p = cands[i], q = cands[j];
    if (p.x === q.x) continue;
    const Lm = (p.L + q.L) / 2;
    if (Math.abs(p.L - q.L) > 0.45 * Lm) continue;
    const a = (q.y - p.y) / (q.x - p.x);
    if (Math.abs(a) > 0.12) continue;                    // înclinare de cel mult ~7°
    const b = p.y - a * p.x;
    const tol = Math.max(2, 0.45 * Lm);
    const inl = cands.filter(c => Math.abs(c.y - (a * c.x + b)) < tol && Math.abs(c.L - Lm) < 0.5 * Lm);
    const cols = new Set(inl.map(c => c.x)).size;
    const bestCols = best ? new Set(best.inl.map(c => c.x)).size : 0;
    if (!best || cols > bestCols || (cols === bestCols && b > best.b)) best = { a, b, inl };
  }
  if (!best || new Set(best.inl.map(c => c.x)).size < 5) {
    throw new Error('Banda de culori nu a fost găsită (nu pare o partitură Music&Color)');
  }
  // regresie pe punctele bune
  const P = best.inl;
  const mx = P.reduce((s, c) => s + c.x, 0) / P.length, my = P.reduce((s, c) => s + c.y, 0) / P.length;
  let sxy = 0, sxx = 0;
  for (const c of P) { sxy += (c.x - mx) * (c.y - my); sxx += (c.x - mx) ** 2; }
  const a = sxx > 0 ? sxy / sxx : 0;
  const b = my - a * mx;
  const thick = median(P.map(c => c.L));
  const frame = new Frame(b, a);

  // capetele benzii de-a lungul ei; segmentele lipite de marginea imaginii (rama scanerului) nu contează
  const span = Math.ceil(Math.hypot(w, h));
  const present: boolean[] = [];
  const half = Math.max(1, thick * 0.3);
  for (let u = 0; u < span; u++) {
    let on = 0, tot = 0;
    for (let v = -half; v <= half; v += Math.max(1, half / 2)) {
      tot++; if (img.ink(frame.x(u, v), frame.y(u, v))) on++;
    }
    present.push(on / tot >= 0.6);
  }
  const segs: [number, number][] = [];
  const join = Math.max(2, w * 0.004);
  for (let u = 0; u < span; u++) {
    if (!present[u]) continue;
    const last = segs[segs.length - 1];
    if (last && u - last[1] <= join) last[1] = u; else segs.push([u, u]);
  }
  const ok = segs.filter(([a0, a1]) => {
    const xa = frame.x(a0, 0), xb = frame.x(a1, 0);
    return xa > 2 && xb < w - 3 && a1 - a0 >= 1;
  });
  scanDebug.strip = { a, b, thick, inliers: P.length, segs: segs.slice(0, 12), ok: ok.length };
  if (!ok.length) throw new Error('Banda de culori nu a fost găsită');
  return { frame, u0: ok[0][0], u1: ok[ok.length - 1][1] + 1, thick };
}

// ───────────────────────────── 2. portativele ─────────────────────────────

interface System { top: number; bottom: number; gap: number }   // v al liniei de sus / de jos

function findSystems(img: Img, st: Strip, scale: number): { systems: System[]; lineU?: [number, number] } {
  const { frame, u0, u1 } = st;
  const vMin = -(STRIP_CY - OTHER_TOP + 20) * scale;
  const rows: { v: number; f: number }[] = [];
  const step = Math.max(1, Math.round((u1 - u0) / 400));
  for (let v = Math.floor(vMin); v < -st.thick; v++) {
    let on = 0, tot = 0;
    for (let u = u0; u < u1; u += step) { tot++; if (img.dark(frame.x(u, v), frame.y(u, v))) on++; }
    rows.push({ v, f: on / tot });
  }
  // liniile = rânduri acoperite aproape complet; rândurile vecine se unesc într-o linie
  const lines: number[] = [];
  let run: { v: number; f: number }[] = [];
  const flush = () => {
    if (run.length) {
      const sw = run.reduce((s, r) => s + r.f, 0);
      lines.push(run.reduce((s, r) => s + r.v * r.f, 0) / sw);
    }
    run = [];
  };
  for (const r of rows) { if (r.f > 0.5) run.push(r); else flush(); }
  flush();

  const g = GAP * scale;
  const systems: System[] = [];
  for (let i = 0; i + 4 < lines.length; i++) {
    const d = [1, 2, 3, 4].map(k => lines[i + k] - lines[i + k - 1]);
    if (d.every(x => x > 0.7 * g && x < 1.35 * g)) {
      systems.push({ top: lines[i], bottom: lines[i + 4], gap: (lines[i + 4] - lines[i]) / 4 });
      i += 4;
    }
  }
  // capetele liniilor (100…1140, ca banda) – mai sigure decât banda dacă ultimele blocuri sunt foarte deschise
  let lineU: [number, number] | undefined;
  if (systems.length) {
    const v = (systems[0].top + systems[0].bottom) / 2 + systems[0].gap / 2 * 0; // linia din mijloc
    const mid = systems[0].top + 2 * systems[0].gap;
    const on = (u: number) => img.dark(frame.x(u, mid), frame.y(u, mid)) || img.dark(frame.x(u, mid - 1), frame.y(u, mid - 1)) || img.dark(frame.x(u, mid + 1), frame.y(u, mid + 1));
    // urmărim linia din mijloc spre capete; ne oprim la primul gol (nu sărim în rama scanerului)
    const walk = (dir: number) => {
      let u = (u0 + u1) / 2, miss = 0, last = u;
      while (miss < 4 && u > 0 && u < u1 + (u1 - u0)) { if (on(u)) { last = u; miss = 0; } else miss++; u += dir; }
      return last;
    };
    void v;
    const a = walk(-1), b = walk(1) + 1;
    if (b > a) lineU = [a, b];
  }
  return { systems, lineU };
}

// ───────────────────────────── 3. corecția culorilor ─────────────────────────────

/** Rezolvă un sistem liniar mic (eliminare Gauss). */
function solve(A: number[][], y: number[]): number[] {
  const n = y.length;
  const M = A.map((r, i) => [...r, y[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-9) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => (Math.abs(r[i]) < 1e-9 ? 0 : r[n] / r[i]));
}

/** Potrivire afină culoare-măsurată → culoare-adevărată (3×3 + deplasare), cu ponderi și regularizare spre identitate. */
function fitAffine(pairs: { m: RGB; t: RGB; w: number }[]): (c: RGB) => RGB {
  const lam = 0.02 * pairs.reduce((s, p) => s + p.w, 0);
  const M: number[][] = [];
  for (let ch = 0; ch < 3; ch++) {
    const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const y = [0, 0, 0, 0];
    for (const p of pairs) {
      const x = [p.m[0], p.m[1], p.m[2], 255];
      for (let i = 0; i < 4; i++) { y[i] += p.w * x[i] * p.t[ch]; for (let j = 0; j < 4; j++) A[i][j] += p.w * x[i] * x[j]; }
    }
    // regularizare: preferă identitatea
    for (let i = 0; i < 3; i++) { A[i][i] += lam * 255 * 255; if (i === ch) y[i] += lam * 255 * 255; }
    M.push(solve(A, y));
  }
  return c => M.map(r => Math.max(0, Math.min(255, r[0] * c[0] + r[1] * c[1] + r[2] * c[2] + r[3] * 255))) as RGB;
}

// ───────────────────────────── 4. citirea notelor de pe portativ (alb-negru) ─────────────────────────────

const PC_OF_STEP = [0, 2, 4, 5, 7, 9, 11];
const stepToMidi = (step: number, sharp: boolean) => 12 * Math.floor(step / 7) + PC_OF_STEP[((step % 7) + 7) % 7] + (sharp ? 1 : 0);

// celulele grupate după înălțimea temperată
const CELLS_BY_MIDI = new Map<number, PageCell[]>();
for (let row = ROW_MIN; row <= ROW_MAX; row++) for (let col = 0; col < NOTES.length; col++) {
  const m = cellPitch(col, row, 'tempered').midi!;
  if (!CELLS_BY_MIDI.has(m)) CELLS_BY_MIDI.set(m, []);
  CELLS_BY_MIDI.get(m)!.push({ col, row });
}
const lumOf = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

interface Head { step: number; sharp: boolean; filled: boolean; score: number; u: number; v: number }

function readHeads(img: Img, st: Strip, X0: number, scale: number, sys: System, firstOfPiece: boolean, bars: number): (Head | null)[] {
  const { frame } = st;
  const g = sys.gap;
  const unitsToPx = scale;
  const lineVs: number[] = [];
  for (let k = -4; k <= 8; k++) lineVs.push(sys.bottom - k * g);       // liniile + liniile suplimentare posibile
  const nearLine = (v: number) => lineVs.some(l => Math.abs(v - l) < 1.1 * scale + 1);
  const rx = GAP * 0.66 * unitsToPx, ry = GAP * 0.47 * unitsToPx;
  const rot = (-20 * Math.PI) / 180, cr = Math.cos(rot), sr = Math.sin(rot);
  // conturul se caută pe trei raze apropiate (la rezoluție mică linia e subțire și ușor deplasată)
  const rings: [number, number][][] = [0.85, 1, 1.15].map(f => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 20; k++) {
      const t = (2 * Math.PI * k) / 20;
      const ex = rx * f * Math.cos(t), ey = ry * f * Math.sin(t);
      pts.push([ex * cr - ey * sr, ex * sr + ey * cr]);
    }
    return pts;
  });
  const inner: [number, number][] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const ex = (rx * 0.55 * i) / 2, ey = (ry * 0.55 * j) / 2;
    inner.push([ex * cr - ey * sr, ex * sr + ey * cr]);
  }
  const frac = (pts: [number, number][], u: number, v: number) => {
    let on = 0, tot = 0;
    for (const [du, dv] of pts) {
      const vv = v + dv;
      if (nearLine(vv)) continue;
      tot++; if (img.dark(frame.x(u + du, vv), frame.y(u + du, vv))) on++;
    }
    return tot >= 3 ? on / tot : 0;
  };
  const ringFrac = (u: number, v: number) => {
    let on = 0, tot = 0;
    for (let k = 0; k < rings[1].length; k++) {
      const vv = v + rings[1][k][1];
      if (nearLine(vv)) continue;
      tot++;
      if (rings.some(r => { const pu = u + r[k][0], pv = v + r[k][1]; return img.dark(frame.x(pu, pv), frame.y(pu, pv)); })) on++;
    }
    return tot >= 3 ? on / tot : 0;
  };

  let xs = MARGIN + 62 + (firstOfPiece ? 36 : 0);
  const barW = (STRIP_X1 - xs) / BARS_PER_SYSTEM;
  const out: (Head | null)[] = [];
  for (let b = 0; b < bars; b++) {
    const bx = xs + b * barW;
    for (let q = 0; q < BEATS_PER_BAR; q++) {
      const nx = bx + 24 + (q / BEATS_PER_BAR) * (barW - 34);
      const u = X0 + (nx - STRIP_X0) * scale;
      let best: Head | null = null;
      for (let step = BOTTOM_LINE_STEP - 6; step <= BOTTOM_LINE_STEP + 10; step++) {
        const v = sys.bottom - ((step - BOTTOM_LINE_STEP) * g) / 2;
        const fi = frac(inner, u, v), ri = ringFrac(u, v);
        const score = Math.max(fi, ri * 0.95);
        if (!best || score > best.score) best = { step, sharp: false, filled: fi >= ri, score, u, v };
      }
      if (!best || best.score < 0.6) { out.push(null); continue; }
      // diezul: două linii verticale + două bare oblice, la stânga capului
      const sxu = best.u - rx - 16 * unitsToPx;
      let on = 0, tot = 0;
      for (let du = -7; du <= 7; du += 1.5) for (let dv = -12; dv <= 12; dv += 2) {
        const vv = best.v + dv * unitsToPx;
        if (nearLine(vv)) continue;
        tot++; if (img.dark(frame.x(sxu + du * unitsToPx, vv), frame.y(sxu + du * unitsToPx, vv))) on++;
      }
      best.sharp = tot > 0 && on / tot > 0.14;
      out.push(best);
    }
  }
  void xs;
  return out;
}

/** Durata ultimei note de pe ultima pagină, după formă: plină = 1, cu punct = 3, cu coadă = 2, fără = 4. */
function headBeats(img: Img, st: Strip, scale: number, h: Head, g: number): number {
  if (h.filled) return 1;
  const { frame } = st;
  const rx = GAP * 0.66 * scale;
  const onLine = (h.step - BOTTOM_LINE_STEP) % 2 === 0;
  const du = rx + 7 * scale, dv = onLine ? -g / 2 : 0;
  let dot = false;
  for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) {
    if (img.dark(frame.x(h.u + du + a, h.v + dv + b2), frame.y(h.u + du + a, h.v + dv + b2))) dot = true;
  }
  if (dot) return 3;
  // coada: sus în dreapta sau jos în stânga, lungime 3,5 spații
  const len = GAP * 3.5 * scale;
  const stem = (side: number, dir: number) => {
    let on = 0, tot = 0;
    for (let t = 0.35; t <= 0.9; t += 0.05) {
      tot++;
      const uu = h.u + side * (rx - 0.8 * scale), vv = h.v + dir * len * t;
      if (img.dark(frame.x(uu, vv), frame.y(uu, vv)) || img.dark(frame.x(uu + 1, vv), frame.y(uu + 1, vv)) || img.dark(frame.x(uu - 1, vv), frame.y(uu - 1, vv))) on++;
    }
    return on / tot;
  };
  return Math.max(stem(1, -1), stem(-1, 1)) > 0.6 ? 2 : 4;
}

/** Înălțimea (MIDI) fiecărei pătrimi, citită de pe portative; null unde nu e sigură. */
function staffMidis(img: Img, st: Strip, X0: number, scale: number, systems: System[], firstPage: boolean): (number | null)[] | null {
  if (!systems.length) return null;
  const out: (number | null)[] = [];
  let cur: number | null = null;
  systems.forEach((sys, j) => {
    for (const h of readHeads(img, st, X0, scale, sys, firstPage && j === 0, BARS_PER_SYSTEM)) {
      if (h) cur = stepToMidi(h.step, h.sharp);
      out.push(cur);
    }
  });
  return out;
}

// ───────────────────────────── 5. pagina completă ─────────────────────────────

export function decodeScanPage(page: ScanImage, isLastPage = true): ScanResult {
  const img = new Img(page.rgba, page.width, page.height);
  const st = findStrip(img);
  let scale = (st.u1 - st.u0) / STRIP_W;
  const { systems, lineU } = findSystems(img, st, scale);
  // capetele: din liniile portativului, dacă banda pare scurtată (ultimele blocuri foarte deschise)
  let X0 = st.u0, X1 = st.u1;
  const lineSpan = lineU ? lineU[1] - lineU[0] : 0;
  // (bara dublă de final adaugă ~8/1040 la capătul liniilor; doar o diferență mai mare înseamnă bandă scurtată)
  if (lineU && lineSpan > (X1 - X0) * 1.015 && lineSpan < (X1 - X0) * 1.25 && Math.abs(lineU[0] - X0) < 0.02 * lineSpan) {
    X0 = lineU[0]; X1 = lineU[1];
  }
  scale = (X1 - X0) / STRIP_W;
  const Wpx = X1 - X0;
  Object.assign(scanDebug, { u0: st.u0, u1: st.u1, lineU, X0, X1, scale, systems: systems.length });
  const gapPx = GAP_UNITS * scale;

  // prima pagină (cu titlu) sau următoarele: după poziția primului portativ față de bandă
  let firstPage = false;
  if (systems.length) {
    const topY = STRIP_CY + systems[0].top / scale;
    firstPage = Math.abs(topY - (FIRST_TOP + 50)) < Math.abs(topY - (OTHER_TOP + 50));
  }
  const nSys = systems.length;
  let lo = 1, hi = MAX_BEATS;
  if (nSys) { hi = BEATS_PER_SYSTEM * nSys; lo = isLastPage ? hi - BEATS_PER_SYSTEM + 1 : hi; }

  // eșantioane de-a lungul benzii (media pe grosimea ei)
  const half = Math.max(1, st.thick * 0.28);
  const raw: RGB[] = [];
  for (let u = X0; u < X1; u++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let v = -half; v <= half; v += Math.max(1, half / 2)) {
      const c = img.rgb(st.frame.x(u, v), st.frame.y(u, v));
      if (c) { r += c[0]; g += c[1]; b += c[2]; n++; }
    }
    raw.push(n ? [r / n, g / n, b / n] : [255, 255, 255]);
  }
  // negrul (blocul de calibrare) și hârtia (deasupra benzii)
  const calN = Math.max(2, Math.round(Wpx / (MAX_BEATS + 1) * 0.5));
  const black: RGB = [0, 1, 2].map(ch => median(raw.slice(1, 1 + calN).map(c => c[ch]))) as RGB;
  const paperS: RGB[] = [];
  for (let u = X0; u < X1; u += 3) { const c = img.rgb(st.frame.x(u, -st.thick * 1.6), st.frame.y(u, -st.thick * 1.6)); if (c) paperS.push(c); }
  const paper: RGB = [0, 1, 2].map(ch => median(paperS.map(c => c[ch]))) as RGB;
  const norm = (c: RGB): RGB => [0, 1, 2].map(ch => Math.max(0, Math.min(255, ((c[ch] - black[ch]) / Math.max(30, paper[ch] - black[ch])) * 255))) as RGB;
  const S = raw.map(norm);

  // color sau alb-negru?
  const chroma = S.slice(calN * 2).map(c => Math.max(...c) - Math.min(...c)).sort((a, b) => a - b);
  const gray = (chroma[Math.floor(chroma.length * 0.9)] ?? 0) < 28;

  const avgAt = (a: number, b: number): RGB => {
    const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(S.length, Math.max(i0 + 1, Math.ceil(b)));
    let r = 0, g = 0, bb = 0;
    for (let i = i0; i < i1; i++) { r += S[i][0]; g += S[i][1]; bb += S[i][2]; }
    const n = i1 - i0;
    return [r / n, g / n, bb / n];
  };

  const medAt = (a: number, b: number): RGB => {
    const i0 = Math.max(0, Math.round(a)), i1 = Math.min(S.length, Math.max(i0 + 1, Math.round(b) + 1));
    const part = S.slice(i0, i1);
    return [0, 1, 2].map(ch => median(part.map(c => c[ch]))) as RGB;
  };

  if (!gray) {
    // granițele dintre blocuri: golurile magenta + schimbările bruște de culoare
    const mag = S.map(c => Math.min(c[0], c[2]) - c[1]);
    const peaks: number[] = [];
    const sorted = [...mag].sort((a, b) => a - b);
    const thr = Math.max(40, 0.5 * sorted[Math.floor(sorted.length * 0.995)]);
    for (let i = 2; i < mag.length - 2; i++) {
      if (mag[i] > thr && mag[i] >= mag[i - 1] && mag[i] > mag[i + 1]) peaks.push(i);
    }
    const edgeD = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const k2 = Math.max(2, Math.round(gapPx));
    for (let i = k2; i < S.length - k2; i++) {
      const d = edgeD(S[i - k2], S[i + k2]);
      if (d > 120 && d >= edgeD(S[i - k2 - 1] ?? S[0], S[i + k2 - 1]) && d >= edgeD(S[i - k2 + 1], S[i + k2 + 1] ?? S[S.length - 1])) peaks.push(i);
    }
    if (!peaks.length) throw new Error('Blocurile benzii nu se disting (scanare prea slabă?)');
    // numărul de pătrimi: grila care explică cele mai multe granițe (blocul de calibrare = exact 1 unitate)
    let bestB = lo, bestScore = Infinity;
    for (let B = lo; B <= hi; B++) {
      const u = Wpx / (B + 1);
      let sum = 0;
      for (const p of peaks) {
        const t = (p + gapPx / 2) / u;
        const r = t - Math.round(t);
        sum += Math.min(r * r, 0.0625);
      }
      const score = sum / peaks.length;
      if (score < bestScore - 1e-9) { bestScore = score; bestB = B; }
    }
    const B = bestB, u = Wpx / (B + 1);
    Object.assign(scanDebug, { lo, hi, B, bestScore, peaks: peaks.length, black, paperRGB: paper });
    const meas: RGB[] = [];
    // mijlocul fiecărei pătrimi, pe o fereastră îngustă (marginile blocului sunt amestecate cu golul magenta)
    const halfW = Math.max(0.5, (u - gapPx) * 0.18);
    for (let k = 1; k <= B; k++) {
      const c = (k + 0.5) * u - gapPx / 2;
      meas.push(medAt(c - halfW, c + halfW));
    }
    // clasificare + 2 treceri de corecție afină pe paletă (decolorare, nuanță schimbată la tipar/scanare)
    // reper de saturație: mijlocul golurilor magenta (doar dacă sunt destul de late ca să fie curate)
    const anchors: { m: RGB; t: RGB; w: number }[] = [
      { m: [0, 0, 0], t: [0, 0, 0], w: B / 4 }, { m: [255, 255, 255], t: [255, 255, 255], w: B / 4 },
    ];
    if (gapPx >= 4) {
      const mids: RGB[] = [];
      for (let k = 1; k <= B; k++) {
        const c = k * u - gapPx / 2;
        const s = avgAt(c - 0.5, c + 0.5);
        if (Math.min(s[0], s[2]) - s[1] > 60) mids.push(s);
      }
      if (mids.length >= 3) {
        const mm: RGB = [0, 1, 2].map(ch => median(mids.map(c => c[ch]))) as RGB;
        anchors.push({ m: mm, t: [230, 0, 170], w: B / 4 });
      }
    }
    // modelul de degradare tipar/scaner: gamma (contrast) + pierdere de saturație. Alegem perechea care
    // aduce culorile măsurate cel mai aproape de celulele paletei, apoi rafinăm cu o potrivire afină.
    const PAL: RGB[] = [];
    for (let row = ROW_MIN; row <= ROW_MAX; row++) for (let col = 0; col < NOTES.length; col++) PAL.push(cellColor(col, row));
    const undo = (c: RGB, g: number, sat: number): RGB => {
      const v = c.map(x => 255 * Math.pow(Math.max(0, x) / 255, g));
      const m = (v[0] + v[1] + v[2]) / 3;
      return v.map(x => Math.max(0, Math.min(255, m + (x - m) * sat))) as RGB;
    };
    const fitErr = (g: number, sat: number) => {
      let e = 0;
      for (const m of meas) {
        const c = undo(m, g, sat);
        // cât de limpede cade culoarea pe o singură celulă: cea mai apropiată / a doua cea mai apropiată
        // (distanța absolută singură ar favoriza zona închisă a paletei, unde celulele sunt înghesuite)
        let d1 = Infinity, d2 = Infinity;
        for (const p of PAL) {
          const d = colorDistance(c, p);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        e += Math.sqrt(d1 / (d2 + 1));
      }
      return e;
    };
    let bg = 1, bs = 1, be = fitErr(1, 1);
    for (let g = 0.6; g <= 1.65; g += 0.05) for (let sat = 0.8; sat <= 2.01; sat += 0.05) {
      const e = fitErr(g, sat);
      if (e < be) { be = e; bg = g; bs = sat; }
    }
    // rafinare fină în jurul celei mai bune perechi
    const g0 = bg, s0 = bs;   // limite fixe (bg/bs se schimbă în buclă)
    for (let g = g0 - 0.04; g <= g0 + 0.041; g += 0.01) for (let sat = s0 - 0.04; sat <= s0 + 0.041; sat += 0.01) {
      const e = fitErr(g, sat);
      if (e < be) { be = e; bg = g; bs = sat; }
    }
    Object.assign(scanDebug, { gamma: bg, sat: bs });
    const meas0 = meas.slice();
    for (let i = 0; i < meas.length; i++) meas[i] = undo(meas0[i], bg, bs);
    for (const a of anchors) a.m = undo(a.m, bg, bs);
    scanDebug.meas = meas;
    let cells = meas.map(nearestCell);
    let fixed = meas;
    for (let it = 0; it < AFFINE_PASSES; it++) {
      const pairs = meas.map((m, i) => ({ m, t: cellColor(cells[i].col, cells[i].row), w: 1 }));
      pairs.push(...anchors);
      const fix = fitAffine(pairs);
      fixed = meas.map(fix);
      cells = fixed.map(nearestCell);
    }
    // înălțimea citită de pe portativ restrânge alegerea la celulele cu aceeași notă: nuanțele vecine
    // (ex. rândurile 9 și 10) diferă cu mai puțin decât poate reproduce tiparul, dar sună diferit
    const midis = staffMidis(img, st, X0, scale, systems, firstPage);
    let used = 0;
    if (midis) {
      // portativul e sursa sigură pentru înălțime; culoarea alege doar nuanța dintre celulele cu acea notă.
      // Cu notele astfel fixate, corecția de culoare se reface pe perechi sigure (coloana e aproape mereu
      // corectă), apoi nuanța se alege din nou – de câteva ori.
      const pick = (col: RGB[], i: number, c: PageCell) => {
        const m = midis[i];
        const cand = m == null ? null : CELLS_BY_MIDI.get(m);
        if (!cand) return c;
        let best = cand[0], bd = Infinity;
        for (const x of cand) { const d = colorDistance(col[i], cellColor(x.col, x.row)); if (d < bd) { bd = d; best = x; } }
        return best;
      };
      const base = cells;
      cells = base.map((c, i) => pick(fixed, i, c));
      for (let it = 0; it < 3; it++) {
        const pairs = meas.map((m, i) => ({ m, t: cellColor(cells[i].col, cells[i].row), w: 1 }));
        pairs.push(...anchors);
        const fix = fitAffine(pairs);
        const f2 = meas.map(fix);
        cells = base.map((c, i) => pick(f2, i, c));
      }
      used = cells.filter((c, i) => c.col !== base[i].col || c.row !== base[i].row).length;
    }
    scanDebug.staffFixes = used;
    scanDebug.midis = midis;
    return { cells, mode: 'color', systems: nSys, beats: B };
  }

  // ── alb-negru: notele de pe portativ ──
  if (!nSys) throw new Error('Scanare alb-negru fără portative vizibile – nu se poate citi');
  const heads: (Head | null)[] = [];
  const sysOf: number[] = [];
  systems.forEach((sys, j) => {
    const firstOfPiece = firstPage && j === 0;
    const hs = readHeads(img, st, X0, scale, sys, firstOfPiece, BARS_PER_SYSTEM);
    hs.forEach(h => { heads.push(h); sysOf.push(j); });
  });
  let lastOn = -1;
  heads.forEach((h, i) => { if (h) lastOn = i; });
  if (lastOn < 0 || !heads[0]) throw new Error('Nu am găsit note pe portativ');
  let B = BEATS_PER_SYSTEM * nSys;
  if (isLastPage) {
    const h = heads[lastOn]!;
    B = Math.min(B, Math.max(lo, lastOn + headBeats(img, st, scale, h, systems[sysOf[lastOn]].gap)));
  }
  const u = Wpx / (B + 1);
  const cells: PageCell[] = [];
  let cur: PageCell = { col: 0, row: 0 };
  for (let k = 0; k < B; k++) {
    const h = heads[k];
    if (h) {
      const midi = stepToMidi(h.step, h.sharp);
      let cand = CELLS_BY_MIDI.get(midi);
      if (!cand) {
        const keys = [...CELLS_BY_MIDI.keys()];
        const near = keys.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a), keys[0]);
        cand = CELLS_BY_MIDI.get(near)!;
      }
      // nuanța: luminozitatea blocului din bandă (dacă banda e lizibilă), altfel rândul cel mai apropiat de 0
      const c = (k + 1.5) * u - gapPx / 2;
      const L = lumOf(avgAt(c - u * 0.2, c + u * 0.2));
      cur = cand.reduce((a, b) => {
        const da = Math.abs(lumOf(cellColor(a.col, a.row)) - L), db = Math.abs(lumOf(cellColor(b.col, b.row)) - L);
        return db < da - 1e-6 || (Math.abs(db - da) < 1e-6 && Math.abs(b.row) < Math.abs(a.row)) ? b : a;
      });
    }
    cells.push(cur);
  }
  return { cells, mode: 'gray', systems: nSys, beats: B };
}
