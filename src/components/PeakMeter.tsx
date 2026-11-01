// Indicator de test (versiunea de verificare): arată nivelul de semnal de la ieșirea audio, ca să
// putem vedea de pe telefon dacă motorul produce sunet. Se scoate după diagnostic.

import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { AudioEngine } from '../audio/AudioEngine';

export function PeakMeter({ engine }: { engine: React.RefObject<AudioEngine | null> }) {
  const [peak, setPeak] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const p = engine.current?.peak() ?? -1;
      setPeak(p);
    }, 250);
    return () => clearInterval(id);
  }, [engine]);
  if (peak === null) return null;
  return <Text style={styles.txt}>nivel {peak < 0 ? 'n/a' : peak.toFixed(3)}</Text>;
}

const styles = StyleSheet.create({
  txt: { color: '#ff7a6b', fontSize: 9, fontWeight: '700' },
});
