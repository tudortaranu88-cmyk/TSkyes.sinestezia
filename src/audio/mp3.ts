// Encoder MP3 (lamejs, JS pur) – mono, 128 kbps.
import { Mp3Encoder } from '@breezystack/lamejs';
import { floatToInt16 } from '../core/encoders';

export function encodeMp3(samples: Float32Array, sampleRate: number, kbps = 128): Uint8Array {
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
