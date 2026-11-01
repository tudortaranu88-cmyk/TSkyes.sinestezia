// Autotest pentru build-ul de verificare (pornit doar prin linkul musiccolor://selftest):
// generează o compoziție scurtă și exportă toate cele 6 formate, raportând în logcat.

import * as FileSystem from 'expo-file-system/legacy';
import { exportImageFile, exportAudioFile } from './exportComposition';
import { cellColor, cellPitch, freqToMidi, NOTES } from '../core/golden';
import { INSTRUMENTS } from '../core/instruments';
import type { SampleSet } from '../core/audioRender';
import type { NoteEvent } from '../core/types';

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
