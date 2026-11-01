// Mixul Nivelului 2: melodia (din imagine) + ritmul ales. Aceeași funcție alimentează
// redarea („Ascultă”) și exportul audio, ca să sune identic.

import { renderMix, type SampleSet } from './audioRender';
import { melodyToNotes, type MelodyNote } from './imageMelody';
import type { DrumId } from './drums';

export function renderLevel2Mix(
  melody: MelodyNote[], bpm: number, instrument: string, drum: DrumId | null, sampleRate: number,
  samples?: Record<string, SampleSet>,
): Float32Array {
  return renderMix(melodyToNotes(melody, bpm, instrument), {
    sampleRate, samples, drums: drum ? { pattern: drum, bpm } : undefined,
  });
}
