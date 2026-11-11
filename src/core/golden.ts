// Matricea Aurie – portată 1:1 din daw_sinestezic_avansat_v4.html
// 8 coloane (Do3..Do4) × 21 rânduri (-10..+10). Rândul 0 = notele fundamentale.

export const NOTES = ['Do3', 'Re3', 'Mi3', 'Fa3', 'Sol3', 'La3', 'Si3', 'Do4'] as const;

// Numele afișate: rândul 0 = fundamentalele fără cifră; ultimul Do (octava de sus) poartă un apostrof.
export const NOTE_LABELS = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', "Do'"] as const;

/** Sufixul rândului: 0 → '', pozitiv → „+n”, negativ → „-n”. */
export function rowSuffix(row: number): string {
  return row === 0 ? '' : row > 0 ? `+${row}` : `${row}`;
}

/** Numele afișat al celulei (coloana c, rândul r): nume de bază + sufixul rândului. Ex.: Do, Re+2, Do'-3. */
export function noteLabel(c: number, r: number): string {
  return NOTE_LABELS[c] + rowSuffix(r);
}
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

// ----- Palete de culori (selectorul din Nivelul 1). Culorile de mai jos sunt rândul 0; celelalte
// rânduri se obțin la fel pentru orice paletă: pozitive → spre alb, negative → spre negru. -----
export type PaletteId = 'aurie' | 'cmyk' | 'ral';

export const PALETTES: { id: PaletteId; label: string; colors: RGB[]; names: string[] }[] = [
  { id: 'aurie', label: 'Aurie', colors: BASE_COLORS, names: [] },
  {
    // cernelurile de tipar și amestecurile lor (valori sRGB aproximative pentru 100% cerneală)
    id: 'cmyk', label: 'CMYK',
    colors: [[237, 28, 36], [255, 242, 0], [0, 166, 81], [0, 174, 239], [46, 49, 146], [236, 0, 140], [88, 89, 91], [255, 255, 255]],
    names: ['M100 Y100', 'Y100', 'C100 Y100', 'C100', 'C100 M100', 'M100', 'K70', 'hârtie'],
  },
  {
    // RAL Classic (valori sRGB aproximative ale cartelei)
    id: 'ral', label: 'RAL',
    colors: [[204, 6, 5], [226, 83, 3], [247, 181, 0], [87, 166, 57], [0, 131, 81], [34, 113, 179], [108, 70, 117], [241, 236, 225]],
    names: ['RAL 3020', 'RAL 2004', 'RAL 1023', 'RAL 6018', 'RAL 6024', 'RAL 5015', 'RAL 4005', 'RAL 9010'],
  },
];

export function paletteColors(id: PaletteId = 'aurie'): RGB[] {
  return (PALETTES.find(p => p.id === id) ?? PALETTES[0]).colors;
}

/** Culoarea celulei: rânduri pozitive → spre alb, negative → spre negru (identic cu DAW-ul). */
export function cellColor(c: number, r: number, palette: PaletteId = 'aurie'): RGB {
  let [R, G, B] = paletteColors(palette)[c];
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
