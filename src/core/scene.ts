// Construiește scena jumătății superioare (portativ + spirală) ca listă de primitive.
// Funcție pură 'worklet': aceeași logică o desenează Skia (pe telefon) și Canvas 2D (testele).

import type { NoteEvent } from './types';
import type { RGB } from './golden';
import { fitSpiral, noteSegment, visibleCount, pointAt, QUARTER, type Point, type SpiralConfig } from './spiral';
import { midiToStaff, staffY, ledgerSteps } from './staff';

export interface SceneInput {
  width: number;
  height: number;
  events: NoteEvent[];   // cronologic: cea mai nouă = ultima
  nowMs: number;
  insertPhase: number;   // 0 → 1: animația de intrare a celei mai noi note
  pxPerSec: number;      // viteza de derulare a portativului
  notesVisible?: number; // câte note încap pe spirală (implicit 9)
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
  // Zoom adaptiv: cu puține note, spirala e mărită ca să umple zona; de la `notesVisible`
  // note în sus scara se fixează. Schimbă doar scara globală `a` → raporturile φ rămân exacte.
  const notesVisible = inp.notesVisible ?? 6;
  const zoomExp = Math.min(notesVisible, Math.max(1, events.length - 1 + insertPhase));
  const spiral = fitSpiral(width, height, zoomExp);
  const maxR = Math.min(width, height) / 2;
  const limit = visibleCount(spiral, Math.hypot(width, height) / 2) + 1;

  // --- portativ ---
  const lineGap = height / 14;
  const bottomY = height / 2 + 2 * lineGap;
  const staffLines: number[] = [];
  for (let i = 0; i < 5; i++) staffLines.push(bottomY - i * lineGap);

  const staffNotes: StaffNote[] = [];
  const ledgers: { x1: number; x2: number; y: number }[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
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
  // vârsta u: cea mai nouă notă intră de la u = -1 (în pol) la u = 0
  const arcs: Arc[] = [];
  const nodes: Node[] = [];
  const shift = insertPhase - 1;
  const count = Math.min(events.length, limit);
  for (let k = count - 1; k >= 0; k--) {           // desenăm de la cea mai veche spre cea mai nouă
    const e = events[events.length - 1 - k];
    const u = k + shift;
    const seg = noteSegment(u, spiral, 28);
    let alpha = durationAlpha(e.durationMs);
    if (seg.r0 > maxR) alpha *= Math.max(0, 1 - (seg.r0 - maxR) / maxR); // stingere în afara cercului util
    if (k === 0) alpha *= Math.min(1, insertPhase * 1.5);                 // apariție lină din centru
    arcs.push({ points: seg.points, strokeWidth: seg.strokeWidth, color: e.color, alpha });
    nodes.push({ x: seg.node.x, y: seg.node.y, radius: seg.node.radius, color: e.color, alpha });
  }

  const guide: Point[] = [];
  const steps = (limit + 1) * 16;
  for (let i = 0; i <= steps; i++) guide.push(pointAt(-2 * QUARTER + (i / 16) * QUARTER, spiral));

  return { spiral, staffLines, ledgers, staffNotes, guide, arcs, nodes };
}
