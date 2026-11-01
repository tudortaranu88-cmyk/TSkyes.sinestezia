// Construiește scena jumătății superioare (portativ + spirală) ca listă de primitive.
// Funcție pură 'worklet': aceeași logică o desenează Skia (pe telefon) și Canvas 2D (testele).

import type { NoteEvent } from './types';
import type { RGB } from './golden';
import { fitSpiral, noteSegment, pointAt, PHI, B, QUARTER, type Point, type SpiralConfig } from './spiral';
import { midiToStaff, staffY, ledgerSteps } from './staff';

export interface SceneInput {
  width: number;
  height: number;
  events: NoteEvent[];   // cronologic: cea mai nouă = ultima
  nowMs: number;
  insertPhase: number;   // 0 → 1: animația de intrare a celei mai noi note
  pxPerSec: number;      // viteza de derulare a portativului
  fill?: number;         // cât din raza disponibilă ocupă spirala (implicit 0,92)
  minRadius?: number;    // notele mai mici de atât (px) nu se desenează (implicit 0,3)
}

export interface Arc { points: Point[]; strokeWidth: number; color: RGB; alpha: number }
export interface Node { x: number; y: number; radius: number; color: RGB; alpha: number }
export interface StaffNote { x: number; y: number; w: number; h: number; color: RGB; alpha: number; sharp: boolean }
export interface Scene {
  spiral: SpiralConfig;
  staffLines: number[];                                 // y-urile celor 5 linii
  ledgers: { x1: number; x2: number; y: number }[];
  staffNotes: StaffNote[];
  guide: Point[];                                       // spirala-ghid (fină)
  arcs: Arc[];
  nodes: Node[];
}

/** Opacitatea codifică durata (geometria rămâne strict aurie). */
export function durationAlpha(durationMs: number | null): number {
  'worklet';
  if (durationMs === null) return 1;
  return 0.45 + 0.55 * Math.min(1, durationMs / 2000);
}

export function buildScene(inp: SceneInput): Scene {
  'worklet';
  const { width, height, events, nowMs, insertPhase, pxPerSec } = inp;
  const fill = inp.fill ?? 0.92;
  const minR = inp.minRadius ?? 0.3;
  const n = events.length;

  // Creștere spre exterior: nota i (0 = prima) ocupă θ ∈ [i·π/2, (i+1)·π/2]; fiecare notă nouă
  // continuă spirala în afară, de φ ori mai mare decât precedenta. „Camera” face zoom out continuu,
  // astfel încât vârful notei celei mai noi să fie mereu la marginea zonei → toată compoziția e vizibilă.
  // Schimbă doar scara globală `a` → raporturile φ rămân exacte.
  const tipExp = Math.max(1, n - 1 + insertPhase);
  const maxR = (Math.min(width, height) / 2) * fill;
  const spiral = fitSpiral(width, height, tipExp);
  spiral.a = maxR / Math.pow(PHI, tipExp);

  // --- portativ ---
  const lineGap = height / 14;
  const bottomY = height / 2 + 2 * lineGap;
  const staffLines: number[] = [];
  for (let i = 0; i < 5; i++) staffLines.push(bottomY - i * lineGap);

  const staffNotes: StaffNote[] = [];
  const ledgers: { x1: number; x2: number; y: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const e = events[i];
    const held = e.durationMs === null ? nowMs - e.startMs : e.durationMs;
    const x = spiral.cx - ((nowMs - e.startMs) / 1000) * pxPerSec;
    const w = Math.max(lineGap, (held / 1000) * pxPerSec);
    if (x + w < 0) break; // restul sunt mai vechi și au ieșit din ecran
    const pos = midiToStaff(e.midiFloat);
    const y = staffY(pos.step, bottomY, lineGap);
    staffNotes.push({ x, y, w, h: lineGap * 0.9, color: e.color, alpha: durationAlpha(e.durationMs), sharp: pos.sharp });
    const ls = ledgerSteps(pos.step);
    for (let k = 0; k < ls.length; k++) ledgers.push({ x1: x - lineGap * 0.4, x2: x + Math.min(w, lineGap * 1.4) + lineGap * 0.4, y: staffY(ls[k], bottomY, lineGap) });
  }

  // --- spirala ---
  // notele prea mici (rază sub minR px) nu se mai văd → nu le desenăm
  const first = Math.max(0, Math.floor(Math.log(minR / spiral.a) / Math.log(PHI)));
  const arcs: Arc[] = [];
  const nodes: Node[] = [];
  for (let i = first; i < n; i++) {               // de la cea mai veche spre cea mai nouă
    const e = events[i];
    const newest = i === n - 1;
    const seg = noteSegment(i, spiral, 28);
    let points = seg.points;
    if (newest && insertPhase < 1) {               // nota nouă se „desenează” din nodul ei spre exterior
      points = [];
      const t0 = i * QUARTER, t1 = (i + Math.max(0.02, insertPhase)) * QUARTER;
      for (let j = 0; j <= 28; j++) points.push(pointAt(t0 + ((t1 - t0) * j) / 28, spiral));
    }
    let alpha = durationAlpha(e.durationMs);
    if (newest) alpha *= Math.min(1, 0.3 + insertPhase);
    arcs.push({ points, strokeWidth: seg.strokeWidth, color: e.color, alpha });
    nodes.push({ x: seg.node.x, y: seg.node.y, radius: seg.node.radius, color: e.color, alpha });
  }

  // ghidul fin: de unde spirala devine vizibilă până la un sfert de tură după vârf
  const guide: Point[] = [];
  const g0 = Math.max(0, Math.log(minR / spiral.a) / B);
  const g1 = (tipExp + 1) * QUARTER;
  const gSteps = Math.max(16, Math.ceil(((g1 - g0) / QUARTER) * 16));
  for (let i = 0; i <= gSteps; i++) guide.push(pointAt(g0 + ((g1 - g0) * i) / gSteps, spiral));

  return { spiral, staffLines, ledgers, staffNotes, guide, arcs, nodes };
}
