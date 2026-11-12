// Motor audio – react-native-audio-api (implementare nativă a Web Audio API, Android + iOS).
// Logica este portată din DAW: sample-ul cel mai apropiat + transpunere prin playbackRate,
// buclă pentru note susținute, anvelopă atac/release. Fără sample-uri → sinteză de rezervă.
//
// Semnătura decodeAudioData diferă între versiunile bibliotecii (cale / ArrayBuffer).
// `decodeAsset` folosește decodeAudioDataSource(cale) dacă există, altfel citește fișierul ca ArrayBuffer.

import { AudioContext } from 'react-native-audio-api';
import { Asset } from 'expo-asset';
import { BASE_FREQS } from '../core/golden';
import { instrumentById } from '../core/instruments';
import type { SampleSet } from '../core/audioRender';

export interface InstrumentCfg {
  samples: Partial<Record<number, number>>; // coloană (0..7) → require('...wav')
  tuned?: { midi: number; mod: number }[];  // sample pe pitch real măsurat (MIDI, A4=69=440 Hz) → require('...wav')
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  attack?: number;
  release?: number;
  gain?: number;
}

type Loaded = { col: number; freq: number; buf: any }[];

export class AudioEngine {
  private ctx = new AudioContext();
  private master: any;
  private bank: Record<string, { cfg: InstrumentCfg; list: Loaded }> = {};
  private voices = new Map<number, { src: any; gain: any; release: number }>();
  private nextId = 1;
  private analyser: any = null;

  constructor() {
    // limitator pe ieșirea master (ca în DAW v4)
    const lim = (this.ctx as any).createDynamicsCompressor?.(); // nu există în toate versiunile
    if (lim) {
      lim.threshold.value = -10; lim.knee.value = 4; lim.ratio.value = 20;
      lim.attack.value = 0.002; lim.release.value = 0.2;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(lim); lim.connect(this.ctx.destination);
    } else {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    }
    // analizor pe ieșirea master: permite verificarea că există semnal (diagnostic)
    try {
      this.analyser = (this.ctx as any).createAnalyser?.() ?? null;
      if (this.analyser) { this.analyser.fftSize = 2048; this.master.connect(this.analyser); }
    } catch { this.analyser = null; }
  }

