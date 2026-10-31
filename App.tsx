// Ecran principal: 50% vizualizator (sus) / 50% claviatură (jos).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Visualizer } from './src/components/Visualizer';
import { Keyboard } from './src/components/Keyboard';
import { AudioEngine } from './src/audio/AudioEngine';
import { SAMPLE_MANIFEST } from './assets/sunete/manifest';
import { NOTES, cellColor, cellPitch, freqToMidi, type Tuning } from './src/core/golden';
import type { NoteEvent } from './src/core/types';

const MAX_EVENTS = 64;
const INSTRUMENT = 'pian';        // selectorul de instrument urmează în iterația următoare
const TUNING: Tuning = 'tempered';

export default function App() {
  const [row, setRow] = useState(0);
  const [events, setEvents] = useState<NoteEvent[]>([]);
  const engine = useRef<AudioEngine | null>(null);
  const held = useRef(new Map<number, { voice: number; eventId: number }>());
  const nextId = useRef(1);

  useEffect(() => {
    const e = new AudioEngine();
    engine.current = e;
    Object.entries(SAMPLE_MANIFEST).forEach(([name, cfg]) => e.loadInstrument(name, cfg));
  }, []);

  const onPressIn = useCallback((col: number) => {
    const { freq } = cellPitch(col, row, TUNING);
    const voice = engine.current?.noteOn(INSTRUMENT, freq) ?? -1;
    const id = nextId.current++;
    held.current.set(col, { voice, eventId: id });
    const ev: NoteEvent = {
      id, col, row, label: `${NOTES[col]} (${row > 0 ? '+' : ''}${row})`,
      freq, midiFloat: freqToMidi(freq), color: cellColor(col, row),
      startMs: Date.now(), durationMs: null,
    };
    setEvents(prev => [...prev.slice(-(MAX_EVENTS - 1)), ev]);
  }, [row]);

  const onPressOut = useCallback((col: number) => {
    const h = held.current.get(col);
    if (!h) return;
    held.current.delete(col);
    engine.current?.noteOff(h.voice);
    const end = Date.now();
    setEvents(prev => prev.map(e => (e.id === h.eventId ? { ...e, durationMs: end - e.startMs } : e)));
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.half}><Visualizer events={events} /></View>
      <View style={styles.divider} />
      <View style={styles.half}>
        <Keyboard row={row} onRowChange={setRow} onPressIn={onPressIn} onPressOut={onPressOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0e12' },
  half: { flex: 1 },               // două jumătăți egale
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333' },
});
