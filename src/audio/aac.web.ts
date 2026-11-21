// Export AAC (.m4a) pe calculator: encoderul AAC din Chromium (WebCodecs, prin Media Foundation
// pe Windows) + containerul MP4 scris în JS (mp4-muxer). Totul local, fără internet.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { stampName, writeBytes } from '../io/files.web';

const BITRATE = 128000;

export async function exportM4a(mix: Float32Array, sampleRate: number): Promise<string> {
  const AE: any = (globalThis as any).AudioEncoder;
  const AD: any = (globalThis as any).AudioData;
  const config = { codec: 'mp4a.40.2', sampleRate, numberOfChannels: 1, bitrate: BITRATE };
  if (typeof AE !== 'function' || !(await AE.isConfigSupported(config)).supported) {
    throw new Error('Encoderul AAC nu este disponibil pe acest calculator; alege MP3 sau WAV');
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    audio: { codec: 'aac', numberOfChannels: 1, sampleRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure: any = null;
  const enc = new AE({
    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
    error: (e: any) => { failure = e; },
  });
  enc.configure(config);

  const BLOCK = sampleRate; // 1 s pe bucată
  for (let i = 0; i < mix.length; i += BLOCK) {
    const part = mix.slice(i, Math.min(mix.length, i + BLOCK));
    const data = new AD({
      format: 'f32-planar', sampleRate, numberOfChannels: 1, numberOfFrames: part.length,
      timestamp: Math.round((i / sampleRate) * 1e6), data: part,
    });
    enc.encode(data);
    data.close();
    if (failure) break;
  }
  await enc.flush();
  enc.close();
  if (failure) throw new Error(`Codarea AAC a eșuat (${failure?.message ?? failure})`);
  muxer.finalize();
  return writeBytes(stampName('m4a'), new Uint8Array(target.buffer));
}
