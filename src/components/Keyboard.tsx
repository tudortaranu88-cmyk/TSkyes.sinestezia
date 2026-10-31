// Jumătatea inferioară: 8 butoane colorate (Do3..Do4) pe rândul curent al matricei (-10..+10).
// Apăsare = noteOn + eveniment către vizualizator; eliberare = noteOff + durata finală.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { NOTES, ROW_MIN, ROW_MAX, cellColor, rgbToCss, textColorFor } from '../core/golden';

interface Props {
  row: number;
  onRowChange: (row: number) => void;
  onPressIn: (col: number) => void;
  onPressOut: (col: number) => void;
}

export function Keyboard({ row, onRowChange, onPressIn, onPressOut }: Props) {
  const rowLabel = row > 0 ? `+${row}` : `${row}`;
  return (
    <View style={styles.root}>
      <View style={styles.rowBar}>
        <Pressable style={styles.step} onPress={() => onRowChange(Math.max(ROW_MIN, row - 1))}><Text style={styles.stepTxt}>−</Text></Pressable>
        <Text style={styles.rowTxt}>Rând {rowLabel}</Text>
        <Pressable style={styles.step} onPress={() => onRowChange(Math.min(ROW_MAX, row + 1))}><Text style={styles.stepTxt}>+</Text></Pressable>
      </View>
      <View style={styles.grid}>
        {NOTES.map((name, c) => {
          const color = cellColor(c, row);
          return (
            <Pressable
              key={name}
              onPressIn={() => onPressIn(c)}
              onPressOut={() => onPressOut(c)}
              style={({ pressed }) => [styles.key, { backgroundColor: rgbToCss(color), transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Text style={[styles.keyTxt, { color: textColorFor(color) }]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181822', padding: 10 },
  rowBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 6 },
  step: { paddingHorizontal: 18, paddingVertical: 4 },
  stepTxt: { color: '#ffd700', fontSize: 22, fontWeight: '700' },
  rowTxt: { color: '#ffd700', fontSize: 16, fontWeight: '700', minWidth: 80, textAlign: 'center' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'stretch', gap: 10 },
  key: { width: '22.5%', flexGrow: 1, height: '47%', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  keyTxt: { fontSize: 15, fontWeight: '700' },
});
