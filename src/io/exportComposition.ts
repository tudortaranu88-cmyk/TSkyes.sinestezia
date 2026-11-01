// Exportul compoziției curente: imaginea spiralei (PNG / JPEG / TIFF) și melodia (MP3 / WAV / AAC).

import { exportSpiralImage, type ImageKind } from '../render/exportImage';
import { renderMix, type RenderNote, type SampleSet } from '../core/audioRender';
import { encodeWav, toBase64 } from '../core/encoders';
import { encodeMp3 } from '../audio/mp3';
import { encodeWavToM4a } from 'aac-encoder';
import { cachePath, stampName, writeBase64 } from './files';
import { DEFAULT_INSTRUMENT } from '../core/instruments';
import type { NoteEvent } from '../core/types';

export type AudioKind = 'mp3' | 'wav' | 'aac';
export const SR = 44100;

export async function exportImageFile(events: NoteEvent[], kind: ImageKind): Promise<{ uri: string; ext: string }> {
  const b64 = exportSpiralImage(events, kind);
  const uri = await writeBase64(stampName(kind), b64);
  return { uri, ext: kind };
}

export function eventsToNotes(events: NoteEvent[], nowMs = Date.now()): RenderNote[] {
  if (!events.length) return [];
  const t0 = events[0].startMs;
  return events.map(e => ({
    startSec: (e.startMs - t0) / 1000 + 0.1,
    durSec: Math.max(0.05, (e.durationMs ?? nowMs - e.startMs) / 1000),
    freq: e.freq,
    instrument: e.instrument ?? DEFAULT_INSTRUMENT,
  }));
}

/** Codează un mix randat în formatul cerut și îl scrie în cache. */
export async function exportMixFile(
  mix: Float32Array, kind: AudioKind, onProgress?: (p: number) => void,
): Promise<{ uri: string; ext: string }> {
  if (kind === 'mp3') {
    return { uri: await writeBase64(stampName('mp3'), toBase64(await encodeMp3(mix, SR, 128, onProgress))), ext: 'mp3' };
  }
  const wavB64 = toBase64(encodeWav(mix, SR));
  if (kind === 'wav') return { uri: await writeBase64(stampName('wav'), wavB64), ext: 'wav' };
  const tmp = await writeBase64('_tmp_export.wav', wavB64);
  const out = cachePath(stampName('m4a'));
  await encodeWavToM4a(tmp, out, 128000);
  return { uri: out, ext: 'm4a' };
}

export async function exportAudioFile(
  events: NoteEvent[], kind: AudioKind, samples?: Record<string, SampleSet>, onProgress?: (p: number) => void,
): Promise<{ uri: string; ext: string }> {
  return exportMixFile(renderMix(eventsToNotes(events), { sampleRate: SR, samples }), kind, onProgress);
}
