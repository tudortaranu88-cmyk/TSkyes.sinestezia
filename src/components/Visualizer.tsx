// Jumătatea superioară: portativ + spirala de aur, randate cu Skia.
// Toată geometria vine din buildScene() (src/core/scene.ts) – testată separat.
// Animația rulează la ~60 fps prin requestAnimationFrame pe firul JS; funcțiile din core
// sunt marcate 'worklet', deci pot fi mutate ulterior pe firul UI (Reanimated) fără rescriere.

import React, { useEffect, useMemo, useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Circle, Line, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { buildScene } from '../core/scene';
import { rgbToCss } from '../core/golden';
import type { Point } from '../core/spiral';
import type { NoteEvent } from '../core/types';

const INSERT_MS = 450;   // durata animației de intrare a unei note
const PX_PER_SEC = 60;   // viteza de derulare a portativului

function polyline(points: Point[]) {
  const p = Skia.Path.Make();
  points.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
  return p;
}
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export function Visualizer({ events }: { events: NoteEvent[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let raf = 0;
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const newest = events[events.length - 1];
  const insertPhase = newest ? easeOut(Math.min(1, (now - newest.startMs) / INSERT_MS)) : 1;

  const scene = useMemo(
    () => (size.w ? buildScene({ width: size.w, height: size.h, events, nowMs: now, insertPhase, pxPerSec: PX_PER_SEC }) : null),
    [size, events, now, insertPhase],
  );

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={{ flex: 1, backgroundColor: '#0e0e12' }} onLayout={onLayout}>
      {scene && (
        <Canvas style={{ flex: 1 }}>
          {scene.staffLines.map((y, i) => (
            <Line key={`l${i}`} p1={vec(0, y)} p2={vec(size.w, y)} color="rgba(255,255,255,0.22)" strokeWidth={1} />
          ))}
          {scene.ledgers.map((l, i) => (
            <Line key={`g${i}`} p1={vec(l.x1, l.y)} p2={vec(l.x2, l.y)} color="rgba(255,255,255,0.22)" strokeWidth={1} />
          ))}
          {scene.staffNotes.map((n, i) => (
            <RoundedRect key={`n${i}`} x={n.x} y={n.y - n.h / 2} width={n.w} height={n.h} r={n.h / 2} color={rgbToCss(n.color, n.alpha)} />
          ))}
          <Path path={polyline(scene.guide)} style="stroke" strokeWidth={1} color="rgba(255,215,0,0.12)" />
          {scene.arcs.map((a, i) => (
            <Path key={`h${i}`} path={polyline(a.points)} style="stroke" strokeCap="round"
              strokeWidth={a.strokeWidth * 1.35} color={`rgba(255,255,255,${0.18 * a.alpha})`} />
          ))}
          {scene.arcs.map((a, i) => (
            <Path key={`a${i}`} path={polyline(a.points)} style="stroke" strokeCap="round"
              strokeWidth={a.strokeWidth} color={rgbToCss(a.color, a.alpha)} />
          ))}
          {scene.nodes.map((n, i) => (
            <Circle key={`c${i}`} cx={n.x} cy={n.y} r={n.radius} color={rgbToCss(n.color, n.alpha)} />
          ))}
        </Canvas>
      )}
    </View>
  );
}
