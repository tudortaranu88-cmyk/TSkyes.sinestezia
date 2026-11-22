// Zonă în care se pot trage fișiere din Windows Explorer (drag and drop). Cât timp fișierele sunt
// deasupra ei apare un chenar auriu cu `label`; la eliberare primește lista de fișiere.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  onFiles: (files: File[]) => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function DropZone({ onFiles, label, style, children }: Props) {
  const ref = useRef<any>(null);
  const cb = useRef(onFiles);
  cb.current = onFiles;
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (!el || typeof el.addEventListener !== 'function') return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setOver(true); };
    const move = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) cb.current(files);
    };
    el.addEventListener('dragenter', enter);
    el.addEventListener('dragover', move);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragenter', enter);
      el.removeEventListener('dragover', move);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <View ref={ref} style={[styles.root, style]}>
      {children}
      {over && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.txt}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject, margin: 8, borderRadius: 14, borderWidth: 3, borderStyle: 'dashed',
    borderColor: '#ffd700', backgroundColor: 'rgba(14,14,18,0.82)', alignItems: 'center', justifyContent: 'center',
  },
  txt: { color: '#ffd700', fontSize: 20, fontWeight: '800', textAlign: 'center', paddingHorizontal: 24 },
});
