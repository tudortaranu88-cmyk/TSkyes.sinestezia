// Simulatorul de scanări pentru teste: randare a primitivelor paginii + degradări de scaner.
import { PAGE_W, PAGE_H, type Prim } from '../src/core/scoreLayout';
import type { RGB } from '../src/core/golden';

// ── randare simplă a primitivelor (fără text și cheie – nu contează pentru citire) ──
export function render(prims: Prim[]): Float32Array {
  const px = new Float32Array(PAGE_W * PAGE_H * 3).fill(255);
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
    const i = (y * PAGE_W + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  };
  const INK: RGB = [17, 17, 17];
  for (const p of prims) {
    if (p.k === 'rect') {
      for (let y = Math.round(p.y); y < Math.round(p.y + p.h); y++) for (let x = Math.round(p.x); x < Math.round(p.x + p.w); x++) put(x, y, p.color);
    } else if (p.k === 'line') {
      const x0 = Math.floor(Math.min(p.x1, p.x2) - p.w), x1 = Math.ceil(Math.max(p.x1, p.x2) + p.w);
      const y0 = Math.floor(Math.min(p.y1, p.y2) - p.w), y1 = Math.ceil(Math.max(p.y1, p.y2) + p.w);
      const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L2 = dx * dx + dy * dy || 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = Math.max(0, Math.min(1, ((x + 0.5 - p.x1) * dx + (y + 0.5 - p.y1) * dy) / L2));
        const d = Math.hypot(x + 0.5 - (p.x1 + t * dx), y + 0.5 - (p.y1 + t * dy));
        if (d <= p.w / 2 + 0.25) put(x, y, INK);
      }
    } else if (p.k === 'head') {
      const a = (-20 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const R = Math.max(p.rx, p.ry) + 2;
      for (let y = Math.floor(p.cy - R); y <= p.cy + R; y++) for (let x = Math.floor(p.cx - R); x <= p.cx + R; x++) {
        const X = x + 0.5 - p.cx, Y = y + 0.5 - p.cy;
        const ex = X * c + Y * s, ey = -X * s + Y * c;       // în cadrul elipsei
        const r = Math.hypot(ex / p.rx, ey / p.ry);
        if (p.filled ? r <= 1 : Math.abs(r - 1) * Math.min(p.rx, p.ry) <= 1.1) put(x, y, INK);
      }
    } else if (p.k === 'dot') {
      for (let y = Math.floor(p.cy - p.r); y <= p.cy + p.r; y++) for (let x = Math.floor(p.cx - p.r); x <= p.cx + p.r; x++)
        if (Math.hypot(x + 0.5 - p.cx, y + 0.5 - p.cy) <= p.r) put(x, y, INK);
    }
  }
  return px;
}

export interface Scan { scale: number; angle: number; offX: number; offY: number; extraW: number; extraH: number;
  color?: (c: RGB) => RGB; noise?: number; blur?: boolean; gray?: boolean; border?: boolean; seed?: number }

// ── „scanarea”: transformare geometrică (biliniar) + culoare + neclaritate + zgomot ──
export function scan(src: Float32Array, o: Scan) {
  const W = Math.round(PAGE_W * o.scale + o.extraW), H = Math.round(PAGE_H * o.scale + o.extraH);
  const a = (o.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  let out = new Float32Array(W * H * 3);
  const cx = PAGE_W / 2, cy = PAGE_H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // imagine → pagină (inversa: mutare, rotire, scalare)
    const X = (x - o.offX - (PAGE_W * o.scale) / 2) / o.scale, Y = (y - o.offY - (PAGE_H * o.scale) / 2) / o.scale;
    const px = X * c + Y * s + cx, py = -X * s + Y * c + cy;
    const i = (y * W + x) * 3;
    if (px < 0 || py < 0 || px >= PAGE_W - 1 || py >= PAGE_H - 1) {
      const v = o.border ? 20 : 250; out[i] = v; out[i + 1] = v; out[i + 2] = v; continue;
    }
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    for (let ch = 0; ch < 3; ch++) {
      const g = (xx: number, yy: number) => src[(yy * PAGE_W + xx) * 3 + ch];
      out[i + ch] = g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy;
    }
  }
  if (o.blur) {
    const b = new Float32Array(out.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let ch = 0; ch < 3; ch++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const wgt = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
        sum += out[(yy * W + xx) * 3 + ch] * wgt; n += wgt;
      }
      b[(y * W + x) * 3 + ch] = sum / n;
    }
    out = b;
  }
  let seed = o.seed ?? 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    let col: RGB = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]];
    if (o.color) col = o.color(col);
    if (o.gray) { const l = 0.299 * col[0] + 0.587 * col[1] + 0.114 * col[2]; col = [l, l, l]; }
    for (let ch = 0; ch < 3; ch++) rgba[i * 4 + ch] = Math.max(0, Math.min(255, Math.round(col[ch] + (o.noise ? rnd() * 2 * o.noise : 0))));
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, width: W, height: H };
}

// tipar + scaner: hârtie îngălbenită, culori decolorate, contrast mai mic
export const printed = (c: RGB): RGB => {
  const l = (c[0] + c[1] + c[2]) / 3;
  const d = c.map(v => l + (v - l) * 0.72);                       // saturație −28%
  return [d[0] * 0.9 + 18, d[1] * 0.88 + 16, d[2] * 0.8 + 12] as RGB;   // hârtie ≈ (247, 240, 216)
};
export const dim = (c: RGB): RGB => c.map(v => 255 * Math.pow(v / 255, 1.25) * 0.85 + 8) as RGB;

