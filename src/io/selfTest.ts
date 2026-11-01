// Autotest pentru build-ul de verificare (pornit doar prin linkul musiccolor://selftest):
// generează o compoziție scurtă și exportă toate cele 6 formate, raportând în logcat.
// musiccolor://selftest2 face același lucru pentru Nivelul 2 (imagine → melodie → partitură).

import * as FileSystem from 'expo-file-system/legacy';
import { exportImageFile, exportAudioFile } from './exportComposition';
import { cellColor, cellPitch, freqToMidi, NOTES } from '../core/golden';
import { INSTRUMENTS } from '../core/instruments';
import type { SampleSet } from '../core/audioRender';
import type { NoteEvent } from '../core/types';
import { readingCells, sampleColors, buildMelody, melodyToEvents } from '../core/imageMelody';
import { layoutScore } from '../core/scoreLayout';
import { renderScorePage } from '../render/scoreImage';
import { stampName, writeBase64, saveToDevice } from './files';
import type { ImageSource } from './imageSource';

export function demoComposition(n = 14): NoteEvent[] {
  const t0 = Date.now() - n * 400;
  const out: NoteEvent[] = [];
  for (let i = 0; i < n; i++) {
    const col = (i * 3) % 8, row = ((i * 5) % 7) - 3;
    const { freq } = cellPitch(col, row, 'tempered');
    out.push({
      id: i + 1, col, row, label: NOTES[col], freq, midiFloat: freqToMidi(freq), color: cellColor(col, row),
      startMs: t0 + i * 400, durationMs: 300, instrument: INSTRUMENTS[i % INSTRUMENTS.length].id,
    });
  }
  return out;
}

export async function runSelfTest(events: NoteEvent[], samples: Record<string, SampleSet>): Promise<void> {
  const report = async (label: string, f: () => Promise<{ uri: string }>) => {
    const t = Date.now();
    try {
      const { uri } = await f();
      const info = await FileSystem.getInfoAsync(uri);
      console.log(`SELFTEST ${label} ok ${info.exists ? (info as any).size : 0} bytes ${Date.now() - t} ms`);
    } catch (e: any) {
      console.log(`SELFTEST ${label} FAIL ${e?.message ?? e}`);
    }
  };
  for (const k of ['png', 'jpeg', 'tiff'] as const) await report(k, () => exportImageFile(events, k));
  for (const k of ['mp3', 'wav', 'aac'] as const) await report(k, () => exportAudioFile(events, k, samples));
  console.log('SELFTEST done');
}

// ---------- Nivelul 2 (musiccolor://selftest2) ----------

export async function runSelfTest2(src: ImageSource, instrument: string, samples: Record<string, SampleSet>): Promise<void> {
  const log = (s: string) => console.log(`SELFTEST2 ${s}`);
  try {
    const cells = readingCells(src.width, src.height, 256, 'spirala');
    const melody = buildMelody(sampleColors(src.rgba, src.width, src.height, cells));
    log(`melodie ${cells.length} celule ${melody.length} note`);
    const pages = layoutScore(melody, { title: 'Music&Color', subtitle: 'Autotest', instrument, bpm: 96 });
    for (const kind of ['png', 'jpeg'] as const) {
      const t = Date.now();
      const b64 = renderScorePage(pages[0], kind);
      const uri = await writeBase64(stampName(kind, '_partitura_test'), b64);
      log(`partitura ${kind} ok ${Math.round((b64.length * 3) / 4)} bytes ${Date.now() - t} ms (${pages.length} pagini)`);
      if (kind === 'png') { await saveToDevice(uri); log('partitura salvata in galerie'); }
    }
    for (const kind of ['wav', 'aac', 'mp3'] as const) {
      const t = Date.now();
      const f = await exportAudioFile(melodyToEvents(melody, 96, instrument), kind, samples);
      const info = await FileSystem.getInfoAsync(f.uri);
      log(`${kind} ok ${info.exists ? (info as any).size : 0} bytes ${Date.now() - t} ms`);
    }
  } catch (e: any) {
    log(`FAIL ${e?.message ?? e}`);
  }
  log('done');
}

// ---------- Sondă audio (musiccolor://audioprobe) ----------
// Nu poate auzi, dar confirmă că există semnal în lanțul de ieșire: un ton live și un fragment PCM.
const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function runAudioProbe(eng: { ensureRunning(): Promise<string>; sampleRate: number; noteOn(i: string, f: number): number; noteOff(id: number): void; playPCM(d: Float32Array, sr: number): () => void; peak(): number } | null): Promise<void> {
  const log = (s: string) => console.log(`AUDIOPROBE ${s}`);
  if (!eng) { log('FAIL nu există motor audio'); log('done'); return; }
  try {
    log(`state=${await eng.ensureRunning()} sr=${eng.sampleRate}`);
    const v = eng.noteOn('pian', 440);
    await sleepMs(500);
    log(`live peak=${eng.peak().toFixed(4)}`);
    eng.noteOff(v);
    await sleepMs(300);
    const sr = eng.sampleRate;
    const tone = new Float32Array(sr).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));
    eng.playPCM(tone, sr);
    await sleepMs(500);
    log(`pcm peak=${eng.peak().toFixed(4)}`);
  } catch (e: any) {
    log(`FAIL ${e?.message ?? e}`);
  }
  log('done');
}
