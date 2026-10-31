// Portativul (cheia Sol): MIDI → poziție verticală.
// Treaptă diatonică absolută: step = 7·octavă + index(Do..Si).
// Linia de jos = Mi (MIDI 64), linia de sus = Fa (MIDI 77). Notele microtonale
// sunt rotunjite la cel mai apropiat semiton; abaterea se păstrează în `cents`.

const STEP_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const SHARP_PC = [false, true, false, true, false, false, true, false, true, false, true, false];

export const BOTTOM_LINE_STEP = 7 * Math.floor(64 / 12) + STEP_OF_PC[64 % 12]; // Mi, MIDI 64
export const TOP_LINE_STEP = BOTTOM_LINE_STEP + 8;                              // Fa, MIDI 77

export interface StaffPos { step: number; sharp: boolean; cents: number }

export function midiToStaff(midiFloat: number): StaffPos {
  'worklet';
  const m = Math.round(midiFloat);
  const pc = ((m % 12) + 12) % 12;
  return {
    step: 7 * Math.floor(m / 12) + STEP_OF_PC[pc],
    sharp: SHARP_PC[pc],
    cents: Math.round((midiFloat - m) * 100),
  };
}

/** y pentru o treaptă; lineGap = distanța dintre două linii ale portativului. */
export function staffY(step: number, bottomLineY: number, lineGap: number): number {
  'worklet';
  return bottomLineY - ((step - BOTTOM_LINE_STEP) * lineGap) / 2;
}

/** Treptele liniilor suplimentare necesare pentru o notă. */
export function ledgerSteps(step: number): number[] {
  'worklet';
  const out: number[] = [];
  for (let s = BOTTOM_LINE_STEP - 2; s >= step; s -= 2) out.push(s);
  for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) out.push(s);
  return out;
}
