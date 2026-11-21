// Export AAC (.m4a) pe telefon: WAV temporar → encoderul nativ Android (modulul aac-encoder).
// Varianta pentru calculator este în aac.web.ts.
import { encodeWavToM4a } from 'aac-encoder';
import { encodeWav, toBase64 } from '../core/encoders';
import { cachePath, stampName, writeBase64 } from '../io/files';

export async function exportM4a(mix: Float32Array, sampleRate: number): Promise<string> {
  const tmp = await writeBase64('_tmp_export.wav', toBase64(encodeWav(mix, sampleRate)));
  const out = cachePath(stampName('m4a'));
  await encodeWavToM4a(tmp, out, 128000);
  return out;
}
