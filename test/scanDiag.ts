// Diagnostic manual: npx tsx test/scanDiag.ts <caz 0..2> [gray]
import { buildMelody } from '../src/core/imageMelody';
import { layoutScore } from '../src/core/scoreLayout';
import { decodeScanPage, scanDebug } from '../src/core/scanDecode';
import { cellColor, cellPitch, type RGB } from '../src/core/golden';
import { render, scan, printed, dim, type Scan } from './scanSim';

const CASES: Scan[] = [
  { scale: 1, angle: 0, offX: 0, offY: 0, extraW: 0, extraH: 0 },
  { scale: 1.9, angle: 0.8, offX: 40, offY: 60, extraW: 90, extraH: 140, color: printed, noise: 6, blur: true },
  { scale: 0.75, angle: -1.5, offX: 30, offY: 25, extraW: 60, extraH: 50, color: dim, noise: 8, blur: true, border: true },
];
const k = Number(process.argv[2] ?? 0);
const gray = process.argv[3] === 'gray';
const colors: RGB[] = [];
let s = 11;
for (let i = 0; i < 260; i++) {
  s = (s * 69069 + 1) >>> 0;
  const repeat = (s >>> 8) % 3 === 0 && i > 0;
  colors.push(repeat ? colors[i - 1] : cellColor((s >>> 3) % 8, ((s >>> 12) % 21) - 10));
}
const pages = layoutScore(buildMelody(colors), { title: 'T', subtitle: 's', instrument: 'Pian', bpm: 105 });
for (let p = 0; p < pages.length; p++) {
  const want = pages[p].notes.flatMap(n => Array.from({ length: n.beats }, () => `${n.col}:${n.row}`));
  try {
    const r = decodeScanPage(scan(render(pages[p].prims), { ...CASES[k], gray }), p === pages.length - 1);
    const got = r.cells.map(c => `${c.col}:${c.row}`);
    const bad = got.map((g, i) => (g === want[i] ? null : `${i}:${want[i]}→${g}`)).filter(Boolean);
    const md = (k: string) => { const [c, rr] = k.split(':').map(Number); return cellPitch(c, rr, 'tempered').midi; };
    const badM = got.filter((g, i) => md(g) !== md(want[i] ?? '0:0')).length;
    console.log(`p${p + 1} înălțimi greșite ${badM} ${r.mode} beats ${r.beats}/${want.length} sys ${r.systems} greșite ${bad.length}`, bad.slice(0, 8).join(' '));
  } catch (e: any) { console.log(`p${p + 1} EROARE ${e.message}`); }
  const { segs, ...rest } = scanDebug;
  console.log('   ', JSON.stringify(rest, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
}
