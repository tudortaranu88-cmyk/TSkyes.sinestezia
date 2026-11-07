# Poarta de acces — server pe Google Apps Script

Server gratuit, găzduit de Google, care verifică codul secret și trimite un cod de 6 cifre
pe mail. Folosește contul Google pe care îl ai deja — fără conturi noi, fără card, fără chei.

## Pași (o singură dată, ~5 minute)

1. Intră pe **https://script.google.com** (logat cu iconarmunte@gmail.com) → **New project**.
2. Șterge tot codul din fișierul `Code.gs` și **lipește** conținutul din `Code.gs` de aici.
3. În partea de sus, înlocuiește `SCHIMBA-MA` cu **codul tău secret** (știut doar de tine). Salvează (💾).
4. Sus dreapta: **Deploy → New deployment**.
5. La „Select type” (roata ⚙️) alege **Web app**.
6. Setează:
   - **Execute as:** Me (iconarmunte@gmail.com)
   - **Who has access:** Anyone
7. **Deploy**. Google cere autorizarea (ca să poată trimite mail din Gmail-ul tău):
   - „Authorize access” → alege contul → ecranul „Google hasn't verified this app” →
     **Advanced** → **Go to <numele proiectului> (unsafe)** → **Allow**.
   - (E normal: e propriul tău script, nepublicat în magazin.)
8. Copiază **Web app URL** (se termină în `/exec`) și trimite-mi-l.

Gata. Eu îl pun în aplicație, construiesc un APK cu poarta activă și îl testez.

## Dacă vrei să schimbi codul secret mai târziu
Deschizi proiectul → schimbi `SECRET_CODE` → **Deploy → Manage deployments → Edit (creion) →
Version: New version → Deploy**. Adresa rămâne aceeași.

## Note
- Codul secret stă doar aici, în proiectul tău, nu în aplicație — nu poate fi extras din APK.
- Trimite ~1 mail la fiecare pornire; Gmail gratuit permite ~100 mailuri/zi (destul pentru un singur utilizator).
- Codul de 6 cifre expiră în 10 minute și se poate folosi o singură dată.
