// NIVEL 2 – din fișier audio în imagine.
//
// Sunetul (mono) se analizează pe ferestre scurte: pentru fiecare fereastră se caută înălțimea
// dominantă (metoda YIN – autocorelație normalizată). Ferestrele consecutive cu aceeași notă se unesc
// într-o singură notă cu durată. Fiecare notă se așază apoi pe claviatura aplicației:
//   coloana = numele notei (Do…Si), rândul = registrul (octave mai sus → rânduri pozitive, mai deschise;
//   mai jos → rânduri negative, mai închise; diezii = un rând peste nota naturală de dedesubt).
// Funcționează cel mai bine pe o singură voce / un singur instrument; la muzică densă alege nota dominantă.

import { cellColor, freqToMidi, midiToFreq, noteLabel, ROW_MAX, ROW_MIN, type PaletteId } from './golden';
import type { NoteEvent } from './types';

export interface DetectedNote { startSec: number; durSec: number; midi: number; freq: number }

export interface DetectOptions {
  maxSeconds?: number;   // cât din fișier se analizează (implicit 300 s)
  maxFrames?: number;    // plafonul de ferestre analizate (implicit 2400) – ține calculul scurt pe telefon
  minHz?: number;
  maxHz?: number;
}

const ANALYSIS_SR = 11025;
const WIN = 512;           // fereastra de integrare (≈ 46 ms la 11 kHz)
const YIN_THRESHOLD = 0.18;

/** WAV (PCM 8/16/24/32 biți sau float 32) → mono float32. Aruncă eroare dacă nu e WAV PCM. */
export function decodeWav(bytes: Uint8Array): { data: Float32Array; sampleRate: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Fișierul nu este WAV');
  let pos = 12, fmt = 1, channels = 1, sampleRate = 44100, bits = 16, dataOff = -1, dataLen = 0;
  while (pos + 8 <= bytes.length) {
    const id = tag(pos), size = v.getUint32(pos + 4, true);
    if (id === 'fmt ') {
      fmt = v.getUint16(pos + 8, true); channels = v.getUint16(pos + 10, true);
      sampleRate = v.getUint32(pos + 12, true); bits = v.getUint16(pos + 22, true);
      if (fmt === 0xfffe && size >= 26) fmt = v.getUint16(pos + 32, true); // WAVE_FORMAT_EXTENSIBLE
    } else if (id === 'data') {
      dataOff = pos + 8; dataLen = Math.min(size, bytes.length - dataOff); break;
    }
    pos += 8 + size + (size & 1);
  }
  if (dataOff < 0) throw new Error('Fișierul WAV nu conține date audio');
  if (fmt !== 1 && fmt !== 3) throw new Error('Format WAV nesuportat (doar PCM)');
  const bps = bits / 8;
  const frames = Math.floor(dataLen / (bps * channels));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const o = dataOff + (i * channels + c) * bps;
      if (fmt === 3) sum += bps === 8 ? v.getFloat64(o, true) : v.getFloat32(o, true);
      else if (bps === 1) sum += (bytes[o] - 128) / 128;
      else if (bps === 2) sum += v.getInt16(o, true) / 32768;
      else if (bps === 3) sum += ((bytes[o] | (bytes[o + 1] << 8) | (v.getInt8(o + 2) << 16))) / 8388608;
      else sum += v.getInt32(o, true) / 2147483648;
    }
    out[i] = sum / channels;
  }
  return { data: out, sampleRate };
}

/** Reeșantionare simplă (medie pe blocuri) la ~11 kHz: destul pentru înălțimi până la ~1 kHz. */
export function downsample(pcm: Float32Array, sr: number, maxSeconds = 300): { data: Float32Array; sampleRate: number } {
  const step = Math.max(1, Math.round(sr / ANALYSIS_SR));
  const n = Math.floor(Math.min(pcm.length, Math.floor(maxSeconds * sr)) / step);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const o = i * step;
    for (let k = 0; k < step; k++) s += pcm[o + k];
    out[i] = s / step;
  }
  return { data: out, sampleRate: sr / step };
}

/** Înălțimea (Hz) a unei ferestre care începe la `off`, sau 0 dacă nu e sunet cu înălțime clară. */
function yinPitch(x: Float32Array, off: number, sr: number, minLag: number, maxLag: number, d: Float32Array): number {
  let run = 0, best = -1;
  d[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < WIN; i++) { const t = x[off + i] - x[off + i + lag]; s += t * t; }
    run += s;
    d[lag] = run > 0 ? (s * lag) / run : 1;
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (d[lag] < YIN_THRESHOLD) {
      while (lag + 1 <= maxLag && d[lag + 1] < d[lag]) lag++;
      best = lag; break;
    }
  }
  if (best < 0) return 0;
  // interpolare parabolică în jurul minimului
  const a = d[best - 1] ?? d[best], b = d[best], c = d[best + 1] ?? d[best];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
  return sr / (best + Math.max(-0.5, Math.min(0.5, shift)));
}

