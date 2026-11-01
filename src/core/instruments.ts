// Instrumentele aplicației. `id` = numele folderului din assets/sunete/ (și cheia din SAMPLE_MANIFEST).
// Până sosesc sample-urile, fiecare instrument are un timbru sintetizat propriu (`synth`).

export interface SynthTimbre {
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  mult: number;      // transpunere față de nota cântată (0.5 = o octavă mai jos)
  attack: number;    // s
  peak: number;      // amplitudinea maximă
  sustain: number;   // nivelul la care coboară după atac (0 = sunet percutat)
  decay: number;     // constanta de timp a coborârii (s)
}

export interface Instrument {
  id: string;
  label: string;
  synth: SynthTimbre;
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'bas',       label: 'Bas',       synth: { wave: 'triangle', mult: 0.5,  attack: 0.01, peak: 0.45, sustain: 0.30, decay: 0.5 } },
  { id: 'caval',     label: 'Caval',     synth: { wave: 'sine',     mult: 1,    attack: 0.08, peak: 0.35, sustain: 0.30, decay: 0.3 } },
  { id: 'dramba',    label: 'Dramba',    synth: { wave: 'square',   mult: 1,    attack: 0.01, peak: 0.16, sustain: 0.10, decay: 0.3 } },
  { id: 'flaut',     label: 'Flaut',     synth: { wave: 'sine',     mult: 2,    attack: 0.06, peak: 0.30, sustain: 0.26, decay: 0.3 } },
  { id: 'nai',       label: 'Nai',       synth: { wave: 'sine',     mult: 1,    attack: 0.04, peak: 0.36, sustain: 0.28, decay: 0.4 } },
  { id: 'pian',      label: 'Pian',      synth: { wave: 'triangle', mult: 1,    attack: 0.005, peak: 0.40, sustain: 0.02, decay: 0.9 } },
  { id: 'taragot',   label: 'Taragot',   synth: { wave: 'square',   mult: 1,    attack: 0.03, peak: 0.18, sustain: 0.14, decay: 0.3 } },
  { id: 'tilinca',   label: 'Tilinca',   synth: { wave: 'sine',     mult: 2,    attack: 0.05, peak: 0.28, sustain: 0.22, decay: 0.3 } },
  { id: 'toba',      label: 'Toba',      synth: { wave: 'sine',     mult: 0.25, attack: 0.002, peak: 0.70, sustain: 0,    decay: 0.12 } },
  { id: 'vioara',    label: 'Vioara',    synth: { wave: 'sawtooth', mult: 1,    attack: 0.08, peak: 0.16, sustain: 0.14, decay: 0.4 } },
  { id: 'violoncel', label: 'Violoncel', synth: { wave: 'sawtooth', mult: 0.5,  attack: 0.10, peak: 0.20, sustain: 0.17, decay: 0.4 } },
];

export const DEFAULT_INSTRUMENT = 'pian';

export const instrumentById = (id: string): Instrument =>
  INSTRUMENTS.find(i => i.id === id) ?? INSTRUMENTS.find(i => i.id === DEFAULT_INSTRUMENT)!;
