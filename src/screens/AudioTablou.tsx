// NIVEL 2 – modul „din fișier audio”: încarci un WAV / MP3; aplicația îl decodează, îi găsește notele
// și le transformă în tablou – floarea-soarelui (fiecare notă un punct de culoare) sau spirala de aur.
// Culorile vin din paleta aleasă la Nivelul 1. Melodia găsită poate fi ascultată cu instrumentul ales.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, LayoutChangeEvent } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { InstrumentBar } from '../components/InstrumentBar';
import { SaveSheet, type ExportedFile } from '../components/SaveSheet';
import { detectNotes, notesToEvents, recolor } from '../core/audioMelody';
import { sunflowerDots, DOT_OPACITY } from '../core/tablou';
import { buildScene } from '../core/scene';
import { renderMix } from '../core/audioRender';
import { rgbToCss, PALETTES, type PaletteId } from '../core/golden';
import { instrumentById } from '../core/instruments';
import { exportTablouImage, TABLOU_STYLES, type ImageKind, type TablouStyle } from '../render/exportImage';
import { eventsToNotes, exportAudioFile, type AudioKind } from '../io/exportComposition';
import { stampName, writeBase64 } from '../io/files';
import { pickAudio, decodeAudio } from '../io/audioSource';
import type { AudioEngine } from '../audio/AudioEngine';
import type { NoteEvent } from '../core/types';

const KINDS = [{ id: 'png', label: 'PNG' }, { id: 'jpeg', label: 'JPEG' }, { id: 'tiff', label: 'TIFF' }];

interface Props {
  engine: React.RefObject<AudioEngine | null>;
  instrument: string;
  onInstrumentChange: (id: string) => void;
  palette: PaletteId;
  injected?: NoteEvent[] | null;
  modeSwitch: React.ReactNode;
}

