/**
 * Music&Color — poarta de acces (server pe Google Apps Script).
 *
 * Aplicația trimite aici, prin POST, două tipuri de cereri:
 *   { "action": "request", "code": "<cod secret>" }
 *        → dacă codul secret e corect, generează un cod de 6 cifre, îl trimite pe mail
 *          și răspunde { "ok": true, "requestId": "..." }
 *   { "action": "verify", "requestId": "...", "otp": "123456" }
 *        → dacă codul de 6 cifre e corect, răspunde { "ok": true }
 *
 * CODUL SECRET NU SE SCRIE ÎN ACEST FIȘIER. Îl pui o singură dată în:
 *   Project Settings (⚙️) → Script properties → Add script property
 *   Property: SECRET_CODE      Value: codul tău secret
 * Codul rămâne doar în proiectul tău Google și nu ajunge niciodată în aplicație.
 */
const MAIL_TO     = 'iconarmunte@gmail.com';      // adresa pe care primești codul de confirmare

// Reglaje (le poți lăsa așa)
const OTP_TTL_SEC = 600;   // codul de 6 cifre expiră în 10 minute
const MAX_FAILS   = 5;     // câte coduri secrete greșite se acceptă...
const LOCK_MIN    = 15;    // ...înainte de o blocare temporară (minute)
const MAX_OTP_TRY = 5;     // câte încercări la codul de 6 cifre

function getSecret() {
  return PropertiesService.getScriptProperties().getProperty('SECRET_CODE') || '';
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ ok: false, error: 'Cerere goală' });
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'request') return handleRequest(body);
    if (body.action === 'verify') return handleVerify(body);
    return json({ ok: false, error: 'Acțiune necunoscută' });
  } catch (err) {
    return json({ ok: false, error: 'Cerere invalidă' });
  }
}

// Vizitarea adresei în browser arată doar că serverul trăiește (util ca să confirmi publicarea).
function doGet() {
  return json({ ok: true, service: 'Music&Color access gate' });
}

function handleRequest(body) {
  const cache = CacheService.getScriptCache();
  if (cache.get('lock')) return json({ ok: false, error: 'Prea multe încercări. Așteaptă câteva minute.' });

  const secret = getSecret();
  if (!secret) return json({ ok: false, error: 'Serverul nu are încă setat codul secret (SECRET_CODE).' });

  if (String(body.code || '') !== secret) {
    const fails = Number(cache.get('fails') || 0) + 1;
    cache.put('fails', String(fails), LOCK_MIN * 60);
    if (fails >= MAX_FAILS) { cache.put('lock', '1', LOCK_MIN * 60); cache.remove('fails'); }
    return json({ ok: false, error: 'Cod greșit.' });
  }
  cache.remove('fails');

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const requestId = Utilities.getUuid();
  cache.put('otp_' + requestId, otp + '|0', OTP_TTL_SEC);

  MailApp.sendEmail(
    MAIL_TO,
    'Music&Color — cod de acces',
    'Codul tău de acces este: ' + otp + '\n\n' +
    'Expiră în 10 minute. Dacă nu ai cerut tu accesul, ignoră acest mesaj.'
  );
  return json({ ok: true, requestId: requestId });
}

function handleVerify(body) {
  const cache = CacheService.getScriptCache();
  const key = 'otp_' + String(body.requestId || '');
  const stored = cache.get(key);
  if (!stored) return json({ ok: false, error: 'Cod expirat. Cere unul nou.' });

  const parts = stored.split('|');
  const otp = parts[0];
  const tries = Number(parts[1] || 0);
  if (tries >= MAX_OTP_TRY) { cache.remove(key); return json({ ok: false, error: 'Prea multe încercări. Cere un cod nou.' }); }

  if (String(body.otp || '') !== otp) {
    cache.put(key, otp + '|' + (tries + 1), OTP_TTL_SEC);
    return json({ ok: false, error: 'Cod de confirmare greșit.' });
  }
  cache.remove(key);
  return json({ ok: true });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
