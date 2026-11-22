// Încărcarea imaginilor pe calculator (Windows): fereastra „Deschide” sau drag and drop.
//  • Nivelul 2: o imagine (JPEG, PNG, WebP, BMP, GIF) → micșorată la 360 px pe latura lungă.
//  • Nivelul 3: una sau mai multe partituri – imagini sau PDF-uri (fiecare pagină devine o imagine),
//    la rezoluție mare (2400 px pe latura lungă ≈ 200 dpi pe A4), ca să se citească și scanările.
// PDF-urile se citesc cu pdf.js (Mozilla), inclus local în program – fără internet.

import { sourceFromPixels, type ImageSource } from './imageCommon';
export { sourceFromPixels, demoPixels } from './imageCommon';
export type { ImageSource } from './imageCommon';

const MAX_SIDE = 360;
const SCORE_SIDE = 2400;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/bmp,image/gif,.jpg,.jpeg,.png,.webp,.bmp,.gif';
const SCORE_ACCEPT = `${IMAGE_ACCEPT},application/pdf,.pdf`;

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(f.name);
const byName = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true });

/** Deschide fereastra Windows de alegere a fișierelor. */
function chooseFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = (files: File[]) => { if (done) return; done = true; input.remove(); resolve(files); };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => finish([]));
    input.click();
  });
}

/** Pixelii unei imagini (orientarea EXIF corectată), micșorată astfel încât latura lungă ≤ maxSide. */
async function rasterize(src: CanvasImageSource & { width: number; height: number }, maxSide: number) {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);                 // transparența devine hârtie albă
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return { rgba: new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer), width: w, height: h };
}

async function imageFile(f: File, maxSide: number): Promise<ImageSource> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`„${f.name}” nu este o imagine pe care o pot citi (folosește JPEG, PNG sau PDF)`); }
  const r = await rasterize(bmp, maxSide);
  bmp.close();
  return sourceFromPixels(r.rgba, r.width, r.height, f.name);
}

// pdf.js se încarcă abia la primul PDF (fișierele lui stau în app/pdfjs/, copiate la construire)
let pdfjsPromise: Promise<any> | null = null;
function pdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    const dynImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    pdfjsPromise = dynImport('/pdfjs/pdf.min.mjs').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return lib;
    });
  }
  return pdfjsPromise;
}

async function pdfPages(f: File, maxSide: number): Promise<ImageSource[]> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(await f.arrayBuffer()),
    isEvalSupported: false,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }).promise;
  const out: ImageSource[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: maxSide / Math.max(v1.width, v1.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, background: 'rgb(255,255,255)' }).promise;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      out.push(sourceFromPixels(new Uint8Array(data.buffer), canvas.width, canvas.height,
        doc.numPages > 1 ? `${f.name} · pagina ${i}` : f.name));
      page.cleanup();
    }
  } finally {
    doc.destroy();
  }
  return out;
}

/** Nivelul 2: prima imagine dintre fișierele date (alese sau trase în fereastră). */
export async function imageFromFiles(files: File[]): Promise<ImageSource | null> {
  const f = files.find(isImage);
  if (!f) {
    if (files.length) throw new Error('Trage o imagine (JPEG sau PNG)');
    return null;
  }
  return imageFile(f, MAX_SIDE);
}

/** Nivelul 3: toate partiturile – imaginile și paginile PDF-urilor, în ordinea numelui fișierelor. */
export async function scoresFromFiles(files: File[]): Promise<ImageSource[]> {
  const ok = files.filter(f => isPdf(f) || isImage(f)).sort(byName);
  if (!ok.length) {
    if (files.length) throw new Error('Trage partituri ca JPEG, PNG sau PDF');
    return [];
  }
  const out: ImageSource[] = [];
  for (const f of ok) {
    if (isPdf(f)) out.push(...(await pdfPages(f, SCORE_SIDE)));
    else out.push(await imageFile(f, SCORE_SIDE));
  }
  if (!out.length) throw new Error('Partiturile nu au putut fi citite');
  return out;
}

export async function pickImage(): Promise<ImageSource | null> {
  return imageFromFiles(await chooseFiles(IMAGE_ACCEPT, false));
}

export async function pickScoreImages(): Promise<ImageSource[]> {
  return scoresFromFiles(await chooseFiles(SCORE_ACCEPT, true));
}
