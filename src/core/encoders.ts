// Encodere în JS pur (fără dependențe): WAV (PCM 16 biți), TIFF (RGB necomprimat), Base64.

/** Float32 [-1, 1] mono → fișier WAV PCM 16 biți. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataLen, true);
  const pcm = floatToInt16(samples);
  new Int16Array(buf, 44, samples.length).set(pcm);
  return new Uint8Array(buf);
}

export function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return out;
}

/** RGBA (8 biți/canal) → TIFF baseline, RGB necomprimat, o singură bandă. */
export function encodeTiff(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const pixelBytes = width * height * 3;
  const nTags = 11;
  const ifdOff = 8;
  const ifdLen = 2 + nTags * 12 + 4;
  const bpsOff = ifdOff + ifdLen;         // 3 × SHORT (8,8,8)
  const xresOff = bpsOff + 6;             // RATIONAL
  const yresOff = xresOff + 8;            // RATIONAL
  const dataOff = yresOff + 8;
  const buf = new ArrayBuffer(dataOff + pixelBytes);
  const v = new DataView(buf);
  v.setUint8(0, 0x49); v.setUint8(1, 0x49); v.setUint16(2, 42, true); v.setUint32(4, ifdOff, true);
  v.setUint16(ifdOff, nTags, true);
  let p = ifdOff + 2;
  const tag = (id: number, type: number, count: number, value: number) => {
    v.setUint16(p, id, true); v.setUint16(p + 2, type, true); v.setUint32(p + 4, count, true);
    if (type === 3 && count === 1) v.setUint16(p + 8, value, true); else v.setUint32(p + 8, value, true);
    p += 12;
  };
  tag(256, 4, 1, width);                  // ImageWidth
  tag(257, 4, 1, height);                 // ImageLength
  tag(258, 3, 3, bpsOff);                 // BitsPerSample
  tag(259, 3, 1, 1);                      // Compression = none
  tag(262, 3, 1, 2);                      // Photometric = RGB
  tag(273, 4, 1, dataOff);                // StripOffsets
  tag(277, 3, 1, 3);                      // SamplesPerPixel
  tag(278, 4, 1, height);                 // RowsPerStrip
  tag(279, 4, 1, pixelBytes);             // StripByteCounts
  tag(282, 5, 1, xresOff);                // XResolution
  tag(283, 5, 1, yresOff);                // YResolution
  v.setUint32(p, 0, true);                // fără alt IFD
  v.setUint16(bpsOff, 8, true); v.setUint16(bpsOff + 2, 8, true); v.setUint16(bpsOff + 4, 8, true);
  v.setUint32(xresOff, 300, true); v.setUint32(xresOff + 4, 1, true);
  v.setUint32(yresOff, 300, true); v.setUint32(yresOff + 4, 1, true);
  const out = new Uint8Array(buf);
  for (let i = 0, j = dataOff; i < width * height; i++, j += 3) {
    out[j] = rgba[i * 4]; out[j + 1] = rgba[i * 4 + 1]; out[j + 2] = rgba[i * 4 + 2];
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const CH = 0x8000 - (0x8000 % 3);
  for (let start = 0; start < bytes.length; start += CH) {
    const end = Math.min(bytes.length, start + CH);
    let s = '';
    let i = start;
    for (; i + 2 < end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (i < end) {
      const n = (bytes[i] << 16) | ((i + 1 < end ? bytes[i + 1] : 0) << 8);
      s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < end ? B64[(n >> 6) & 63] : '=') + '=';
    }
    parts.push(s);
  }
  return parts.join('');
}
