// Modul nativ local: WAV → AAC (.m4a) cu encoderul Android-ului (MediaCodec).
// Se încarcă abia la folosire, ca lipsa lui să nu oprească aplicația.
import { requireOptionalNativeModule } from 'expo';

type AacNative = { encodeWavToM4a(wavPath: string, outPath: string, bitrate: number): Promise<string> };

export function encodeWavToM4a(wavPath: string, outPath: string, bitrate = 128000): Promise<string> {
  const Native = requireOptionalNativeModule<AacNative>('AacEncoder');
  if (!Native) return Promise.reject(new Error('Encoderul AAC nu este disponibil în această versiune'));
  return Native.encodeWavToM4a(wavPath, outPath, bitrate);
}
