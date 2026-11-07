// Poarta de acces: la fiecare pornire, aplicația cere un cod secret (verificat pe server, NU în APK)
// și apoi un cod de 6 cifre trimis pe mail. Abia după ambele se deblochează, pentru acea sesiune.
//
// Serverul (Google Apps Script sau Cloudflare Worker) expune un singur punct, cu două acțiuni:
//   { action: 'request', code }              → { ok, requestId }   (verifică codul, trimite mailul)
//   { action: 'verify', requestId, otp }     → { ok }              (verifică codul din mail)
//
// Configurare prin variabile de build (expo le include la compilare):
//   EXPO_PUBLIC_GATE_URL     – adresa serverului; GOL ⇒ poarta e dezactivată (aplicația pornește liber)
//   EXPO_PUBLIC_DISABLE_LOCK – '1' dezactivează poarta (folosit la testele automate din CI)

const GATE_URL = (process.env.EXPO_PUBLIC_GATE_URL ?? '').trim();
const DISABLED = process.env.EXPO_PUBLIC_DISABLE_LOCK === '1';

/** Poarta e activă doar dacă avem o adresă de server și nu e dezactivată explicit. */
export const gateEnabled = GATE_URL.length > 0 && !DISABLED;

export interface RequestResult { ok: boolean; requestId?: string; error?: string }
export interface VerifyResult { ok: boolean; error?: string }

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(GATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server ${res.status}`);
  return (await res.json()) as T;
}

/** Trimite codul secret spre verificare; la succes, serverul trimite codul de 6 cifre pe mail. */
export function requestAccessCode(code: string): Promise<RequestResult> {
  return call<RequestResult>({ action: 'request', code });
}

/** Verifică codul de 6 cifre primit pe mail. */
export function verifyAccessOtp(requestId: string, otp: string): Promise<VerifyResult> {
  return call<VerifyResult>({ action: 'verify', requestId, otp });
}
