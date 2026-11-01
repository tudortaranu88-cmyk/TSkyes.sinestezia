// NIVEL 2 – încarci o imagine (JPEG / PNG); aplicația o citește pe spirală, din centru spre margini,
// transformă culorile în melodie (cu instrumentul ales din dreapta), o redă – opțional cu un ritm
// de tobe – și generează partitura A4 și fișierul audio.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, LayoutChangeEvent } from 'react-native';
import { Canvas, Image as SkiaImage, Path, Circle, Skia } from '@shopify/react-native-skia';
import { InstrumentBar } from '../components/InstrumentBar';
import { SaveSheet, type ExportedFile } from '../components/SaveSheet';
import { readingCells, sampleColors, buildMelody, melodyBeats, type ReadPath, type MelodyNote } from '../core/imageMelody';
import { layoutScore } from '../core/scoreLayout';
import { midiName, rgbToCss } from '../core/golden';
import { instrumentById } from '../core/instruments';
import { DRUM_PATTERNS, type DrumId } from '../core/drums';
import { renderLevel2Mix } from '../core/level2Mix';
import { renderScorePage, type ScoreKind } from '../render/scoreImage';
import { exportMixFile, type AudioKind } from '../io/exportComposition';
import { stampName, writeBase64 } from '../io/files';
import { pickImage, type ImageSource } from '../io/imageSource';
import type { AudioEngine } from '../audio/AudioEngine';

const TEMPOS = [85, 105, 158, 160];
const DEFAULT_TEMPO = 105;
const DENSITIES = [128, 256, 512];
const SCORE_KINDS = [{ id: 'png', label: 'PNG' }, { id: 'jpeg', label: 'JPEG' }];
const LEAD_IN = 0.1; // secunde înainte de prima notă (ca în mix)

interface Props {
  engine: React.RefObject<AudioEngine | null>;
  instrument: string;
  onInstrumentChange: (id: string) => void;
  injected?: ImageSource | null;
}

