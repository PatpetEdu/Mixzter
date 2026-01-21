# Musikquiz Web Spectator

En React-app för att se spektator-vy av musikquiz-spel via token-baserad autentisering.

## Hur det fungerar

1. **QR-kod från app**: Värd skannar en QR-kod från musikquiz-appen
2. **URL med token**: QR-koden pekar på denna webb-app med `gameId` och `token` som URL-parametrar
3. **Realtidsdata**: Webb-sidan ansluter till Firestore och visar speldata i realtid

## Exempel-URL

```
https://musikquiz.web.app/?gameId=ABC123&token=abc123def456...
```

## Installation

```bash
npm install
```

## Utveckling

```bash
npm run dev
```

Öppnar `http://localhost:5173` (eller annan port) med hot-reload.

## Build för produktion

```bash
npm run build
```

Genererar en `dist/`-mapp som kan deployas till Firebase Hosting.

## Deployment till Firebase Hosting

```bash
# Från root av musikquiz-projektet
firebase deploy --only hosting:web-spektator
```

(Kräver konfiguration i `firebase.json`)

## Struktur

- `src/App.tsx` - Huvudapp, läser URL-parametrar
- `src/SpectatorView.tsx` - Spektator-vy-komponent
- `src/firebase.ts` - Firebase-initialisering
- `src/types.ts` - TypeScript-typer

## Security

- Token skickas via URL (inte i headers)
- Firestore Security Rules validerar token för varje läsning
- Ingen skrivåtkomst för web-spektatorer
