// Encoder MP3 (lamejs, JS pur) – mono, 128 kbps. Verificat pe Android prin autotestul de pe emulator.
import * as lame from '@breezystack/lamejs';

// biblioteca e publicată ca ESM + CJS; în funcție de bundler, clasa poate sta direct sau sub `default`
const L: any = lame;
const Mp3Encoder: any = L.Mp3Encoder ?? L.default?.Mp3Encoder ?? L.default?.default?.Mp3Encoder;
import { floatToInt16 } from '../core/encoders';

export function encodeMp3(samples: Float32Array, sampleRate: number, kbps = 128): Uint8Array {
  if (typeof Mp3Encoder !== 'function') {
    throw new Error(`Encoderul MP3 nu este disponibil (exporturi: ${Object.keys(L).join(',')}; default: ${typeof L.default} ${L.default ? Object.keys(L.default).join(',') : ''})`);
  }
  const enc = new Mp3Encoder(1, sampleRate, kbps);
  const pcm = floatToInt16(samples);
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152 * 8;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (out.length) chunks.push(new Uint8Array(out.buffer, out.byteOffset, out.length));
  }
  const last = enc.flush();
  if (last.length) chunks.push(new Uint8Array(last.buffer, last.byteOffset, last.length));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const res = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { res.set(c, o); o += c.length; }
  return res;
}