export function Level2({ engine, instrument, onInstrumentChange, injected }: Props) {
  const [src, setSrc] = useState<ImageSource | null>(null);
  const [path, setPath] = useState<ReadPath>('spirala');
  const [density, setDensity] = useState(256);
  const [tempo, setTempo] = useState(DEFAULT_TEMPO);
  const [drum, setDrum] = useState<DrumId | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playIdx, setPlayIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const stopper = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (injected) setSrc(injected); }, [injected]);

  const cells = useMemo(() => (src ? readingCells(src.width, src.height, density, path) : []), [src, density, path]);
  const melody = useMemo(() => (src ? buildMelody(sampleColors(src.rgba, src.width, src.height, cells)) : []), [src, cells]);
  const seconds = (melodyBeats(melody) * 60) / tempo;

  // ----- redare: fragmentul întreg se randează o dată și se redă; indicatorul urmărește timpul -----
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stopper.current?.();
    stopper.current = null;
    setPlaying(false);
    setPlayIdx(-1);
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => { stop(); }, [melody, instrument, tempo, drum, stop]);

  const play = useCallback(async () => {
    const eng = engine.current;
    if (!eng || !melody.length || preparing) return;
    stop();
    setPreparing(true);
    try {
      const state = await eng.ensureRunning();
      const sr = eng.sampleRate;
      const mix = renderLevel2Mix(melody, tempo, instrument, drum, sr, eng.getSampleSets());
      const totalSec = mix.length / sr;
      const beat = 60 / tempo;
      const t0 = Date.now();
      stopper.current = eng.playPCM(mix, sr);
      setPlaying(true);
      console.log(`AUDIOPROBE l2 state=${state} sr=${sr} secunde=${totalSec.toFixed(1)} ritm=${drum ?? 'fara'}`);
      setTimeout(() => console.log(`AUDIOPROBE l2 peak=${eng.peak().toFixed(4)}`), 700);
      let cur = 0;
      timer.current = setInterval(() => {
        const el = (Date.now() - t0) / 1000;
        if (el > totalSec) { stop(); return; }
        while (cur + 1 < melody.length && LEAD_IN + melody[cur + 1].startBeat * beat <= el) cur++;
        setPlayIdx(cur);
      }, 50);
    } catch (e: any) {
      setError(`Redarea nu a pornit: ${e?.message ?? e}`);
      stop();
    } finally {
      setPreparing(false);
    }
  }, [engine, melody, preparing, stop, tempo, instrument, drum]);

  const choose = useCallback(async () => {
    stop();
    setError(null);
    setLoading(true);
    try {
      const s = await pickImage();
      if (s) setSrc(s);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [stop]);

  // ----- export: partitura și audio, din același mix ca redarea -----
  const meta = () => ({
    title: 'Music&Color',
    subtitle: `Melodie din imagine · ${new Date().toLocaleDateString('ro-RO')}`,
    instrument: instrumentById(instrument).label + (drum ? ` · ritm ${DRUM_PATTERNS.find(p => p.id === drum)?.label}` : ''),
    bpm: tempo,
  });
  const exportScore = async (kind: string): Promise<ExportedFile[]> => {
    const pages = layoutScore(melody, meta());
    const out: ExportedFile[] = [];
    for (let i = 0; i < pages.length; i++) {
      const b64 = renderScorePage(pages[i], kind as ScoreKind);
      const suffix = pages.length > 1 ? `_partitura_p${i + 1}` : '_partitura';
      out.push({ uri: await writeBase64(stampName(kind, suffix), b64), ext: kind });
    }
    return out;
  };
  const exportAudio = async (kind: AudioKind, onProgress?: (p: number) => void) =>
    exportMixFile(renderLevel2Mix(melody, tempo, instrument, drum, 44100, engine.current?.getSampleSets()), kind, onProgress);

  // ----- desen -----
  const fit = useMemo(() => {
    if (!src || !box.w) return null;
    const s = Math.min(box.w / src.width, box.h / src.height);
    return { s, ox: (box.w - src.width * s) / 2, oy: (box.h - src.height * s) / 2 };
  }, [src, box]);

  const pathLine = useMemo(() => {
    if (!fit || !cells.length) return null;
    const p = Skia.Path.Make();
    cells.forEach((c, i) => (i ? p.lineTo(fit.ox + c.x * fit.s, fit.oy + c.y * fit.s) : p.moveTo(fit.ox + c.x * fit.s, fit.oy + c.y * fit.s)));
    return p;
  }, [cells, fit]);

  const current = playing && playIdx >= 0 ? melody[playIdx] : null;
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const drumLabel = drum ? DRUM_PATTERNS.find(p => p.id === drum)?.label : null;

  return (
    <>
      <View style={styles.top} onLayout={onLayout}>
        {src && fit ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <SkiaImage image={src.image} x={fit.ox} y={fit.oy} width={src.width * fit.s} height={src.height * fit.s} fit="fill" />
            {pathLine && <Path path={pathLine} style="stroke" strokeWidth={1} color="rgba(255,215,0,0.55)" />}
            {current && current.cells.map(ci => (
              <Circle key={ci} cx={fit.ox + cells[ci].x * fit.s} cy={fit.oy + cells[ci].y * fit.s}
                r={Math.max(5, cells[ci].r * fit.s * 1.3)} style="stroke" strokeWidth={3} color="#ffffff" />
            ))}
            {current && current.cells.map(ci => (
              <Circle key={`f${ci}`} cx={fit.ox + cells[ci].x * fit.s} cy={fit.oy + cells[ci].y * fit.s}
                r={Math.max(4, cells[ci].r * fit.s)} color={rgbToCss(current.color)} />
            ))}
          </Canvas>
        ) : (
          <Pressable style={styles.empty} onPress={choose}>
            {loading ? <ActivityIndicator color="#ffd700" /> : (
              <>
                <Text style={styles.emptyIcon}>＋</Text>
                <Text style={styles.emptyTxt}>Încarcă o imagine (JPEG sau PNG)</Text>
                <Text style={styles.emptySub}>Culorile ei, citite pe spirală din centru spre margini, devin melodie.</Text>
              </>
            )}
          </Pressable>
        )}
        {current && (
          <View style={styles.nowPlaying}>
            <Text style={styles.nowTxt}>{playIdx + 1} / {melody.length} · {midiName(current.midi)}</Text>
          </View>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.controls}>
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
          <View style={styles.row}>
            <Btn label={src ? 'Altă imagine' : 'Alege imagine'} onPress={choose} disabled={loading} />
            <Btn
              label={playing ? '■ Oprește' : preparing ? 'Se pregătește…' : '▶ Ascultă'}
              onPress={playing ? stop : play}
              disabled={!melody.length || preparing}
              main
            />
            <Btn label="Salvează" onPress={() => { stop(); setSaveOpen(true); }} disabled={!melody.length} />
          </View>

          <Text style={styles.label}>Traseul de citire</Text>
          <View style={styles.row}>
            <Chip label="Spirală continuă" on={path === 'spirala'} onPress={() => setPath('spirala')} />
            <Chip label="Floarea-soarelui (φ)" on={path === 'floare'} onPress={() => setPath('floare')} />
          </View>

          <Text style={styles.label}>Ritm (se aude la redare și la export)</Text>
          <View style={styles.row}>
            {DRUM_PATTERNS.map(p => (
              <Chip key={p.id} label={p.label} on={drum === p.id} onPress={() => setDrum(drum === p.id ? null : p.id)} />
            ))}
          </View>

          <Text style={styles.label}>Tempo (♩ = bătăi pe minut)</Text>
          <View style={styles.row}>
            {TEMPOS.map(t => <Chip key={t} label={String(t)} on={tempo === t} onPress={() => setTempo(t)} />)}
          </View>

          <Text style={styles.label}>Celule (cât de fină e citirea)</Text>
          <View style={styles.row}>
            {DENSITIES.map(d => <Chip key={d} label={String(d)} on={density === d} onPress={() => setDensity(d)} />)}
          </View>

          <Text style={styles.info}>
            {melody.length
              ? `${melody.length} note · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} min · ♩ = ${tempo} · ${instrumentById(instrument).label}${drumLabel ? ' · ' + drumLabel : ''}`
              : 'Alege o imagine pentru a genera melodia.'}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <InstrumentBar selected={instrument} onSelect={onInstrumentChange} />
      </View>

      <SaveSheet
        visible={saveOpen}
        title="Salvează melodia din imagine"
        subtitle={`${melody.length} note · ♩ = ${tempo} · ${instrumentById(instrument).label}${drumLabel ? ' · ' + drumLabel : ''}`}
        imageLabel="Partitura (A4)"
        imageKinds={SCORE_KINDS}
        exportImage={exportScore}
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

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text numberOfLines={1} style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
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
  nowPlaying: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(14,14,18,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  nowTxt: { color: '#ffd700', fontSize: 12, fontWeight: '700' },
});
