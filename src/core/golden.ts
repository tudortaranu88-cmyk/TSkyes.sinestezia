// Matricea Aurie – portată 1:1 din daw_sinestezic_avansat_v4.html
// 8 coloane (Do3..Do4) × 21 rânduri (-10..+10). Rândul 0 = notele fundamentale.

export const NOTES = ['Do3', 'Re3', 'Mi3', 'Fa3', 'Sol3', 'La3', 'Si3', 'Do4'] as const;
export const BASE_FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
export const BASE_MIDI = [60, 62, 64, 65, 67, 69, 71, 72]; // convenția aplicației: Do3 = MIDI 60
export const BASE_COLORS: [number, number, number][] = [
  [204, 17, 0], [226, 91, 1], [247, 181, 0], [0, 66, 37],
  [0, 32, 96], [41, 18, 54], [74, 25, 66], [244, 244, 240],
];
export const GOLDEN_RATE = 0.01618; // pasul microtonal al matricei (1,618%)
export const ROW_MIN = -10;
export const ROW_MAX = 10;

export type Tuning = 'tempered' | 'diatonic' | 'golden';
export type RGB = [number, number, number];

const MAJOR_PCS = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
export function freqToMidi(f: number): number {
  return 69 + 12 * Math.log2(f / 440);
}
export function midiName(m: number): string {
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 2);
}
export function goldenFactor(r: number): number {
  return r >= 0 ? Math.pow(1 + GOLDEN_RATE, r) : Math.pow(1 - GOLDEN_RATE, Math.abs(r));
}

/** Frecvența (și nota MIDI în modurile curate) pentru celula (coloana c, rândul r). */
export function cellPitch(c: number, r: number, tuning: Tuning): { freq: number; midi: number | null } {
  const factor = goldenFactor(r);
  if (tuning === 'golden') return { freq: BASE_FREQS[c] * factor, midi: null };
  const x = BASE_MIDI[c] + 12 * Math.log2(factor);
  let k = Math.round(x);
  if (tuning === 'diatonic') {
    let bestK = k;
    let bestD = Infinity;
    for (let t = Math.floor(x) - 2; t <= Math.ceil(x) + 2; t++) {
      if (!MAJOR_PCS.includes(((t % 12) + 12) % 12)) continue;
      const d = Math.abs(t - x);
      if (d < bestD) { bestD = d; bestK = t; }
    }
    k = bestK;
  }
  return { freq: midiToFreq(k), midi: k };
}

/** Culoarea celulei: rânduri pozitive → spre alb, negative → spre negru (identic cu DAW-ul). */
export function cellColor(c: number, r: number): RGB {
  let [R, G, B] = BASE_COLORS[c];
  if (r > 0) {
    const w = Math.pow(r / 10, 0.85) * 0.7;
    R = Math.round(R + (255 - R) * w); G = Math.round(G + (255 - G) * w); B = Math.round(B + (255 - B) * w);
  } else if (r < 0) {
    const w = Math.pow(Math.abs(r) / 10, 0.85) * 0.7;
    R = Math.round(R * (1 - w)); G = Math.round(G * (1 - w)); B = Math.round(B * (1 - w));
  }
  return [R, G, B];
}

export function rgbToCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}
export function textColorFor([r, g, b]: RGB): string {
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#111' : '#fff';
}
