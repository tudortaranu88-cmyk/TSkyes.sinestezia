import type { RGB } from './golden';

/** Evenimentul trimis de claviatură către vizualizator. */
export interface NoteEvent {
  id: number;
  col: number;               // 0..7 (Do3..Do4)
  row: number;               // -10..+10
  label: string;             // ex. "Sol3 (+2)"
  freq: number;
  midiFloat: number;         // înălțimea exactă (poate fi microtonală)
  color: RGB;
  startMs: number;           // momentul apăsării
  durationMs: number | null; // null cât timp butonul este ținut apăsat
  instrument?: string;       // id-ul instrumentului (src/core/instruments.ts)
}
