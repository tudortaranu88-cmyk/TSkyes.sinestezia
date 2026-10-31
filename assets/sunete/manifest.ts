// Manifestul sample-urilor. React Native cere require() static pentru fiecare fișier.
// Cheia din `samples` = coloana din matrice: 0=Do3, 1=Re3, 2=Mi3, 3=Fa3, 4=Sol3, 5=La3, 6=Si3, 7=Do4.
// Exemplu (după ce adăugați fișierele):
//   pian: { samples: { 0: require('./pian/Do3.wav'), 5: require('./pian/La3.wav') }, release: 0.4 },
//   nai:  { samples: { 0: require('./nai/Do3.wav') }, loop: true, loopStart: 0.3, attack: 0.05 },

import type { InstrumentCfg } from '../../src/audio/AudioEngine';

export const SAMPLE_MANIFEST: Record<string, InstrumentCfg> = {};
