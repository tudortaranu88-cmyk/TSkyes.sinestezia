// Scrierea fișierelor, salvarea în telefon (galerie / muzică) și partajarea (WhatsApp, e-mail…).

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export const MIME: Record<string, string> = {
  png: 'image/png', jpeg: 'image/jpeg', tiff: 'image/tiff',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
};

export function stampName(ext: string, suffix = ''): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ext2 = ext === 'jpeg' ? 'jpg' : ext;
  return `MusicColor_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${suffix}.${ext2}`;
}

export function cachePath(name: string): string {
  return (FileSystem.cacheDirectory ?? '') + name;
}

export async function writeBase64(name: string, b64: string): Promise<string> {
  const uri = cachePath(name);
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

/**
 * Salvează în telefon. Pe Android: galeria / Muzica. Pe iPhone, Fotografiile primesc doar PNG și JPEG;
 * melodiile și TIFF-ul se trimit prin foaia de partajare („Salvează în Fișiere”).
 */
export async function saveToDevice(uri: string): Promise<void> {
  const ext = (uri.split('?')[0].split('.').pop() ?? '').toLowerCase();
  if (Platform.OS === 'ios' && !['png', 'jpg', 'jpeg'].includes(ext)) {
    await shareFile(uri, MIME[ext === 'jpg' ? 'jpeg' : ext] ?? 'application/octet-stream');
    return;
  }
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo', 'audio']);
  if (!perm.granted) throw new Error('Permisiunea de salvare a fost refuzată');
  await MediaLibrary.createAssetAsync(uri);
}

export async function shareFile(uri: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Partajarea nu este disponibilă pe acest telefon');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Trimite cu…' });
}
