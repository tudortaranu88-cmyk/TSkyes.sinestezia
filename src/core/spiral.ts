// =====================================================================
// SPIRALA SINESTEZICĂ – spirala de aur (logaritmică), proporția φ = 1,618…
// =====================================================================
//
// Ecuația polară:   r(θ) = a · φ^(2θ/π) = a · e^(bθ),   b = 2·ln(φ)/π ≈ 0,306349
//   → raza crește EXACT cu φ la fiecare sfert de tură (π/2).
//
// Fiecare notă ocupă un sfert de tură. Nota cu „vârsta” u (0 = cea mai nouă)
// se întinde pe θ ∈ [u·π/2, (u+1)·π/2]. Din autosimilaritatea spiralei rezultă,
// riguros, pentru două note consecutive (u și u+1):
//   • raza (distanța față de centru) ............ × φ
//   • distanța dintre noduri (coardă) ........... × φ
//   • lungimea formei (lungimea arcului) ........ × φ
//   • curbura κ = 1 / (r·√(1+b²)) ................ × 1/φ
//   • grosimea liniei și raza nodului ........... × φ (proporționale cu r)
//
// Orientare: centrul spiralei = centrul jumătății superioare. Notele noi apar
// în centru; pe măsură ce îmbătrânesc, migrează pe spirală pornind în SUS și
// curbându-se spre STÂNGA (sens trigonometric pe ecran). Ambele sunt parametri.
//
// Toate funcțiile sunt pure și marcate 'worklet' → rulează și pe firul UI
// (Reanimated / Skia), și în Node pentru teste.

export const PHI = (1 + Math.sqrt(5)) / 2;
export const QUARTER = Math.PI / 2;
export const B = (2 * Math.log(PHI)) / Math.PI;
const SQ = Math.sqrt(1 + B * B);

export interface SpiralConfig {
  cx: number;          // centrul spiralei (px)
  cy: number;
  a: number;           // raza la θ = 0 (nota cea mai nouă), px
  startAngle: number;  // direcția de plecare pe ecran (rad); -π/2 = în sus
  turn: 1 | -1;        // -1 = sens trigonometric pe ecran (sus → stânga); 1 = sens orar (sus → dreapta)
  strokeRatio: number; // grosimea liniei = strokeRatio · r
  nodeRatio: number;   // raza nodului = nodeRatio · r
}

export interface Point { x: number; y: number }

export interface NoteSegment {
  u: number;           // vârsta (în sferturi de tură)
  theta0: number;
  theta1: number;
  r0: number;          // raza la începutul arcului
  r1: number;          // raza la sfârșitul arcului (= r0 · φ)
  length: number;      // lungimea arcului
  curvature: number;   // curbura la începutul arcului
  strokeWidth: number;
  node: Point & { radius: number };
  points: Point[];     // polilinie pentru desen
}

export function radiusAt(theta: number, a: number): number {
  'worklet';
  return a * Math.exp(B * theta);
}

/** Lungimea arcului de spirală între θ0 și θ1 (formula exactă). */
export function arcLength(theta0: number, theta1: number, a: number): number {
  'worklet';
  return ((a * SQ) / B) * (Math.exp(B * theta1) - Math.exp(B * theta0));
}

export function curvatureAt(theta: number, a: number): number {
  'worklet';
  return 1 / (radiusAt(theta, a) * SQ);
}

export function pointAt(theta: number, cfg: SpiralConfig): Point {
  'worklet';
  const r = radiusAt(theta, cfg.a);
  const ang = cfg.startAngle + cfg.turn * theta;
  return { x: cfg.cx + r * Math.cos(ang), y: cfg.cy + r * Math.sin(ang) };
}

/** Geometria completă a notei cu vârsta u (u poate fi fracționar → animație continuă). */
export function noteSegment(u: number, cfg: SpiralConfig, samples = 24): NoteSegment {
  'worklet';
  const theta0 = u * QUARTER;
  const theta1 = (u + 1) * QUARTER;
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    points.push(pointAt(theta0 + ((theta1 - theta0) * i) / samples, cfg));
  }
  const r0 = radiusAt(theta0, cfg.a);
  const p0 = points[0];
  return {
    u, theta0, theta1, r0,
    r1: radiusAt(theta1, cfg.a),
    length: arcLength(theta0, theta1, cfg.a),
    curvature: curvatureAt(theta0, cfg.a),
    strokeWidth: cfg.strokeRatio * r0,
    node: { x: p0.x, y: p0.y, radius: cfg.nodeRatio * r0 },
    points,
  };
}

/** Câte note încap pe ecran: cea mai veche notă vizibilă începe în interiorul razei maxime. */
export function visibleCount(cfg: SpiralConfig, maxRadius: number): number {
  'worklet';
  return Math.max(1, Math.ceil(Math.log(maxRadius / cfg.a) / Math.log(PHI)));
}

/**
 * Configurare pentru o zonă width × height: alege `a` astfel încât exact
 * `notesVisible` note să încapă până la marginea cea mai apropiată.
 */
export function fitSpiral(width: number, height: number, notesVisible = 9): SpiralConfig {
  'worklet';
  const maxR = Math.min(width, height) / 2;
  return {
    cx: width / 2,
    cy: height / 2,
    a: maxR / Math.pow(PHI, notesVisible),
    startAngle: -Math.PI / 2,
    turn: -1,
    strokeRatio: 0.12,
    nodeRatio: 0.16,
  };
}
