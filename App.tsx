// Ecran principal Music&Color (TSkyes).
// Sus: bara discretă cu numele aplicației și selectorul de nivel.
// Nivel 1: 50% vizualizator (sus) / 50% claviatură cu 7 rânduri vizibile + coloana de instrumente (jos).
// Nivelurile 2 și 3 urmează în etapele următoare.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Visualizer } from './src/components/Visualizer';
import { Keyboard } from './src/components/Keyboard';
import { InstrumentBar } from './src/components/InstrumentBar';
import { Header, type Level } from './src/components/Header';
import { AudioEngine } from './src/audio/AudioEngine';
import { SAMPLE_MANIFEST } from './assets/sunete/manifest';
import { NOTES, cellColor, cellPitch, freqToMidi, type Tuning } from './src/core/golden';
import { DEFAULT_INSTRUMENT } from './src/core/instruments';
import type { NoteEvent } from './src/core/types';

const MAX_EVENTS = 64;
const TUNING: Tuning = 'tempered';

const keyOf = (col: number, row: number) => `${row}:${col}`;

export default function App() {
  const [level, setLevel] = useState<Level>(1);
  const [instrument, setInstrument] = useState(DEFAULT_INSTRUMENT);
  const [events, setEvents] = useState<NoteEvent[]>([]);
  const engine = useRef<AudioEngine | null>(null);
  const held = useRef(new Map<string, { voice: number; eventId: number }>());
  const nextId = useRef(1);

  useEffect(() => {
    const e = new AudioEngine();
    engine.current = e;
    Object.entries(SAMPLE_MANIFEST).forEach(([name, cfg]) => e.loadInstrument(name, cfg));
  }, []);

  const onPressIn = useCallback((col: number, row: number) => {
    const k = keyOf(col, row);
    if (held.current.has(k)) return;
    const { freq } = cellPitch(col, row, TUNING);
    const voice = engine.current?.noteOn(instrument, freq) ?? -1;
    const id = nextId.current++;
    held.current.set(k, { voice, eventId: id });
    const ev: NoteEvent = {
      id, col, row, label: `${NOTES[col]} (${row > 0 ? '+' : ''}${row})`,
      freq, midiFloat: freqToMidi(freq), color: cellColor(col, row),
      startMs: Date.now(), durationMs: null,
    };
    setEvents(prev => [...prev.slice(-(MAX_EVENTS - 1)), ev]);
  }, [instrument]);

  const onPressOut = useCallback((col: number, row: number) => {
    const k = keyOf(col, row);
    const h = held.current.get(k);
    if (!h) return;
    held.current.delete(k);
    engine.current?.noteOff(h.voice);
    const end = Date.now();
    setEvents(prev => prev.map(e => (e.id === h.eventId ? { ...e, durationMs: end - e.startMs } : e)));
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <Header level={level} onLevelChange={setLevel} />
      {level === 1 ? (
        <>
          <View style={styles.half}><Visualizer events={events} /></View>
          <View style={styles.divider} />
          <View style={[styles.half, styles.controls]}>
            <Keyboard onPressIn={onPressIn} onPressOut={onPressOut} />
            <InstrumentBar selected={instrument} onSelect={setInstrument} />
          </View>
        </>
      ) : (
        <View style={styles.soon}>
          <Text style={styles.soonTitle}>Nivelul {level}</Text>
          <Text style={styles.soonTxt}>
            {level === 2
              ? 'Imagine → melodie și partitură. În lucru.'
              : 'Partitură → tablou. În lucru.'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0e12' },
  half: { flex: 1 },               // două jumătăți egale
  controls: { flexDirection: 'row', backgroundColor: '#181822', padding: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333' },
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  soonTitle: { color: '#ffd700', fontSize: 20, fontWeight: '700' },
  soonTxt: { color: '#8a8a99', fontSize: 14 },
});
