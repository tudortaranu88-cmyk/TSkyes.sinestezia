// Ecranul de blocare, afișat la fiecare pornire când poarta de acces e activă.
// Pasul 1: codul secret → serverul trimite un cod de 6 cifre pe mail.
// Pasul 2: codul din mail → deblocare pentru sesiunea curentă.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { requestAccessCode, verifyAccessOtp } from '../auth/accessGate';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [phase, setPhase] = useState<'code' | 'otp'>('code');
  const [code, setCode] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitCode = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await requestAccessCode(code.trim());
      if (!r.ok || !r.requestId) { setErr(r.error ?? 'Cod greșit.'); return; }
      setRequestId(r.requestId);
      setOtp('');
      setPhase('otp');
    } catch {
      setErr('Nu am putut contacta serverul. Verifică internetul și încearcă din nou.');
    } finally { setBusy(false); }
  };

  const submitOtp = async () => {
    if (!otp.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await verifyAccessOtp(requestId, otp.trim());
      if (!r.ok) { setErr(r.error ?? 'Cod de confirmare greșit sau expirat.'); return; }
      onUnlock();
    } catch {
      setErr('Nu am putut contacta serverul. Verifică internetul și încearcă din nou.');
    } finally { setBusy(false); }
  };

  const back = () => { setPhase('code'); setErr(null); setOtp(''); };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.brand}>Music&Color</Text>
        {phase === 'code' ? (
          <>
            <Text style={styles.title}>Acces protejat</Text>
            <Text style={styles.sub}>Introdu codul tău secret pentru a continua.</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Cod secret"
              placeholderTextColor="#6a6a7a"
              secureTextEntry
              autoFocus
              editable={!busy}
              onSubmitEditing={submitCode}
              returnKeyType="go"
            />
            <Pressable style={[styles.btn, (busy || !code.trim()) && styles.btnOff]} onPress={submitCode} disabled={busy || !code.trim()}>
              {busy ? <ActivityIndicator color="#111" /> : <Text style={styles.btnTxt}>Continuă</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Confirmare pe mail</Text>
            <Text style={styles.sub}>Am trimis un cod de 6 cifre pe adresa ta de mail. Introdu-l mai jos.</Text>
            <TextInput
              style={[styles.input, styles.otp]}
              value={otp}
              onChangeText={t => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="______"
              placeholderTextColor="#6a6a7a"
              keyboardType="number-pad"
              autoFocus
              editable={!busy}
              onSubmitEditing={submitOtp}
              returnKeyType="go"
            />
            <Pressable style={[styles.btn, (busy || otp.length < 6) && styles.btnOff]} onPress={submitOtp} disabled={busy || otp.length < 6}>
              {busy ? <ActivityIndicator color="#111" /> : <Text style={styles.btnTxt}>Deblochează</Text>}
            </Pressable>
            <Pressable onPress={back} disabled={busy}><Text style={styles.link}>‹ Înapoi</Text></Pressable>
          </>
        )}
        {err && <Text style={styles.err}>{err}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0e12', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, gap: 12 },
  brand: { color: '#ffd700', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  title: { color: '#e6e6ee', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  sub: { color: '#8a8a99', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  input: {
    backgroundColor: '#1b1b26', borderWidth: 1, borderColor: '#33334a', borderRadius: 10,
    color: '#e6e6ee', fontSize: 18, paddingHorizontal: 14, paddingVertical: 12, textAlign: 'center',
  },
  otp: { letterSpacing: 8, fontSize: 24, fontWeight: '700' },
  btn: { backgroundColor: '#ffd700', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOff: { opacity: 0.4 },
  btnTxt: { color: '#111', fontSize: 15, fontWeight: '800' },
  link: { color: '#ffd700', fontSize: 13, textAlign: 'center', paddingVertical: 6 },
  err: { color: '#ff7a6b', fontSize: 13, textAlign: 'center' },
});
