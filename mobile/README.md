# Camille Mobile

App mobile (Expo / React Native) de suivi des agents IA Camille pour les clients.
Reprend le design fourni : cartes sombres, accent vert citron, jauge, bar chart, onglets et bottom-nav.

## Écrans
- **Dashboard** — performance des agents (bar chart) + jauge de volume (messages traités) et répartition (contacts / leads / escalades / tokens).
- **Agents** — bandeau « agents en ligne », vue d'ensemble (taux de réponse, conversion, latence), top agent, liste des agents.
- **Conversations** — suivi des conversations/leads par onglets (En cours / Leads / Terminées), cartes de suivi.
- **Login** — connexion à l'API Camille (`/api/auth/login`), token stocké localement. Mode démo disponible sans connexion.

## Données
L'app consomme l'API Next.js existante :
- `POST /api/auth/login` → `{ token }` (Bearer)
- `GET /api/stats?period=30d`
- `GET /api/agents`

URL de l'API : champ `expo.extra.apiBaseUrl` dans `app.json`
(défaut : `https://camille.vps.buyticle.com`).

## Lancer en local
```bash
cd mobile
npm install
npx expo start        # puis 'a' pour Android, ou scanner le QR avec Expo Go
```

## Build de l'APK
Automatique via GitHub Actions : `.github/workflows/build-mobile.yml`
(déclenchement manuel *Run workflow* ou push sur la branche).
L'APK signé (debug-key, installable directement) est publié en **artifact** `camille-mobile-apk`.

## Build iOS (pour tester sur appetize.io)
Workflow `.github/workflows/build-ios.yml` : build **simulateur iOS non signé**
(aucun compte Apple requis), publié en artifact `camille-mobile-ios-sim` (un `.zip`
contenant `Camille.app`). Décompresse-le et **upload le `.app` sur appetize.io**
(plateforme iOS) pour tester — c'est le même flux que l'APK Android.

> Pour installer sur un **vrai iPhone**, il faut une signature Apple
> (compte Apple Developer 99 $/an) + TestFlight. Le build simulateur ne
> s'installe pas sur un appareil physique — uniquement simulateur / appetize.

## Build Android local équivalent :
```bash
cd mobile
npm install
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```
