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

export interface InstrumentCfg {
  samples: Partial<Record<number, number>>; // coloană (0..7) → require('...wav')
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
    this.bank[name] = { cfg, list };
    return list.length;
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
        src.loop = true;
        src.loopStart = Math.min(cfg.loopStart ?? 0.3, d * 0.5);
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