/** Analizează sunetul și întoarce notele găsite, în ordine cronologică. */
export function detectNotes(pcm: Float32Array, sampleRate: number, opts: DetectOptions = {}): DetectedNote[] {
  const { data: x, sampleRate: sr } = downsample(pcm, sampleRate, opts.maxSeconds ?? 300);
  const minLag = Math.max(2, Math.floor(sr / (opts.maxHz ?? 1050)));
  const maxLag = Math.ceil(sr / (opts.minHz ?? 62));
  const span = WIN + maxLag + 1;
  if (x.length < span) return [];

  const maxFrames = opts.maxFrames ?? 2400;
  const hop = Math.max(256, Math.ceil((x.length - span) / maxFrames));
  const nFrames = Math.floor((x.length - span) / hop) + 1;

  // nivelul fiecărei ferestre → pragul de liniște (relativ la cel mai tare pasaj)
  const rms = new Float32Array(nFrames);
  let top = 0;
  for (let f = 0; f < nFrames; f++) {
    let s = 0;
    const o = f * hop;
    for (let i = 0; i < WIN; i++) s += x[o + i] * x[o + i];
    rms[f] = Math.sqrt(s / WIN);
    if (rms[f] > top) top = rms[f];
  }
  const gate = Math.max(0.004, top * 0.06);

  const d = new Float32Array(maxLag + 2);
  const midi = new Int16Array(nFrames).fill(-1);
  for (let f = 0; f < nFrames; f++) {
    if (rms[f] < gate) continue;
    const hz = yinPitch(x, f * hop, sr, minLag, maxLag, d);
    if (hz > 0) midi[f] = Math.round(freqToMidi(hz));
  }
  // netezire: o fereastră izolată, diferită de vecinii ei identici, ia valoarea lor
  for (let f = 1; f + 1 < nFrames; f++) {
    if (midi[f - 1] === midi[f + 1] && midi[f] !== midi[f - 1] && midi[f - 1] >= 0) midi[f] = midi[f - 1];
  }

  const hopSec = hop / sr;
  const minFrames = Math.max(1, Math.ceil(0.065 / hopSec));   // ignoră „notele” mai scurte de ~65 ms (tranziții)
  const out: DetectedNote[] = [];
  let start = 0;
  for (let f = 1; f <= nFrames; f++) {
    if (f < nFrames && midi[f] === midi[start]) continue;
    const m = midi[start];
    if (m >= 0 && f - start >= minFrames) {
      out.push({ startSec: start * hopSec, durSec: (f - start) * hopSec, midi: m, freq: midiToFreq(m) });
    }
    start = f;
  }
  return out;
}

const NATURAL_COL: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

/** Nota MIDI → celula de pe claviatură (coloană = numele notei, rând = registru; diez = +1 rând). */
export function midiToCell(midi: number): { col: number; row: number } {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 5;          // Do3 al aplicației (MIDI 60) = octava 0
  const sharp = NATURAL_COL[pc] === undefined;
  const col = NATURAL_COL[sharp ? pc - 1 : pc];
  const row = Math.max(ROW_MIN, Math.min(ROW_MAX, octave * 3 + (sharp ? 1 : 0)));
  return { col, row };
}

/** Notele detectate → evenimente (aceeași formă ca notele cântate la Nivelul 1), colorate cu paleta aleasă. */
export function notesToEvents(notes: DetectedNote[], palette: PaletteId = 'aurie', instrument = 'pian', t0Ms = 0): NoteEvent[] {
  return notes.map((n, i) => {
    const { col, row } = midiToCell(n.midi);
    return {
      id: i + 1, col, row, label: noteLabel(col, row),
      freq: n.freq, midiFloat: n.midi, color: cellColor(col, row, palette),
      startMs: t0Ms + Math.round(n.startSec * 1000), durationMs: Math.max(30, Math.round(n.durSec * 1000)), instrument,
    };
  });
}

/** Recolorează evenimentele cu altă paletă (când utilizatorul schimbă paleta după analiză). */
export function recolor(events: NoteEvent[], palette: PaletteId): NoteEvent[] {
  return events.map(e => ({ ...e, color: cellColor(e.col, e.row, palette) }));
}
