# Match Caching System - Firestore as Single Source of Truth

## Problem
Før dette systemet kunne ulike brukere få **forskjellige odds** for samme kamp, avhengig av når de lastet siden. Dette var urettferdig for tippekonkurransen.

## Løsning
Alle kamper lagres i Firestore første gang de hentes fra API-Football. **Odds fryses permanent** ved første lagring.

## Hvordan det fungerer

### 1. Første lasting (ny kamp)
```
Bruker A laster index → ingen Firestore cache
  ↓
Hent fra API-Football (odds: 2.10)
  ↓
Lagre til Firestore med frosne odds
  ↓
Vis til bruker
```

### 2. Etterfølgende lastinger
```
Bruker B laster index → Firestore cache finnes
  ↓
Last fra Firestore (odds: 2.10) ⚡ RASK!
  ↓
Sjekk om resultater er oppdatert (bakgrunn)
  ↓
Vis til bruker
```

### 3. Oppdatering av resultater
```
Kamp fullført → API har resultater
  ↓
Background update henter nye resultater
  ↓
Oppdater BARE result + completed i Firestore
  ↓
Odds forblir uendret (2.10)
```

## Fordeler

✅ **Like odds for alle** - Rettferdig konkurranse
✅ **Raskere lasting** - Firestore er mye raskere enn API-Football
✅ **Færre API-kall** - Sparer API-quota
✅ **Offline-støtte** - Firestore kan caches lokalt

## Firestore struktur

```javascript
matches/{matchId}
{
  id: 1234,
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  commence_time: "2025-10-30T20:00:00Z",
  league: 39,
  odds: { H: 2.10, U: 3.40, B: 3.20 },  // FROSSET ved første lagring
  result: { home: 2, away: 1 },          // Oppdateres senere
  completed: true,
  createdAt: timestamp,
  lastUpdated: timestamp,
  oddsLockedAt: timestamp                // Når odds ble først lagret
}
```

## Firestore Rules

- **Read**: Alle kan lese
- **Create**: Autentiserte brukere kan opprette nye kamper
- **Update**: Kun result/completed kan endres, ALDRI odds/homeTeam/awayTeam/league

## Vedlikehold

### Slette gamle kamper
```javascript
import { cleanupOldMatches } from './js/utils/matchCache.js';
await cleanupOldMatches(); // Sletter kamper eldre enn 30 dager
```

### Tvinge ny henting fra API
Hvis du vil hente fresh data fra API (f.eks. etter API-oppgradering):
1. Slett dokumentet fra Firestore: `matches/{matchId}`
2. Neste bruker som laster vil hente fra API og lagre på nytt

## Deploy Firestore Rules & Indexes

```bash
# Deploy rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

## Kode-referanse

**Hovedfil**: `js/utils/matchCache.js`

**Funksjoner**:
- `getUpcomingMatchesFromCache()` - Hent kamper fra Firestore
- `saveMatchesToFirestore()` - Lagre nye kamper (fryser odds)
- `updateMatchResults()` - Oppdater kun resultater
- `cleanupOldMatches()` - Rydde gamle kamper

**Brukes i**: `api-service.js::getUpcomingFixtures()`
