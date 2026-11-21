// Varianta pentru calculator (Windows, prin Electron) a lui files.ts.
// Fișierele generate stau în memorie până la salvare; „Salvează” deschide fereastra „Salvează ca”
// din Windows (prin puntea din desktop/preload.js), pornind din Documente\Music and Color.
// Într-un browser obișnuit (fără punte), fișierul se descarcă.

export const MIME: Record<string, string> = {
  png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', tiff: 'image/tiff',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
};

export function stampName(ext: string, suffix = ''): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ext2 = ext === 'jpeg' ? 'jpg' : ext;
  return `MusicColor_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${suffix}.${ext2}`;
}

interface MemFile { name: string; bytes: Uint8Array }
const store = new Map<string, MemFile>();

export function cachePath(name: string): string {
  return 'mem://' + name;
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function writeBytes(name: string, bytes: Uint8Array): Promise<string> {
  const uri = cachePath(name);
  store.set(uri, { name, bytes });
  return uri;
}

export async function writeBase64(name: string, b64: string): Promise<string> {
  return writeBytes(name, fromBase64(b64));
}

interface Bridge { saveFiles(files: MemFile[]): Promise<string[]> }
const bridge = (): Bridge | undefined => (globalThis as any).musicColor;

/**
 * Salvează pe calculator unul sau mai multe fișiere generate. Întoarce căile scrise
 * (gol dacă utilizatorul a anulat fereastra „Salvează ca”).
 */
export async function saveFilesToDisk(uris: string[]): Promise<string[]> {
  const files = uris.map(u => {
    const f = store.get(u);
    if (!f) throw new Error('Fișierul generat nu mai există; generează-l din nou');
    return f;
  });
  const b = bridge();
  let paths: string[];
  if (b) {
    paths = await b.saveFiles(files);
  } else {
    for (const f of files) {
      const url = URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: MIME[f.name.split('.').pop() ?? ''] }));
      const a = document.createElement('a');
      a.href = url; a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    paths = files.map(f => f.name);
  }
  if (paths.length) uris.forEach(u => store.delete(u));
  return paths;
}

export async function saveToDevice(uri: string): Promise<void> {
  await saveFilesToDisk([uri]);
}

export async function shareFile(_uri: string, _mimeType: string): Promise<void> {
  throw new Error('Partajarea nu este disponibilă pe calculator; salvează fișierul și trimite-l de acolo');
}
