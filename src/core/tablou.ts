// Tabloul final: TOATE notele aduse în prim-plan ca puncte de culoare, așezate după
// unghiul de aur (modelul florii-soarelui / Vogel). Nota i stă la unghiul i·α (α = 2π/φ² ≈ 137,5°)
// și raza R·√((i+0,5)/n) → punctele umplu uniform un disc, toate vizibile, oricâte ar fi.
// Spirala animată din Nivelul 1 (prezentarea) e separată; asta e imaginea care se salvează.

import { GOLDEN_ANGLE } from './imageMelody';

export interface Dot { x: number; y: number; r: number }

/**
 * Pozițiile celor `n` puncte ale tabloului într-o zonă width × height.
 * Compoziție rotundă, înscrisă (R = latura scurtă / 2 · fill), centrată.
 * Raza unui punct scade cu √n, astfel încât punctele să se atingă indiferent de densitate.
 */
export function sunflowerDots(n: number, width: number, height: number, fill = 0.92, dotScale = 0.85): Dot[] {
  const cx = width / 2, cy = height / 2;
  const R = (Math.min(width, height) / 2) * fill;
  const dotR = n > 0 ? (dotScale * R) / Math.sqrt(n) : 0;
  const out: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const rad = R * Math.sqrt((i + 0.5) / n);
    const ang = -Math.PI / 2 - i * GOLDEN_ANGLE;        // pornește în sus, sens trigonometric (ca spirala)
    out.push({ x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang), r: dotR });
  }
  return out;
}
