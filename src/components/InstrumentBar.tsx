// Coloana de instrumente din dreapta, de sus în jos. Instrumentul selectat este evidențiat.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { INSTRUMENTS } from '../core/instruments';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

export function InstrumentBar({ selected, onSelect }: Props) {
  return (
    <View style={styles.root}>
      {INSTRUMENTS.map(ins => {
        const on = ins.id === selected;
        return (
          <Pressable key={ins.id} onPress={() => onSelect(ins.id)} style={[styles.btn, on && styles.btnOn]}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.txt, on && styles.txtOn]}>{ins.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 72, paddingLeft: 6, gap: 3 },
  btn: {
    flex: 1, borderRadius: 6, borderWidth: 1, borderColor: '#33334a',
    backgroundColor: '#20202c', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  btnOn: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  txt: { color: '#c9c9d6', fontSize: 11, fontWeight: '600' },
  txtOn: { color: '#111', fontWeight: '800' },
});
