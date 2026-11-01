// Biblioteca de instrumente cu ascundere automată.
// Pe marginea din dreapta stă doar o săgeată mică; atingerea ei deschide panoul cu instrumente
// (de sus în jos). Alegerea unui instrument – sau o atingere în afara panoului – îl închide la loc.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { INSTRUMENTS } from '../core/instruments';

const PANEL_W = 92;

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

export function InstrumentBar({ selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [open, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_W + 8, 0] });

  return (
    <>
      <Pressable style={styles.tab} onPress={() => setOpen(o => !o)} hitSlop={{ left: 10, top: 20, bottom: 20 }}>
        <View style={styles.tabInner}>
          <Text style={styles.arrow}>{open ? '›' : '‹'}</Text>
        </View>
      </Pressable>

      <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <Animated.View style={[styles.panel, { transform: [{ translateX }], opacity: anim }]}>
          {INSTRUMENTS.map(ins => {
            const on = ins.id === selected;
            return (
              <Pressable
                key={ins.id}
                onPress={() => { onSelect(ins.id); setOpen(false); }}
                style={[styles.btn, on && styles.btnOn]}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.txt, on && styles.txtOn]}>{ins.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tab: { width: 14, justifyContent: 'center', alignItems: 'flex-end' },
  tabInner: {
    width: 12, height: 52, borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  arrow: { color: '#ffd700', fontSize: 16, fontWeight: '800', marginTop: -2 },
  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: PANEL_W, padding: 5, gap: 3,
    backgroundColor: 'rgba(18,18,26,0.97)', borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
    borderLeftWidth: 1, borderColor: '#33334a',
  },
  btn: {
    flex: 1, borderRadius: 6, borderWidth: 1, borderColor: '#33334a',
    backgroundColor: '#20202c', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  btnOn: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  txt: { color: '#c9c9d6', fontSize: 12, fontWeight: '600' },
  txtOn: { color: '#111', fontWeight: '800' },
});