  private async decodeAsset(module: number): Promise<any> {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const ctx = this.ctx as any;
    if (typeof ctx.decodeAudioDataSource === 'function') {
      return ctx.decodeAudioDataSource(uri.replace(/^file:\/\//, ''));
    }
    const data = await (await fetch(uri)).arrayBuffer();
    return this.ctx.decodeAudioData(data);
  }

  private requested = new Set<string>();

  /** Încarcă o singură dată fiecare instrument din manifest (App se poate remonta în același proces). */
  loadManifest(manifest: Record<string, InstrumentCfg>): void {
    for (const [name, cfg] of Object.entries(manifest)) {
      if (this.requested.has(name)) continue;
      this.requested.add(name);
      this.loadInstrument(name, cfg);
    }
  }

  async loadInstrument(name: string, cfg: InstrumentCfg): Promise<number> {
    const list: Loaded = [];
    for (const [colStr, mod] of Object.entries(cfg.samples)) {
      if (mod === undefined) continue;
      const col = Number(colStr);
      try {
        list.push({ col, freq: BASE_FREQS[col], buf: await this.decodeAsset(mod) });
      } catch (e) {
        console.warn(`Sample ${name}/${col} neîncărcat`, e);
      }
    }
    // Sample-uri tag-uite pe pitch real (MIDI) – registru liber, nu doar cele 8 coloane.
    // noteOn alege automat sample-ul cel mai apropiat și îl transpune prin playbackRate.
    for (const t of cfg.tuned ?? []) {
      try {
        const freq = 440 * Math.pow(2, (t.midi - 69) / 12);
        list.push({ col: -1, freq, buf: await this.decodeAsset(t.mod) });
      } catch (e) {
        console.warn(`Sample ${name}/midi${t.midi} neîncărcat`, e);
      }
    }
    this.bank[name] = { cfg, list };
    return list.length;
  }

  /**
   * Decodează un fișier audio ales de utilizator (WAV, MP3 și ce mai știe decodorul nativ) în mono float32.
   * Semnătura decodorului diferă între versiunile bibliotecii, așa că se încearcă pe rând variantele.
   */
  async decodeFile(uri: string): Promise<{ data: Float32Array; sampleRate: number }> {
    const ctx = this.ctx as any;
    let path = uri.replace(/^file:\/\//, '');
    try { path = decodeURIComponent(path); } catch { /* rămâne calea brută */ }
    const tries: (() => Promise<any>)[] = [
      async () => (typeof ctx.decodeAudioDataSource === 'function' ? ctx.decodeAudioDataSource(path) : null),
      async () => (typeof ctx.decodeAudioData === 'function' ? ctx.decodeAudioData(path) : null),
      async () => ctx.decodeAudioData(await (await fetch(uri)).arrayBuffer()),
    ];
    let buf: any = null;
    let last: any = null;
    for (const t of tries) {
      try { buf = await t(); } catch (e) { last = e; buf = null; }
      if (buf && buf.length > 0) break;
      buf = null;
    }
    if (!buf) throw new Error(`Fișierul audio nu a putut fi decodat${last?.message ? ` (${last.message})` : ''}`);
    const n = buf.length as number;
    const ch = (buf.numberOfChannels as number) || 1;
    const data = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c) as Float32Array;
      for (let i = 0; i < n; i++) data[i] += d[i] / ch;
    }
    return { data, sampleRate: buf.sampleRate as number };
  }

  get sampleRate(): number { return (this.ctx as any).sampleRate ?? 44100; }

  /** Pornește contextul audio dacă e suspendat. Întoarce starea lui. */
  async ensureRunning(): Promise<string> {
    const c = this.ctx as any;
    try {
      if (c.state === 'suspended' && typeof c.resume === 'function') await c.resume();
    } catch (e) { console.warn('AudioContext.resume', e); }
    return String(c.state ?? 'necunoscut');
  }

  /** Redă un fragment mono (float32) prin ieșirea master. Întoarce funcția de oprire. */
  playPCM(data: Float32Array, sr: number): () => void {
    const c = this.ctx as any;
    const buf = c.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start(0);
    this.ensureRunning();
    return () => { try { src.stop(); } catch { /* deja oprit */ } };
  }

  /** Nivelul maxim recent la ieșirea master (0..1); -1 dacă biblioteca nu oferă analizor. */
  peak(): number {
    if (!this.analyser) return -1;
    const arr = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(arr);
    let m = 0;
    for (let i = 0; i < arr.length; i++) { const a = Math.abs(arr[i]); if (a > m) m = a; }
    return m;
  }

  /** Sample-urile decodate, pentru randarea offline (export audio). */
  getSampleSets(): Record<string, SampleSet> {
    const out: Record<string, SampleSet> = {};
    for (const [name, { cfg, list }] of Object.entries(this.bank)) {
      if (!list.length) continue;
      out[name] = {
        list: list.map(s => ({ freq: s.freq, data: s.buf.getChannelData(0) as Float32Array, sampleRate: s.buf.sampleRate as number })),
        loop: cfg.loop, loopStart: cfg.loopStart, loopEnd: cfg.loopEnd,
        attack: cfg.attack, release: cfg.release, gain: cfg.gain,
      };
    }
    return out;
  }

  /** Pornește o notă susținută; întoarce un id folosit la noteOff. */
  noteOn(instr: string, freq: number): number {
    const id = this.nextId++;
    const t = this.ctx.currentTime;
    const entry = this.bank[instr];
    const gain = this.ctx.createGain();
    gain.connect(this.master);

    let src: any;
    let release = 0.15;
    if (entry && entry.list.length) {
      const { cfg, list } = entry;
      let best = list[0];
      for (const s of list) if (Math.abs(Math.log(freq / s.freq)) < Math.abs(Math.log(freq / best.freq))) best = s;
      src = this.ctx.createBufferSource();
      src.buffer = best.buf;
      src.playbackRate.value = freq / best.freq;
      if (cfg.loop) {
        const d = best.buf.duration;
        // Bucla pornește de la 0 (toată înregistrarea). react-native-audio-api 0.8.4 are un defect:
        // cu loopStart > 0 și playbackRate ≠ 1, redarea începe înaintea buclei, poziția de citire
        // devine negativă și firul audio cade cu SIGSEGV (processWithInterpolation).
        // cfg.loopStart rămâne folosit doar la randarea offline (audioRender.ts).
        src.loop = true;
        src.loopStart = 0;
        src.loopEnd = Math.min(d, cfg.loopEnd ?? d - 0.05);
      }
      const peak = cfg.gain ?? 0.8;
      release = cfg.release ?? 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + (cfg.attack ?? 0.01));
    } else {
      // sinteză de rezervă până sosesc sample-urile – timbru propriu fiecărui instrument
      const s = instrumentById(instr).synth;
      src = this.ctx.createOscillator();
      src.type = s.wave;
      src.frequency.value = freq * s.mult;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(s.peak, t + s.attack);
      gain.gain.setTargetAtTime(Math.max(s.sustain, 0.0001), t + s.attack, s.decay);
    }
    src.connect(gain);
    src.start(t);
    this.voices.set(id, { src, gain, release });
    return id;
  }

  noteOff(id: number): void {
    const v = this.voices.get(id);
    if (!v) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + v.release);
    v.src.stop(t + v.release + 0.02);
    this.voices.delete(id);
  }
}

// O singură instanță pe proces. Dacă App se remontează (ex. un deep-link care recreează activitatea),
// un al doilea `new AudioContext()` ar lăsa primul fără referință; GC-ul Hermes îl distruge apoi pe
// firul „hades”, care nu are JNI, iar react-native-audio-api oprește aplicația cu SIGABRT
// („Unable to retrieve jni environment”). Referința de aici ține contextul în viață cât trăiește procesul.
let shared: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!shared) shared = new AudioEngine();
  return shared;
}
