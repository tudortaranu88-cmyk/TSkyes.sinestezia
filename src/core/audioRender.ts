// Randarea offline a compoziției (pentru export MP3 / WAV / AAC).
// Reproduce motorul live: sample-uri (dacă există) sau timbrurile sintetizate, aceleași anvelope,
// gain master 0,7, apoi normalizare dacă vârful depășește 0,98.

import { instrumentById } from './instruments';
import { renderDrums, type DrumId } from './drums';

export interface RenderNote { startSec: number; durSec: number; freq: number; instrument: string }

export interface SampleSet {
  list: { freq: number; data: Float32Array; sampleRate: number }[];
  loop?: boolean; loopStart?: number; loopEnd?: number;
  attack?: number; release?: number; gain?: number;
}

export interface RenderOptions {
  sampleRate?: number;
  samples?: Record<string, SampleSet>;
  tailSec?: number;
  drums?: { pattern: DrumId; bpm: number };   // ritm de tobe, aliniat la melodie
}

const SYNTH_RELEASE = 0.15;

function polyBlep(t: number, dt: number): number {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

function renderSynth(out: Float32Array, sr: number, n: RenderNote) {
  const s = instrumentById(n.instrument).synth;
  const f = n.freq * s.mult;
  const dt = f / sr;
  const i0 = Math.floor(n.startSec * sr);
  const relStart = n.durSec;
  const total = Math.ceil((relStart + SYNTH_RELEASE + 0.02) * sr);
  const sustain = Math.max(s.sustain, 0.0001);
  let phase = 0;
  let relFrom = -1;
  for (let k = 0; k < total && i0 + k < out.length; k++) {
    const t = k / sr;
    let env: number;
    if (t < s.attack) env = (s.peak * t) / s.attack;
    else env = sustain + (s.peak - sustain) * Math.exp(-(t - s.attack) / s.decay);
    if (t >= relStart) {
      if (relFrom < 0) relFrom = env;
      env = relFrom * Math.max(0, 1 - (t - relStart) / SYNTH_RELEASE);
    }
    let x: number;
    switch (s.wave) {
      case 'sine': x = Math.sin(2 * Math.PI * phase); break;
      case 'triangle': x = 1 - 4 * Math.abs(phase - 0.5); break;
      case 'sawtooth': x = 2 * phase - 1 - polyBlep(phase, dt); break;
      default: { // square
        x = phase < 0.5 ? 1 : -1;
        x += polyBlep(phase, dt);
        x -= polyBlep((phase + 0.5) % 1, dt);
      }
    }
    out[i0 + k] += x * env;
    phase += dt;
    if (phase >= 1) phase -= 1;
  }
}

function renderSample(out: Float32Array, sr: number, n: RenderNote, set: SampleSet) {
  let best = set.list[0];
  for (const s of set.list) if (Math.abs(Math.log(n.freq / s.freq)) < Math.abs(Math.log(n.freq / best.freq))) best = s;
  const data = best.data;
  const dur = data.length / best.sampleRate;
  const step = (n.freq / best.freq) * (best.sampleRate / sr);
  const peak = set.gain ?? 0.8;
  const attack = set.attack ?? 0.01;
  const release = set.release ?? 0.15;
  const loop = !!set.loop;
  const ls = Math.min(set.loopStart ?? 0.3, dur * 0.5) * best.sampleRate;
  const le = Math.min(dur, set.loopEnd ?? dur - 0.05) * best.sampleRate;
  const i0 = Math.floor(n.startSec * sr);
  const total = Math.ceil((n.durSec + release + 0.02) * sr);
  let pos = 0;
  for (let k = 0; k < total && i0 + k < out.length; k++) {
    if (loop && le > ls) { while (pos >= le) pos -= le - ls; }
    else if (pos >= data.length - 1) break;
    const t = k / sr;
    let env = t < attack ? (peak * t) / attack : peak;
    if (t >= n.durSec) env *= Math.max(0, 1 - (t - n.durSec) / release);
    const j = Math.floor(pos), fr = pos - j;
    const a = data[j] ?? 0, b = data[j + 1] ?? a;
    out[i0 + k] += (a + (b - a) * fr) * env;
    pos += step;
  }
}

export function renderMix(notes: RenderNote[], opts: RenderOptions = {}): Float32Array {
  const sr = opts.sampleRate ?? 44100;
  const tail = opts.tailSec ?? 1.2;
  const end = notes.reduce((m, n) => Math.max(m, n.startSec + n.durSec), 0) + tail;
  const out = new Float32Array(Math.max(1, Math.ceil(end * sr)));
  for (const n of notes) {
    const set = opts.samples?.[n.instrument];
    if (set && set.list.length) renderSample(out, sr, n, set);
    else renderSynth(out, sr, n);
  }
  if (opts.drums && notes.length) {
    const t0 = notes.reduce((m, n) => Math.min(m, n.startSec), Infinity);
    const t1 = notes.reduce((m, n) => Math.max(m, n.startSec + n.durSec), 0);
    renderDrums(out, sr, opts.drums.pattern, opts.drums.bpm, t0, t1 - t0);
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) { out[i] *= 0.7; const a = Math.abs(out[i]); if (a > peak) peak = a; }
  if (peak > 0.98) { const g = 0.98 / peak; for (let i = 0; i < out.length; i++) out[i] *= g; }
  return out;
}
