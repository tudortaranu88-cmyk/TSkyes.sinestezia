// Ritmuri de tobe (sintetizate; sample-urile vin ulterior). Un tipar = o măsură de 4/4 împărțită
// în 16 pătrimi de dublă (16 „pași”). Tiparul se repetă pe toată durata melodiei.

import { PHI } from './spiral';

export type DrumId = 'backbeat' | 'fourfloor' | 'dembow' | 'halftime' | 'golden';
type Piece = 'k' | 's' | 'h';          // kick (toba mare), snare (toba mică), hi-hat
interface Hit { step: number; piece: Piece; vol: number }

const at = (piece: Piece, steps: number[], vol: number): Hit[] => steps.map(step => ({ step, piece, vol }));
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];
const SIXTEENTHS = Array.from({ length: 16 }, (_, i) => i);

export const DRUM_PATTERNS: { id: DrumId; label: string; hits: Hit[]; golden?: boolean }[] = [
  // Pulsul de bază al pop-ului/rock-ului: kick pe 1 și 3, snare pe 2 și 4.
  { id: 'backbeat', label: 'Backbeat', hits: [...at('k', [0, 8], 1), ...at('s', [4, 12], 0.9), ...at('h', EIGHTHS, 0.45)] },
  // Kick pe fiecare timp: pulsația hipnotică din house, techno, disco.
  { id: 'fourfloor', label: 'Four-on-the-floor', hits: [...at('k', [0, 4, 8, 12], 1), ...at('h', [2, 6, 10, 14], 0.55)] },
  // Tresillo 3+3+2 (pași de 8-ime: 0, 3, 6 → pași de 16-ime: 0, 6, 12) – dembow / reggaeton.
  { id: 'dembow', label: 'Dembow', hits: [...at('k', [0, 6, 12], 1), ...at('s', [4, 12], 0.9), ...at('h', EIGHTHS, 0.35)] },
  // Snare pe timpul 3, hi-hat rapid: senzație de tempo lent (trap, lo-fi).
  { id: 'halftime', label: 'Half-time', hits: [...at('k', [0, 10], 1), ...at('s', [8], 0.9), ...SIXTEENTHS.map(step => ({ step, piece: 'h' as Piece, vol: step % 4 === 0 ? 0.5 : 0.28 }))] },
  // Ritm auriu: lovituri rare, cu pauză CONSTANTĂ = φ × o pătrime (unitate fixă). Nu se aude
  // continuu; kick și snare alternează la fiecare interval auriu.
  { id: 'golden', label: 'Auriu (φ)', hits: [], golden: true },
];

/** Momentele (secunde) loviturilor ritmului auriu: pornesc la `startSec`, cu pasul φ × o pătrime. */
export function goldenHitTimes(bpm: number, startSec: number, endSec: number): number[] {
  const gap = (60 / bpm) * PHI;         // unitatea fixă = o pătrime; pauza = φ × unitate
  const out: number[] = [];
  for (let t = startSec; t < endSec; t += gap) out.push(t);
  return out;
}

export function drumPattern(id: DrumId) {
  const p = DRUM_PATTERNS.find(x => x.id === id);
  if (!p) throw new Error(`Ritm necunoscut: ${id}`);
  return p;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
}

function addKick(out: Float32Array, i0: number, sr: number, vol: number) {
  const len = Math.floor(0.45 * sr);
  let phase = 0;
  for (let k = 0; k < len && i0 + k < out.length; k++) {
    const t = k / sr;
    phase += (2 * Math.PI * (45 + 120 * Math.exp(-t / 0.035))) / sr;   // glisando în jos
    out[i0 + k] += Math.sin(phase) * vol * Math.exp(-t / 0.14);
  }
}

function addSnare(out: Float32Array, i0: number, sr: number, vol: number, rnd: () => number) {
  const len = Math.floor(0.25 * sr);
  let phase = 0;
  for (let k = 0; k < len && i0 + k < out.length; k++) {
    const t = k / sr;
    phase += (2 * Math.PI * 190) / sr;
    out[i0 + k] += (0.6 * rnd() * Math.exp(-t / 0.05) + 0.4 * Math.sin(phase) * Math.exp(-t / 0.04)) * vol;
  }
}

function addHat(out: Float32Array, i0: number, sr: number, vol: number, rnd: () => number) {
  const len = Math.floor(0.07 * sr);
  let prev = 0;
  for (let k = 0; k < len && i0 + k < out.length; k++) {
    const n = rnd();
    const hp = n - prev;                  // trece-sus: zgomot „strident”
    prev = n;
    out[i0 + k] += hp * vol * 0.5 * Math.exp((-k / sr) / 0.018);
  }
}

/** Adună tiparul de tobe în `out` (mono), începând la `startSec`, pe `totalSec` secunde. */
export function renderDrums(
  out: Float32Array, sr: number, id: DrumId, bpm: number, startSec: number, totalSec: number, gain = 0.6,
): void {
  const pat = drumPattern(id);
  const beat = 60 / bpm;
  const step = beat / 4;
  const bar = beat * 4;
  const endSec = startSec + totalSec;
  const rnd = lcg(20261101);
  if (pat.golden) {
    goldenHitTimes(bpm, startSec, endSec).forEach((t, k) => {
      const i0 = Math.floor(t * sr);
      if (k % 2 === 0) addKick(out, i0, sr, gain);
      else addSnare(out, i0, sr, 0.9 * gain, rnd);
    });
    return;
  }
  for (let b = 0; startSec + b * bar < endSec; b++) {
    for (const h of pat.hits) {
      const t = startSec + b * bar + h.step * step;
      if (t >= endSec) continue;
      const i0 = Math.floor(t * sr);
      const v = h.vol * gain;
      if (h.piece === 'k') addKick(out, i0, sr, v);
      else if (h.piece === 's') addSnare(out, i0, sr, v, rnd);
      else addHat(out, i0, sr, v, rnd);
    }
  }
}
