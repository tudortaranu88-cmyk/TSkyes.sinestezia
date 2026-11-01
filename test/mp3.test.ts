// Rulează în CI (necesită dependențele instalate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMp3 } from '../src/audio/mp3';

test('MP3: cadre valide (sync 0xFFE)', () => {
  const sr = 44100, s = new Float32Array(sr).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));
  const mp3 = encodeMp3(s, sr);
  assert.ok(mp3.length > 10000 && mp3.length < 30000, `dimensiune ${mp3.length}`);
  let i = 0; while (i < mp3.length - 1 && !(mp3[i] === 0xff && (mp3[i + 1] & 0xe0) === 0xe0)) i++;
  assert.ok(i < 2000, 'antet de cadru MP3 găsit');
});
