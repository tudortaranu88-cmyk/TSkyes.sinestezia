// Ecran principal Music&Color (TSkyes).
// Sus: bara discretă cu numele aplicației și selectorul de nivel.
// Nivel 1: 50% vizualizator (sus, cu Nou / Salvează) / 50% claviatură cu 7 rânduri vizibile (jos);
// instrumentele stau ascunse pe marginea din dreapta (săgeata mică le deschide).
// Nivel 2: imagine → melodie + partitură. Nivel 3: partitură → tablou (src/screens/Level3.tsx).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Visualizer } from './src/components/Visualizer';
import { Keyboard } from './src/components/Keyboard';
import { InstrumentBar } from './src/components/InstrumentBar';
import { Header, type Level } from './src/components/Header';
import { SaveSheet } from './src/components/SaveSheet';
import { exportImageFile, exportAudioFile } from './src/io/exportComposition';
import type { ImageKind } from './src/render/exportImage';
import { demoComposition, runSelfTest, runSelfTest2, runSelfTest3, demoScorePages, runAudioProbe } from './src/io/selfTest';
import { Level2 } from './src/screens/Level2';
import { Level3 } from './src/screens/Level3';
import { demoPixels, sourceFromPixels, type ImageSource } from './src/io/imageSource';
import type { ScorePixels } from './src/core/scoreDecode';
import { AudioEngine } from './src/audio/AudioEngine';
import { SAMPLE_MANIFEST } from './assets/sunete/manifest';
import { NOTES, cellColor, cellPitch, freqToMidi, type Tuning } from './src/core/golden';
import { DEFAULT_INSTRUMENT, instrumentById } from './src/core/instruments';
import type { NoteEvent } from './src/core/types';

const TUNING: Tuning = 'tempered';
const SPIRAL_KINDS = [{ id: 'png', label: 'PNG' }, { id: 'jpeg', label: 'JPEG' }, { id: 'tiff', label: 'TIFF' }];

const keyOf = (col: number, row: number) => `${row}:${col}`;

export default function App() {
  const [level, setLevel] = useState<Level>(1);
  const [instrument, setInstrument] = useState(DEFAULT_INSTRUMENT);
  const [events, setEvents] = useState<NoteEvent[]>([]);
  const engine = useRef<AudioEngine | null>(null);
  const held = useRef(new Map<string, { voice: number; eventId: number }>());
  const nextId = useRef(1);
  const [saveOpen, setSaveOpen] = useState(false);
  const [l2Injected, setL2Injected] = useState<ImageSource | null>(null);
  const [l3Injected, setL3Injected] = useState<ScorePixels[] | null>(null);

  useEffect(() => {
    const e = new AudioEngine();
    engine.current = e;
    Object.entries(SAMPLE_MANIFEST).forEach(([name, cfg]) => e.loadInstrument(name, cfg));
  }, []);

  // autotest pentru verificarea automată (musiccolor://selftest)
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !(url.includes('selftest') || url.includes('audioprobe'))) return;
      if (url.includes('audioprobe')) { runAudioProbe(engine.current); return; }
      if (url.includes('selftest3')) {
        const { pages, noteCount } = demoScorePages();
        setLevel(3);
        setL3Injected(pages);
        runSelfTest3(pages, noteCount, engine.current?.getSampleSets() ?? {});
        return;
      }
      if (url.includes('selftest2')) {
        const src = sourceFromPixels(demoPixels(), 360, 270, 'test');
        setLevel(2);
        setL2Injected(src);
        runSelfTest2(src, 'pian', engine.current?.getSampleSets() ?? {});
        return;
      }
      const demo = demoComposition();
      setEvents(demo);
      runSelfTest(demo, engine.current?.getSampleSets() ?? {});
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const onNew = useCallback(() => {
    if (!events.length) return;
    Alert.alert('Compoziție nouă', 'Începi o compoziție nouă? Imaginea și melodia curentă se șterg (salvează-le înainte, dacă vrei să le păstrezi).', [
      { text: 'Renunță', style: 'cancel' },
      { text: 'Începe', style: 'destructive', onPress: () => { held.current.clear(); setEvents([]); } },
    ]);
  }, [events.length]);

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
      startMs: Date.now(), durationMs: null, instrument,
    };
    setEvents(prev => [...prev, ev]);
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
      <Header level={level} instrument={instrumentById(instrument).label} onLevelChange={setLevel} />
      {level === 1 ? (
        <>
          <View style={styles.half}>
            <Visualizer events={events} onNew={onNew} onSave={() => setSaveOpen(true)} />
          </View>
          <View style={styles.divider} />
          <View style={[styles.half, styles.controls]}>
            <Keyboard onPressIn={onPressIn} onPressOut={onPressOut} />
            <InstrumentBar selected={instrument} onSelect={setInstrument} />
          </View>
        </>
      ) : level === 2 ? (
        <Level2 engine={engine} instrument={instrument} onInstrumentChange={setInstrument} injected={l2Injected} />
      ) : (
        <Level3 engine={engine} injected={l3Injected} />
      )}
      <SaveSheet
        visible={saveOpen}
        title="Salvează compoziția"
        subtitle={`${events.length} ${events.length === 1 ? 'notă' : 'note'}`}
        imageLabel="Imaginea (spirala completă)"
        imageKinds={SPIRAL_KINDS}
        exportImage={async kind => [await exportImageFile(events, kind as ImageKind)]}
        exportAudio={(kind, onProgress) => exportAudioFile(events, kind, engine.current?.getSampleSets(), onProgress)}
        onClose={() => setSaveOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0e12' },
  half: { flex: 1 },               // două jumătăți egale
  controls: { flexDirection: 'row', backgroundColor: '#181822', paddingVertical: 6, paddingLeft: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333' },
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  soonTitle: { color: '#ffd700', fontSize: 20, fontWeight: '700' },
  soonTxt: { color: '#8a8a99', fontSize: 14 },
});
