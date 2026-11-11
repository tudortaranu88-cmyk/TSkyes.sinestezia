// Claviatura: toată Matricea Aurie (rândurile +10..-10), câte 8 butoane (Do3..Do4) pe un singur rând.
// Se văd 7 rânduri odată (+3..-3, cu Rândul 0 la mijloc); restul prin glisare verticală.
// Orice buton vizibil cântă direct: apăsare = noteOn, eliberare = noteOff.

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, LayoutChangeEvent } from 'react-native';
import { NOTES, ROW_MIN, ROW_MAX, cellColor, rgbToCss, textColorFor, noteLabel, type PaletteId } from '../core/golden';

const VISIBLE_ROWS = 7;
const TOP_VISIBLE_ROW = 3; // la pornire, primul rând vizibil este +3

interface Props {
  onPressIn: (col: number, row: number) => void;
  onPressOut: (col: number, row: number) => void;
  palette?: PaletteId;
}

export function Keyboard({ onPressIn, onPressOut, palette = 'aurie' }: Props) {
  const [rowH, setRowH] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const centered = useRef(false);
  const rows = useMemo(() => {
    const r: number[] = [];
    for (let i = ROW_MAX; i >= ROW_MIN; i--) r.push(i);
    return r;
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    // rânduri cu înălțime întreagă (px) → fără rânduri tăiate la margine din cauza rotunjirilor
    const h = Math.floor(e.nativeEvent.layout.height / VISIBLE_ROWS);
    if (h !== rowH) setRowH(h);
  };

  const onContentSize = () => {
    if (centered.current || !rowH) return;
    centered.current = true;
    scroll.current?.scrollTo({ y: (ROW_MAX - TOP_VISIBLE_ROW) * rowH, animated: false });
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      {rowH > 0 && (
        <ScrollView
          ref={scroll}
          style={{ height: rowH * VISIBLE_ROWS, flexGrow: 0 }}
          showsVerticalScrollIndicator={false}
          snapToInterval={rowH}
          decelerationRate="fast"
          onContentSizeChange={onContentSize}
        >
          {rows.map(row => (
            <View key={row} style={[styles.row, { height: rowH }, row === 0 && styles.rowZero]}>
              <Text style={[styles.rowLabel, row === 0 && styles.rowLabelZero]}>
                {row > 0 ? `+${row}` : `${row}`}
              </Text>
              {NOTES.map((_name, c) => {
                const color = cellColor(c, row, palette);
                return (
                  <Pressable
                    key={c}
                    onPressIn={() => onPressIn(c, row)}
                    onPressOut={() => onPressOut(c, row)}
                    style={({ pressed }) => [
                      styles.key,
                      { backgroundColor: rgbToCss(color), transform: [{ scale: pressed ? 0.92 : 1 }] },
                    ]}
                  >
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.keyTxt, { color: textColorFor(color) }]}>
                      {noteLabel(c, row)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 3, gap: 3 },
  rowZero: { backgroundColor: 'rgba(255,215,0,0.08)' },
  rowLabel: { width: 24, color: '#8a8a99', fontSize: 10, fontWeight: '700', textAlign: 'center', textAlignVertical: 'center' },
  rowLabelZero: { color: '#ffd700' },
  key: { flex: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 },
  keyTxt: { fontSize: 11, fontWeight: '700' },
});