export function AudioTablou({ engine, instrument, onInstrumentChange, palette, injected, modeSwitch }: Props) {
  const [raw, setRaw] = useState<NoteEvent[]>([]);
  const [fileName, setFileName] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [style, setStyle] = useState<TablouStyle>('floare');
  const stopper = useRef<(() => void) | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (injected?.length) { setRaw(injected); setFileName('autotest'); setSeconds(0); }
  }, [injected]);

  // culorile urmează paleta curentă, iar redarea instrumentul curent
  const events = useMemo(() => recolor(raw, palette).map(e => ({ ...e, instrument })), [raw, palette, instrument]);

  const stop = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    stopper.current?.();
    stopper.current = null;
    setPlaying(false);
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => { stop(); }, [raw, instrument, stop]);

  const choose = useCallback(async () => {
    const eng = engine.current;
    if (!eng) return;
    stop();
    setError(null);
    try {
      const picked = await pickAudio();
      if (!picked) return;
      setBusy('Se citește fișierul…');
      const pcm = await decodeAudio(eng, picked.uri, picked.name);
      setBusy('Se caută notele…');
      await new Promise(r => setTimeout(r, 40)); // lasă mesajul să apară înainte de calcul
      const notes = detectNotes(pcm.data, pcm.sampleRate);
      if (!notes.length) throw new Error('Nu am găsit note cu înălțime clară în acest fișier.');
      setRaw(notesToEvents(notes, palette, instrument));
      setFileName(pcm.name);
      setSeconds(pcm.data.length / pcm.sampleRate);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }, [engine, stop, palette, instrument]);

  const play = useCallback(async () => {
    const eng = engine.current;
    if (!eng || !events.length) return;
    if (playing) { stop(); return; }
    await eng.ensureRunning();
    const sr = eng.sampleRate;
    const mix = renderMix(eventsToNotes(events), { sampleRate: sr, samples: eng.getSampleSets() });
    stopper.current = eng.playPCM(mix, sr);
    setPlaying(true);
    stopTimer.current = setTimeout(stop, (mix.length / sr) * 1000 + 200);
  }, [engine, events, playing, stop]);

  // previzualizarea = exact imaginea care se salvează (același stil)
  const dots = useMemo(() => {
    if (style !== 'floare' || !box.w || !events.length) return null;
    return sunflowerDots(events.length, box.w, box.h).map((d, i) => ({ ...d, color: events[i].color }));
  }, [style, box, events]);

  const scene = useMemo(() => {
    if (style !== 'spirala' || !box.w || !events.length) return null;
    return buildScene({ width: box.w, height: box.h, events, nowMs: 1e12, insertPhase: 1, pxPerSec: 60, fill: 0.98, cover: true });
  }, [style, box, events]);

  const poly = (pts: { x: number; y: number }[]) => {
    const p = Skia.Path.Make();
    pts.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
    return p;
  };

  const exportImage = async (kind: string, st: string): Promise<ExportedFile[]> => {
    const b64 = exportTablouImage(events, kind as ImageKind, st as TablouStyle);
    return [{ uri: await writeBase64(stampName(kind, '_tablou_audio'), b64), ext: kind }];
  };
  const exportAudio = (kind: AudioKind, onProgress?: (p: number) => void) =>
    exportAudioFile(events, kind, engine.current?.getSampleSets(), onProgress);

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const paletteLabel = PALETTES.find(p => p.id === palette)?.label ?? '';
  const mmss = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

  return (
    <>
      <View style={styles.top} onLayout={onLayout}>
        {events.length && !busy ? (
          <Canvas style={StyleSheet.absoluteFill}>
            {scene && scene.arcs.map((a, i) => (
              <Path key={`h${i}`} path={poly(a.points)} style="stroke" strokeCap="round"
                strokeWidth={a.strokeWidth * 1.35} color={`rgba(255,255,255,${0.18 * a.alpha})`} />
            ))}
            {scene && scene.arcs.map((a, i) => (
              <Path key={`a${i}`} path={poly(a.points)} style="stroke" strokeCap="round"
                strokeWidth={a.strokeWidth} color={rgbToCss(a.color, a.alpha)} />
            ))}
            {scene && scene.nodes.map((n, i) => (
              <Circle key={`c${i}`} cx={n.x} cy={n.y} r={n.radius} color={rgbToCss(n.color, n.alpha)} />
            ))}
            {dots && dots.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={d.r} color={rgbToCss(d.color, DOT_OPACITY)} />
            ))}
          </Canvas>
        ) : (
          <Pressable style={styles.empty} onPress={choose} disabled={!!busy}>
            {busy ? (
              <>
                <ActivityIndicator color="#ffd700" />
                <Text style={styles.emptySub}>{busy}</Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>♪</Text>
                <Text style={styles.emptyTxt}>Încarcă un fișier audio (WAV sau MP3)</Text>
                <Text style={styles.emptySub}>Notele lui devin puncte de culoare – floarea-soarelui sau spirală.</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.controls}>
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
          {modeSwitch}
          <View style={styles.row}>
            <Btn label={events.length ? 'Alt fișier audio' : 'Alege fișier audio'} onPress={choose} disabled={!!busy} />
            <Btn label={playing ? '■ Oprește' : '▶ Ascultă notele'} onPress={play} disabled={!events.length || !!busy} />
            <Btn label="Salvează tabloul" onPress={() => { stop(); setSaveOpen(true); }} disabled={!events.length || !!busy} main />
          </View>

          <Text style={styles.label}>Modelul imaginii</Text>
          <View style={styles.row}>
            {TABLOU_STYLES.map(s => (
              <Pressable key={s.id} onPress={() => setStyle(s.id)} style={[styles.chip, style === s.id && styles.chipOn]}>
                <Text style={[styles.chipTxt, style === s.id && styles.chipTxtOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.info}>
            {events.length
              ? `${fileName}${seconds ? ` · ${mmss} min` : ''} → ${events.length} note · paleta ${paletteLabel} · ${instrumentById(instrument).label}`
              : 'Alege un fișier audio. Merge cel mai bine cu o singură voce sau un singur instrument.'}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <InstrumentBar selected={instrument} onSelect={onInstrumentChange} />
      </View>

      <SaveSheet
        visible={saveOpen}
        title="Salvează tabloul din audio"
        subtitle={`${events.length} note · paleta ${paletteLabel}`}
        imageLabel="Tabloul"
        imageKinds={KINDS}
        imageStyles={TABLOU_STYLES}
        imageStyle={style}
        onImageStyleChange={(id) => setStyle(id as TablouStyle)}
        exportImage={exportImage}
        exportAudio={exportAudio}
        onClose={() => setSaveOpen(false)}
      />
    </>
  );
}

function Btn({ label, onPress, disabled, main }: { label: string; onPress: () => void; disabled?: boolean; main?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.btn, main && styles.btnMain, disabled && styles.off]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.btnTxt, main && styles.btnMainTxt]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flex: 1, backgroundColor: '#0e0e12' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333' },
  controls: { flex: 1, flexDirection: 'row', backgroundColor: '#181822', paddingLeft: 12 },
  panelScroll: { flex: 1 },
  panel: { paddingVertical: 10, paddingRight: 8, gap: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  label: { color: '#8a8a99', fontSize: 11, fontWeight: '700', marginTop: 8 },
  info: { color: '#c9c9d6', fontSize: 12, marginTop: 10 },
  error: { color: '#ff7a6b', fontSize: 12 },
  btn: { flex: 1, minWidth: 80, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ffd700', alignItems: 'center', paddingHorizontal: 4 },
  btnMain: { backgroundColor: '#ffd700' },
  btnTxt: { color: '#ffd700', fontSize: 13, fontWeight: '700' },
  btnMainTxt: { color: '#111' },
  off: { opacity: 0.35 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#44445a' },
  chipOn: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  chipTxt: { color: '#c9c9d6', fontSize: 12, fontWeight: '700' },
  chipTxtOn: { color: '#111' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyIcon: { color: '#ffd700', fontSize: 40, fontWeight: '300' },
  emptyTxt: { color: '#e6e6ee', fontSize: 15, fontWeight: '700' },
  emptySub: { color: '#8a8a99', fontSize: 12, textAlign: 'center' },
});
