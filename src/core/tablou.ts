// Tabloul final: TOATE notele aduse în prim-plan ca puncte de culoare, așezate după
// unghiul de aur (modelul florii-soarelui / Vogel). Nota i stă la unghiul i·α (α = 2π/φ² ≈ 137,5°)
// și raza R·√((i+0,5)/n) → punctele umplu uniform un disc, toate vizibile, oricâte ar fi.
// Spirala animată din Nivelul 1 (prezentarea) e separată; asta e imaginea care se salvează.

import { GOLDEN_ANGLE } from './imageMelody';

export interface Dot { x: number; y: number; r: number }

// Distanța medie între vecini în acest aranjament ≈ NN_K · R/√n (măsurat, stabil pentru orice n;
// interesant, NN_K ≈ φ). O rază de punct = NN_K/2 · R/√n face punctele să se atingă; `overlap`
// le mărește cu acel procent, ca să se suprapună și să nu rămână negru între ele.
export const NN_K = 1.68;

// Transparența punctelor: 15% transparent → opacitate 85%. Punctele suprapuse se văd unul prin altul.
export const DOT_OPACITY = 0.85;

/**
 * Pozițiile celor `n` puncte ale tabloului într-o zonă width × height.
 * Compoziție rotundă, înscrisă (R = latura scurtă / 2 · fill), centrată.
 * `overlap` = cât se suprapun punctele peste simpla atingere (0,07 = 7%).
 */
export function sunflowerDots(n: number, width: number, height: number, fill = 0.92, overlap = 0.07): Dot[] {
  const cx = width / 2, cy = height / 2;
  const R = (Math.min(width, height) / 2) * fill;
  const dotR = n > 0 ? ((NN_K / 2) * (1 + overlap) * R) / Math.sqrt(n) : 0;
  const out: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const rad = R * Math.sqrt((i + 0.5) / n);
    const ang = -Math.PI / 2 - i * GOLDEN_ANGLE;        // pornește în sus, sens trigonometric (ca spirala)
    out.push({ x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang), r: dotR });
  }
  return out;
}
