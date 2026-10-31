// Previzualizare Canvas 2D a scenei – folosește EXACT aceleași module din src/core.
// Construire: bun build test/preview.ts --outfile test/preview.js  → deschide test/preview.html
import { buildScene, type Scene } from '../src/core/scene';
import { cellPitch, cellColor, freqToMidi, NOTES, rgbToCss, textColorFor } from '../src/core/golden';
import type { NoteEvent } from '../src/core/types';

const rgba = (c: [number, number, number], a: number) => rgbToCss(c, a);

function draw(ctx: CanvasRenderingContext2D, s: Scene, w: number, h: number) {
  ctx.fillStyle = '#0e0e12'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
  for (const y of s.staffLines) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (const l of s.ledgers) { ctx.beginPath(); ctx.moveTo(l.x1, l.y); ctx.lineTo(l.x2, l.y); ctx.stroke(); }
  for (const n of s.staffNotes) {
    ctx.fillStyle = rgba(n.color, n.alpha);
    ctx.beginPath(); ctx.roundRect(n.x, n.y - n.h / 2, n.w, n.h, n.h / 2); ctx.fill();
    if (n.sharp) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `${n.h}px sans-serif`; ctx.fillText('♯', n.x - n.h, n.y + n.h / 3); }
  }
  ctx.strokeStyle = 'rgba(255,215,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
  s.guide.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.lineCap = 'round';
  for (const a of s.arcs) { // halou deschis: culorile închise rămân vizibile pe fond închis
    ctx.strokeStyle = `rgba(255,255,255,${0.18 * a.alpha})`; ctx.lineWidth = a.strokeWidth * 1.35; ctx.beginPath();
    a.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
  for (const a of s.arcs) {
    ctx.strokeStyle = rgba(a.color, a.alpha); ctx.lineWidth = a.strokeWidth; ctx.beginPath();
    a.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
  for (const n of s.nodes) {
    ctx.fillStyle = rgba(n.color, n.alpha); ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * n.alpha})`; ctx.lineWidth = Math.max(0.5, n.radius * 0.12); ctx.stroke();
  }
}

function drawKeyboard(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, row: number) {
  ctx.fillStyle = '#181822'; ctx.fillRect(x0, y0, w, h);
  const pad = 10, cols = 4, rows = 2, top = 56;
  const bw = (w - pad * (cols + 1)) / cols, bh = (h - top - pad * (rows + 1)) / rows;
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`−   Rând ${row > 0 ? '+' + row : row}   +`, x0 + w / 2, y0 + 34);
  for (let c = 0; c < 8; c++) {
    const col = c % cols, r = Math.floor(c / cols);
    const bx = x0 + pad + col * (bw + pad), by = y0 + top + pad + r * (bh + pad);
    const color = cellColor(c, row);
    ctx.fillStyle = rgbToCss(color); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill();
    ctx.fillStyle = textColorFor(color); ctx.font = 'bold 15px sans-serif';
    ctx.fillText(NOTES[c], bx + bw / 2, by + bh / 2 + 5);
  }
  ctx.textAlign = 'start';
}

export function demo(canvas: HTMLCanvasElement, nowMs: number, insertPhase: number, n: number) {
  const W = canvas.width, H = canvas.height, top = H / 2;
  const ctx = canvas.getContext('2d')!;
  const melody = [[0, 0], [2, 1], [4, 0], [5, 2], [7, 3], [6, -2], [4, -4], [3, 5], [1, 7], [5, -6], [7, 10], [0, -10]];
  const events: NoteEvent[] = [];
  let t = nowMs - n * 700;
  for (let i = 0; i < n; i++) {
    const [c, r] = melody[i % melody.length];
    const { freq } = cellPitch(c, r, 'golden');
    events.push({ id: i, col: c, row: r, label: NOTES[c], freq, midiFloat: freqToMidi(freq), color: cellColor(c, r),
      startMs: t, durationMs: i === n - 1 ? null : 200 + (i * 373) % 1800 });
    t += 700;
  }
  const scene = buildScene({ width: W, height: top, events, nowMs, insertPhase, pxPerSec: 60 });
  draw(ctx, scene, W, top);
  drawKeyboard(ctx, 0, top, W, H - top, 0);
  ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
  return scene;
}
(globalThis as any).demo = demo;
