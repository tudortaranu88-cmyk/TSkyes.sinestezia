// Manifestul sample-urilor. React Native cere require() static pentru fiecare fișier.
// Cheia din `samples` = coloana din matrice: 0=Do3, 1=Re3, 2=Mi3, 3=Fa3, 4=Sol3, 5=La3, 6=Si3, 7=Do4.
// `tuned` = sample-uri tag-uite pe pitch-ul REAL măsurat (MIDI, A4 = 69 = 440 Hz); motorul alege
// sample-ul cel mai apropiat și îl transpune. Numele fișierelor: n<MIDI>.wav.
// Cheia instrumentului = id-ul din src/core/instruments.ts (bas, caval, dramba, flaut, nai, pian,
// taragot, tilinca, toba, vioara, violoncel). Instrumentele fără sample-uri folosesc timbrul sintetizat.
//
// Sunete reale (Tudor samples, WAV 48 kHz / 24 biți, copiate nemodificate):
//   vioara ← strings.wav, pitch măsurat MIDI 72 (≈521 Hz), stabil în 12/12 ferestre
//   pian   ← piano.wav,   pitch măsurat MIDI 29 (≈44 Hz),  stabil în 9/10 ferestre
// Note alese de utilizator (pitch-ul măsurat variază în fișier – probabil fraze, nu note ținute):
//   bas         ← bas.wav,          MIDI 41
//   caval       ← caval doinit.wav, MIDI 64
//   flaut       ← fluier.wav,       MIDI 86
//   fluierdublu ← fluier dublu.wav, MIDI 73
//   tilinca     ← tilinca.wav,      MIDI 65
// Doba și cimpoi nu se includ.

import type { InstrumentCfg } from '../../src/audio/AudioEngine';

export const SAMPLE_MANIFEST: Record<string, InstrumentCfg> = {
  // PIAN – percutant, fără buclă.
  pian: {
    samples: {},
    loop: false,
    release: 0.4,
    gain: 0.9,
    tuned: [{ midi: 29, mod: require('./pian/n029.wav') }],
  },

  // VIOARA (strings) – susținut, cu buclă.
  vioara: {
    samples: {},
    loop: true,
    loopStart: 0.4,
    attack: 0.06,
    release: 0.2,
    gain: 0.85,
    tuned: [{ midi: 72, mod: require('./vioara/n072.wav') }],
  },

  // BAS – susținut, cu buclă.
  bas: {
    samples: {},
    loop: true,
    loopStart: 0.4,
    attack: 0.05,
    release: 0.2,
    gain: 0.9,
    tuned: [{ midi: 41, mod: require('./bas/n041.wav') }],
  },

  // Suflători populari – susținuți, cu buclă pe toată înregistrarea.
  caval: {
    samples: {},
    loop: true,
    loopStart: 0.35,
    attack: 0.05,
    release: 0.15,
    gain: 0.8,
    tuned: [{ midi: 64, mod: require('./caval/n064.wav') }],
  },
  flaut: {
    samples: {},
    loop: true,
    loopStart: 0.35,
    attack: 0.05,
    release: 0.15,
    gain: 0.8,
    tuned: [{ midi: 86, mod: require('./flaut/n086.wav') }],
  },
  fluierdublu: {
    samples: {},
    loop: true,
    loopStart: 0.35,
    attack: 0.05,
    release: 0.15,
    gain: 0.8,
    tuned: [{ midi: 73, mod: require('./fluierdublu/n073.wav') }],
  },
  tilinca: {
    samples: {},
    loop: true,
    loopStart: 0.35,
    attack: 0.05,
    release: 0.15,
    gain: 0.8,
    tuned: [{ midi: 65, mod: require('./tilinca/n065.wav') }],
  },
};
