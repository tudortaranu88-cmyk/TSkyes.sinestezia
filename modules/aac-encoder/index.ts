// Modul nativ local: WAV → AAC (.m4a) cu encoderul hardware/software al Android-ului (MediaCodec).
import { requireNativeModule } from 'expo';

const Native = requireNativeModule<{ encodeWavToM4a(wavPath: string, outPath: string, bitrate: number): Promise<string> }>('AacEncoder');

export function encodeWavToM4a(wavPath: string, outPath: string, bitrate = 128000): Promise<string> {
  return Native.encodeWavToM4a(wavPath, outPath, bitrate);
}
