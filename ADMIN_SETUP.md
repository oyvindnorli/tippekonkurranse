# Admin Setup Guide

## Problem som ble løst
Tidligere prøvde klient-koden å skrive kamper til Supabase, men dette førte til RLS-feil (Row Level Security). Nå er systemet endret slik at:

- **Klienter**: Kan kun LESE kamper (ingen autentisering nødvendig)
- **Admin-script**: Kan SKRIVE kamper (bruker service_role key)

Dette sikrer at alle brukere ser de samme oddsen for samme kamp.

## Steg 1: Kjør SQL-migrasjonen i Supabase

1. Gå til [Supabase Dashboard](https://supabase.com/dashboard)
2. Velg ditt prosjekt
3. Gå til **SQL Editor** (venstre meny)
4. Åpne `supabase_rls_fix.sql` og kopier innholdet
5. Lim inn i SQL Editor og kjør (Run)
6. Du skal se meldingen: "Success. No rows returned"

## Steg 2: Sett opp Python-miljøet

1. Installer Python 3.8+ hvis du ikke har det
2. Installer avhengigheter:
   ```bash
   pip install requests python-dotenv
   ```

## Steg 3: Konfigurer miljøvariabler

1. Kopier `.env.example` til `.env`:
   ```bash
   copy .env.example .env
   ```

2. Rediger `.env` og fyll inn:
   - **SUPABASE_SERVICE_KEY**: Finn denne i Supabase Dashboard → Settings → API → service_role key (secret!)
   - **API_FOOTBALL_KEY**: Din API-nøkkel fra https://dashboard.api-football.com/

   **VIKTIG**: `SUPABASE_SERVICE_KEY` er IKKE det samme som `anon` key! Det er den hemmelige service_role key.

## Steg 4: Kjør scriptet

```bash
python populate_matches.py
```

Scriptet vil:
1. Hente kommende kamper fra API-Football (neste 30 dager)
2. Hente odds for hver kamp
3. Lagre alt til Supabase

## Steg 5: Kjør scriptet regelmessig

For å holde kamper oppdatert, kjør scriptet:
- **Daglig**: For å få nye odds og oppdaterte resultater
- **Før store ligaer starter**: For å sikre at alle kamper er i databasen

Du kan sette opp en **cron job** eller **Windows Task Scheduler** for automatisk kjøring.

## Verifisering

1. Åpne nettsiden (tippekonkurranse.com)
2. Åpne Console (F12)
3. Refresh siden
4. Du skal IKKE se feilmeldinger om "row-level security policy"
5. Kamper skal lastes fra Supabase uten feil

## Troubleshooting

### "Missing environment variables"
- Sjekk at `.env` filen eksisterer og har riktige verdier
- Husk å bruke `SUPABASE_SERVICE_KEY`, ikke `anon` key

### "API-Football error: 403"
- API-nøkkelen er ugyldig eller quota er brukt opp
- Sjekk på https://dashboard.api-football.com/

### "Error saving match: 42501"
- RLS-policyen er ikke oppdatert riktig
- Kjør SQL-migrasjonen på nytt

### "No matches found"
- API-Football returnerte ingen kamper i dato-området
- Prøv å utvide dato-området i scriptet
