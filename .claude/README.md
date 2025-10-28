# Claude Code Workspace

Denne mappen inneholder spesifikasjoner, planer og dokumentasjon for Claude Code.

## Hvordan bruke:

### 1. Nye features
Kopier `features/_TEMPLATE.md` til en ny fil:
```bash
cp features/_TEMPLATE.md features/min-nye-feature.md
```

Fyll ut alle seksjoner, så detaljert som mulig. Jo mer info, jo bedre resultat!

**Deretter:**
```
SI TIL CLAUDE: "Les .claude/features/min-nye-feature.md og lag en
                implementeringsplan"
```

### 2. Bugs
Kopier `bugs/_TEMPLATE.md` til en ny fil:
```bash
cp bugs/_TEMPLATE.md bugs/navn-på-bug.md
```

Beskriv feilen, hvordan reprodusere, og legg ved screenshots.

**Deretter:**
```
SI TIL CLAUDE: "Les .claude/bugs/navn-på-bug.md og fiks denne feilen"
```

### 3. Forbedringer/Refactoring
Kopier `improvements/_TEMPLATE.md` til en ny fil:
```bash
cp improvements/_TEMPLATE.md improvements/refactor-app-firebase.md
```

Beskriv hva som bør forbedres og hvorfor.

**Deretter:**
```
SI TIL CLAUDE: "Les .claude/improvements/refactor-app-firebase.md og
                foreslå en plan"
```

## Fordeler med denne tilnærmingen:

✅ **Du kan jobbe asynkront**
   - Skriv spesifikasjoner når du har tid
   - Claude implementerer når DU har tid

✅ **Bedre planlegging**
   - Du tenker gjennom løsningen før koding
   - Færre bugs og misforståelser

✅ **Dokumentasjon**
   - Spesifikasjoner blir automatisk dokumentasjon
   - Enklere å huske hvorfor ting ble gjort

✅ **Prioritering**
   - Oversikt over alt du vil gjøre
   - Velg hva som er viktigst

✅ **Versjonskontroll**
   - Spesifikasjoner lagres i git
   - Se historikken av hva som ble planlagt

## Tips:

### Vær spesifikk:
❌ "Jeg vil ha bedre design"
✅ "Jeg vil ha rundere hjørner på knapper, større spacing, og mørkere blå farge (#2563eb)"

### Legg ved visuelt:
- Screenshots av hvordan det skal se ut
- Eksempler fra andre nettsider
- Skisser (selv håndtegnede fungerer!)

### Beskriv brukeropplevelsen:
"Når bruker klikker X, skal de se Y, og deretter kunne Z"

### Still spørsmål:
"Er det bedre å bruke modal eller ny side her?"
Claude kan gi deg alternativer å velge mellom!

## Eksempel-arbeidsflyt:

1. **Mandag:** Skriv 3 feature-specs mens du drikker kaffe
2. **Tirsdag:** "Claude, les alle features og gi meg prioritering"
3. **Onsdag:** "Claude, implementer feature X"
4. **Torsdag:** Test feature X, rapporter bugs i bugs/
5. **Fredag:** "Claude, fiks alle bugs i bugs/ mappen"

## Struktur:

```
.claude/
├── README.md           # Denne filen
├── features/           # Nye funksjoner du vil ha
│   └── _TEMPLATE.md
├── bugs/              # Feil som må fikses
│   └── _TEMPLATE.md
└── improvements/      # Forbedringer av eksisterende kode
    └── _TEMPLATE.md
```

---

**Lykke til! 🚀**
