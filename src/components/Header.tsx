// Bara de sus, discretă: numele aplicației + producătorul și selectorul de nivel (N1/N2/N3).
// Deocamdată toate nivelurile sunt deblocate (test, fără plată).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export type Level = 1 | 2 | 3;
const LEVELS: Level[] = [1, 2, 3];

interface Props {
  level: Level;
  instrument?: string;
  onLevelChange: (l: Level) => void;
}

export function Header({ level, instrument, onLevelChange }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        {'Music&Color '}<Text style={styles.maker}>· TSkyes</Text>
      </Text>
      {!!instrument && <Text style={styles.instr}>♪ {instrument}</Text>}
      <View style={styles.levels}>
        {LEVELS.map(l => (
          <Pressable key={l} onPress={() => onLevelChange(l)} hitSlop={6} style={[styles.lvl, l === level && styles.lvlOn]}>
            <Text style={[styles.lvlTxt, l === level && styles.lvlTxtOn]}>N{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, backgroundColor: '#0e0e12',
  },
  title: { color: '#ffd700', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  maker: { color: '#8a8a99', fontWeight: '500' },
  instr: { color: '#c9c9d6', fontSize: 10, fontWeight: '600' },
  levels: { flexDirection: 'row', gap: 4 },
  lvl: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, borderWidth: 1, borderColor: '#33334a' },
  lvlOn: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  lvlTxt: { color: '#8a8a99', fontSize: 10, fontWeight: '700' },
  lvlTxtOn: { color: '#111' },
});
