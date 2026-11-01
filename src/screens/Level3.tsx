// NIVEL 3 – încarci una sau mai multe partituri generate de aplicație (PNG/JPEG); aplicația le
// citește banda de culori, reconstruiește melodia și reface tabloul-spirală, pe care îl poți salva
// (PNG/JPEG/TIFF) și, opțional, asculta.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Circle, Skia } from '@shopify/react-native-skia';
import { SaveSheet, type ExportedFile } from '../components/SaveSheet';
import { decodeScores, type ScorePixels } from '../core/scoreDecode';
import { melodyToEvents, melodyBeats, type MelodyNote } from '../core/imageMelody';
import { buildScene } from '../core/scene';
import { rgbToCss } from '../core/golden';
import { renderLevel2Mix } from '../core/level2Mix';
import { exportSpiralImage, type ImageKind } from '../render/exportImage';
import { exportMixFile, type AudioKind } from '../io/exportComposition';
import { stampName, writeBase64 } from '../io/files';
import { pickScoreImages, type ImageSource } from '../io/imageSource';
import type { AudioEngine } from '../audio/AudioEngine';

const KINDS = [{ id: 'png', label: 'PNG' }, { id: 'jpeg', label: 'JPEG' }, { id: 'tiff', label: 'TIFF' }];
const PLAY_BPM = 105;

interface Props {
  engine: React.RefObject<AudioEngine | null>;
  injected?: ScorePixels[] | null;
}

export function Level3({ engine, injected }: Props) {
  const [melody, setMelody] = useState<MelodyNote[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const stopper = useRef<(() => void) | null>(null);

  const decode = useCallback((pages: ScorePixels[]) => {
    setError(null);
    try {
      const m = decodeScores(pages);
      setMelody(m);
      setPageCount(pages.length);
    } catch (e: any) {
      setMelody([]);
      setError(e?.message ?? String(e));
    }
  }, []);

  React.useEffect(() => { if (injected?.length) decode(injected); }, [injected, decode]);

  const choose = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const imgs = await pickScoreImages();
      if (imgs.length) decode(imgs.map((s: ImageSource) => ({ rgba: s.rgba, width: s.width, height: s.height, name: s.name })));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [decode]);

  const events = useMemo(() => melodyToEvents(melody, PLAY_BPM, 'pian', 0), [melody]);

  // tabloul-spirală (doar spirala, ca la export)
  const scene = useMemo(() => {
    if (!box.w || !events.length) return null;
    return buildScene({ width: box.w, height: box.h, events, nowMs: 1e12, insertPhase: 1, pxPerSec: 60, fill: 0.9 });
  }, [box, events]);

  const poly = (pts: { x: number; y: number }[]) => {
    const p = Skia.Path.Make();
    pts.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
    return p;
  };

  const stop = useCallback(() => { stopper.current?.(); stopper.current = null; setPlaying(false); }, []);

  const play = useCallback(async () => {
    const eng = engine.current;
    if (!eng || !melody.length) return;
    if (playing) { stop(); return; }
    await eng.ensureRunning();
    const sr = eng.sampleRate;
    const mix = renderLevel2Mix(melody, PLAY_BPM, 'pian', null, sr, eng.getSampleSets());
    stopper.current = eng.playPCM(mix, sr);
    setPlaying(true);
    setTimeout(() => stop(), (mix.length / sr) * 1000 + 200);
  }, [engine, melody, playing, stop]);

  const exportImage = async (kind: string): Promise<ExportedFile[]> => {
    const b64 = exportSpiralImage(events, kind as ImageKind);
    return [{ uri: await writeBase64(stampName(kind, '_tablou'), b64), ext: kind }];
  };
  const exportAudio = (kind: AudioKind, onProgress?: (p: number) => void) =>
    exportMixFile(renderLevel2Mix(melody, PLAY_BPM, 'pian', null, 44100, engine.current?.getSampleSets()), kind, onProgress);

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const beats = melodyBeats(melody);

  return (
    <>
      <View style={styles.top} onLayout={onLayout}>
        {scene ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <Path path={poly(scene.guide)} style="stroke" strokeWidth={1} color="rgba(255,215,0,0.12)" />
            {scene.arcs.map((a, i) => (
              <Path key={`h${i}`} path={poly(a.points)} style="stroke" strokeCap="round"
                strokeWidth={a.strokeWidth * 1.35} color={`rgba(255,255,255,${0.18 * a.alpha})`} />
            ))}
            {scene.arcs.map((a, i) => (
              <Path key={`a${i}`} path={poly(a.points)} style="stroke" strokeCap="round"
                strokeWidth={a.strokeWidth} color={rgbToCss(a.color, a.alpha)} />
            ))}
            {scene.nodes.map((n, i) => (
              <Circle key={`c${i}`} cx={n.x} cy={n.y} r={n.radius} color={rgbToCss(n.color, n.alpha)} />
            ))}
          </Canvas>
        ) : (
          <Pressable style={styles.empty} onPress={choose}>
            {loading ? <ActivityIndicator color="#ffd700" /> : (
              <>
                <Text style={styles.emptyIcon}>＋</Text>
                <Text style={styles.emptyTxt}>Încarcă una sau mai multe partituri</Text>
                <Text style={styles.emptySub}>Partituri generate de Music&Color (Nivelul 2). Din banda lor de culori se reface tabloul.</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.panel}>
        <View style={styles.row}>
          <Btn label={melody.length ? 'Alte partituri' : 'Alege partituri'} onPress={choose} disabled={loading} />
          <Btn label={playing ? '■ Oprește' : '▶ Ascultă'} onPress={play} disabled={!melody.length} />
          <Btn label="Salvează tabloul" onPress={() => { stop(); setSaveOpen(true); }} disabled={!melody.length} main />
        </View>
        <Text style={styles.info}>
          {melody.length
            ? `${pageCount} ${pageCount === 1 ? 'pagină' : 'pagini'} → ${melody.length} note (${beats} pătrimi) reconstruite`
            : 'Alege partituri generate de aplicație pentru a reface tabloul.'}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <SaveSheet
        visible={saveOpen}
        title="Salvează tabloul"
        subtitle={`${melody.length} note · din ${pageCount} ${pageCount === 1 ? 'pagină' : 'pagini'}`}
        imageLabel="Tabloul (spirala)"
        imageKinds={KINDS}
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
  top: { flex: 3, backgroundColor: '#0e0e12' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333' },
  panel: { backgroundColor: '#181822', padding: 12, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  info: { color: '#c9c9d6', fontSize: 12 },
  error: { color: '#ff7a6b', fontSize: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ffd700', alignItems: 'center', paddingHorizontal: 4 },
  btnMain: { backgroundColor: '#ffd700' },
  btnTxt: { color: '#ffd700', fontSize: 13, fontWeight: '700' },
  btnMainTxt: { color: '#111' },
  off: { opacity: 0.35 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyIcon: { color: '#ffd700', fontSize: 40, fontWeight: '300' },
  emptyTxt: { color: '#e6e6ee', fontSize: 15, fontWeight: '700' },
  emptySub: { color: '#8a8a99', fontSize: 12, textAlign: 'center' },
});
