# Hvordan legge til nye ligaer

Dette systemet har nå **sentralisert liga-konfigurasjon**! 🎉

Du trenger kun å oppdatere **ÉN fil** for å legge til nye ligaer i hele systemet.

---

## 📝 Steg-for-steg guide

### 1. Finn liga-ID fra API-Football

1. Gå til [API-Football Dashboard](https://dashboard.api-football.com/)
2. Søk etter ligaen du vil legge til (f.eks. "Bundesliga", "Ligue 1", "Eliteserien")
3. Noter liga-ID nummeret (f.eks. Bundesliga = 78, Ligue 1 = 61)

### 2. Åpne `leagues.config.js`

Filen ligger i roten av prosjektet: `/leagues.config.js`

### 3. Legg til ny liga i LEAGUES array

Kopier dette template og fyll inn informasjon:

```javascript
{
    id: 78,              // Liga-ID fra API-Football
    name: 'Bundesliga',  // Kort navn (brukes i UI)
    emoji: '🇩🇪',        // Emoji/flagg for ligaen
    displayName: 'Bundesliga',  // Fullt navn (kan være likt som name)
    enabled: true        // true = aktiv, false = skjul uten å slette
}
```

### 4. Eksempel: Legge til Bundesliga

**FØR:**
```javascript
const LEAGUES = [
    {
        id: 39,
        name: 'Premier League',
        emoji: '⚽',
        displayName: 'Premier League',
        enabled: true
    },
    {
        id: 135,
        name: 'Serie A',
        emoji: '🇮🇹',
        displayName: 'Serie A',
        enabled: true
    }
];
```

**ETTER:**
```javascript
const LEAGUES = [
    {
        id: 39,
        name: 'Premier League',
        emoji: '⚽',
        displayName: 'Premier League',
        enabled: true
    },
    {
        id: 135,
        name: 'Serie A',
        emoji: '🇮🇹',
        displayName: 'Serie A',
        enabled: true
    },
    {
        id: 78,                    // ← NY LIGA
        name: 'Bundesliga',
        emoji: '🇩🇪',
        displayName: 'Bundesliga',
        enabled: true
    }
];
```

### 5. Lagre filen

**Det er alt!** 🎉

Systemet vil automatisk:
- ✅ Laste kamper fra den nye ligaen
- ✅ Vise ligaen i filter-menyen
- ✅ Oppdatere alle steder der liga-navn vises
- ✅ Inkludere ligaen i konkurranser
- ✅ Vise riktig emoji og navn overalt

---

## 🔧 Avanserte innstillinger

### Skjule en liga midlertidig (uten å slette)

Sett `enabled: false`:

```javascript
{
    id: 48,
    name: 'EFL Cup',
    emoji: '🏆',
    displayName: 'EFL Cup',
    enabled: false  // ← Ligaen vises ikke i systemet
}
```

### Velge emoji

Bruk flagg eller fotball-emojis:
- 🇬🇧 (UK flagg)
- 🇪🇸 (Spania flagg)
- ⚽ (Fotball)
- 🏆 (Pokal)
- ⭐ (Stjerne)
- 🌟 (Glitrende stjerne)

---

## 📋 Liste over vanlige ligaer

| Liga | ID | Emoji-forslag |
|------|-----|---------------|
| Premier League | 39 | ⚽ eller 🇬🇧 |
| Champions League | 2 | ⭐ |
| Europa League | 3 | 🌟 |
| La Liga | 140 | 🇪🇸 |
| Bundesliga | 78 | 🇩🇪 |
| Serie A | 135 | 🇮🇹 |
| Ligue 1 | 61 | 🇫🇷 |
| Eliteserien | 103 | 🇳🇴 |
| EFL Cup | 48 | 🏆 |
| WC Kvalifisering | 32 | 🇪🇺 |

---

## ❓ Feilsøking

### Ligaen vises ikke?

1. Sjekk at `enabled: true`
2. Sjekk at liga-ID er riktig (må matche API-Football)
3. Last siden på nytt (hard refresh: Ctrl+Shift+R)

### Ingen kamper fra den nye ligaen?

- API-Football kan ha begrenset tilgang til noen ligaer
- Sjekk at sesongen er aktiv
- Sjekk din API-plan på dashboard.api-football.com

---

## 🚀 Hva skjer automatisk?

Når du legger til en liga i `leagues.config.js`, oppdateres automatisk:

1. **API-kall** (`api-config.js`) - Systemet henter kamper fra den nye ligaen
2. **Filter-meny** (`app-firebase.js`) - Ligaen vises i filter-lista
3. **Konkurranse-opprettelse** - Kamper fra ligaen kan velges
4. **Statistikk** - Liga-navn vises korrekt i statistikk-oversikten
5. **Alle UI-elementer** - Emoji og navn vises konsistent overalt

---

## 📁 Teknisk info (for utviklere)

### Arkitektur

```
leagues.config.js (KILDE)
    ↓
    ├── api-config.js (API-kall)
    ├── app-firebase.js (UI/Filter)
    ├── js/utils/leagueConfig.js (Backward compatibility)
    └── js/constants/appConstants.js (Constants)
```

### Funksjoner tilgjengelig

```javascript
import {
    getLeagueIds,           // [39, 2, 3, ...]
    getLeagueName,          // "Premier League"
    getLeagueNameWithEmoji, // "⚽ Premier League"
    getLeagueEmoji,         // "⚽"
    isLeagueEnabled,        // true/false
    getLeague              // Hele objektet
} from './leagues.config.js';
```

---

**Det er alt du trenger å vite!** 🎯

Hvis du har spørsmål, se koden i `leagues.config.js` - den er grundig kommentert.
