// Încărcarea unui fișier audio pentru Nivelul 2 (audio → imagine): alegere din telefon și decodare
// în mono float32. Întâi decodorul nativ (WAV, MP3…); dacă nu reușește și fișierul e WAV, se citește în JS.

import * as DocumentPicker from 'expo-document-picker';
import { decodeWav } from '../core/audioMelody';
import type { AudioEngine } from '../audio/AudioEngine';

export interface PickedAudio { uri: string; name: string }
export interface AudioPcm { data: Float32Array; sampleRate: number; name: string }

export async function pickAudio(): Promise<PickedAudio | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name ?? 'audio' };
}

export async function decodeAudio(engine: AudioEngine, uri: string, name: string): Promise<AudioPcm> {
  try {
    const { data, sampleRate } = await engine.decodeFile(uri);
    return { data, sampleRate, name };
  } catch (native: any) {
    // rezervă: WAV citit direct (PCM 8–32 biți / float)
    try {
      const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
      const { data, sampleRate } = decodeWav(bytes);
      return { data, sampleRate, name };
    } catch {
      throw new Error(native?.message ?? 'Fișierul audio nu a putut fi citit. Încearcă un WAV sau un MP3.');
    }
  }
}
