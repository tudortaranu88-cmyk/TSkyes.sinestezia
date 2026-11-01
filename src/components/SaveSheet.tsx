// Panoul „Salvează”: o imagine (spirala – Nivel 1, partitura – Nivel 2) și melodia (MP3 / WAV / AAC),
// fiecare cu „Salvează în telefon” și „Partajează” (WhatsApp, e-mail…).
// Exportul imaginii poate produce mai multe fișiere (paginile partiturii): toate se salvează,
// iar la partajare se deschide meniul pentru fiecare pagină, pe rând.

import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { AudioKind } from '../io/exportComposition';
import { saveToDevice, shareFile, MIME } from '../io/files';

export interface ExportedFile { uri: string; ext: string }

interface Props {
  visible: boolean;
  title?: string;
  subtitle: string;
  imageLabel: string;
  imageKinds: { id: string; label: string }[];
  exportImage: (kind: string) => Promise<ExportedFile[]>;
  exportAudio: (kind: AudioKind, onProgress?: (p: number) => void) => Promise<ExportedFile>;
  onClose: () => void;
}

type Action = 'save' | 'share';

const AUDIO_KINDS: { id: AudioKind; label: string }[] = [
  { id: 'mp3', label: 'MP3' }, { id: 'wav', label: 'WAV' }, { id: 'aac', label: 'AAC' },
];

export function SaveSheet({ visible, title = 'Salvează', subtitle, imageLabel, imageKinds, exportImage, exportAudio, onClose }: Props) {
  const [imgKind, setImgKind] = useState<string>(imageKinds[0]?.id ?? 'png');
  const [audKind, setAudKind] = useState<AudioKind>('mp3');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const run = async (what: 'image' | 'audio', action: Action) => {
    setBusy(true);
    setMsg({ text: what === 'image' ? 'Se generează imaginea…' : 'Se generează melodia…', ok: true });
    await new Promise(r => setTimeout(r, 30)); // lasă indicatorul să apară înainte de calcul
    try {
      const progress = (p: number) => setMsg({ text: `Se codează ${audKind.toUpperCase()}… ${Math.round(p * 100)}%`, ok: true });
      const files = what === 'image' ? await exportImage(imgKind) : [await exportAudio(audKind, progress)];
      if (action === 'save') {
        for (const f of files) await saveToDevice(f.uri);
        setMsg({
          text: what === 'audio' ? 'Melodia a fost salvată în telefon (Muzică).'
            : files.length > 1 ? `${files.length} pagini au fost salvate în galerie.` : 'Imaginea a fost salvată în galerie.',
          ok: true,
        });
      } else {
        for (const f of files) await shareFile(f.uri, MIME[f.ext]);
        setMsg(null);
      }
    } catch (e: any) {
      setMsg({ text: `Nu a reușit: ${e?.message ?? e}`, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const Chips = <T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
    <View style={styles.chips}>
      {items.map(it => (
        <Pressable key={it.id} onPress={() => onChange(it.id)} disabled={busy}
          style={[styles.chip, value === it.id && styles.chipOn]}>
          <Text style={[styles.chipTxt, value === it.id && styles.chipTxtOn]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const Actions = ({ what }: { what: 'image' | 'audio' }) => (
    <View style={styles.actions}>
      <Pressable disabled={busy} onPress={() => run(what, 'save')} style={[styles.btn, styles.btnMain, busy && styles.off]}>
        <Text style={styles.btnMainTxt}>Salvează în telefon</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => run(what, 'share')} style={[styles.btn, busy && styles.off]}>
        <Text style={styles.btnTxt}>Partajează</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} disabled={busy} hitSlop={10}><Text style={styles.close}>✕</Text></Pressable>
        </View>
        <Text style={styles.sub}>{subtitle}</Text>

        <Text style={styles.section}>{imageLabel}</Text>
        <Chips items={imageKinds} value={imgKind} onChange={setImgKind} />
        <Actions what="image" />

        <Text style={styles.section}>Melodia</Text>
        <Chips items={AUDIO_KINDS} value={audKind} onChange={setAudKind} />
        <Actions what="audio" />

        <View style={styles.status}>
          {busy && <ActivityIndicator color="#ffd700" />}
          {msg && <Text style={[styles.msg, !msg.ok && styles.msgErr]}>{msg.text}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#181822', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 28, borderTopWidth: 1, borderColor: '#33334a',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ffd700', fontSize: 16, fontWeight: '700' },
  close: { color: '#8a8a99', fontSize: 18 },
  sub: { color: '#8a8a99', fontSize: 12, marginTop: 2 },
  section: { color: '#e6e6ee', fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#44445a' },
  chipOn: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  chipTxt: { color: '#c9c9d6', fontSize: 12, fontWeight: '700' },
  chipTxtOn: { color: '#111' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ffd700', alignItems: 'center' },
  btnMain: { backgroundColor: '#ffd700' },
  btnTxt: { color: '#ffd700', fontSize: 13, fontWeight: '700' },
  btnMainTxt: { color: '#111', fontSize: 13, fontWeight: '700' },
  off: { opacity: 0.4 },
  status: { minHeight: 36, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  msg: { color: '#c9c9d6', fontSize: 12, flex: 1 },
  msgErr: { color: '#ff7a6b' },
});
