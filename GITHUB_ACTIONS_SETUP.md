# GitHub Actions Setup Guide

Dette dokumentet forklarer hvordan du setter opp automatisk oppdatering av kamper og odds via GitHub Actions.

## Hvordan det fungerer

GitHub Actions kjører `populate_matches.py` **automatisk hver time** og oppdaterer:
- ✅ Kamper fra API-Football
- ✅ Odds fra API-Football
- ✅ Resultater for fullførte kamper

Nettsiden henter **KUN** fra Supabase (ikke fra API), noe som gjør den rask og pålitelig.

## Steg 1: Legg til GitHub Secrets

Du må legge til 3 secrets i GitHub repository:

1. Gå til GitHub: https://github.com/oyvindnorli/tippekonkurranse
2. Klikk på **Settings** (øverst til høyre)
3. I venstre sidebar, klikk **Secrets and variables** → **Actions**
4. Klikk **New repository secret** for hver av disse:

### Secret 1: SUPABASE_URL
- **Name:** `SUPABASE_URL`
- **Value:** `https://ntbhjbstmbnfiaywfkkz.supabase.co`

### Secret 2: SUPABASE_SERVICE_KEY
- **Name:** `SUPABASE_SERVICE_KEY`
- **Value:** Din Supabase service_role key (fra .env filen)
  - Finn den i: https://supabase.com/dashboard/project/ntbhjbstmbnfiaywfkkz/settings/api
  - Under "Project API keys" → "service_role" (secret)
  - **VIKTIG:** Dette er service_role nøkkelen, IKKE anon key!

### Secret 3: API_FOOTBALL_KEY
- **Name:** `API_FOOTBALL_KEY`
- **Value:** Din API-Football nøkkel (fra .env filen)
  - Finn den på: https://dashboard.api-football.com/

## Steg 2: Test Workflow

1. Gå til **Actions** tab i GitHub repository
2. Klikk på **Update Matches and Odds** workflow
3. Klikk **Run workflow** → **Run workflow** (grønn knapp)
4. Vent 1-2 minutter
5. Sjekk at jobben ble grønn ✅

## Steg 3: Verifiser i Supabase

1. Gå til Supabase: https://supabase.com/dashboard/project/ntbhjbstmbnfiaywfkkz/editor
2. Åpne `matches` tabellen
3. Sjekk at kampene har blitt oppdatert nylig (se `updated_at` kolonnen)

## Automatisk Kjøring

Workflow kjører automatisk:
- ⏰ **Hver time** (ved minutt 0)
- 🔄 Oppdaterer kamper, odds og resultater
- 📊 Logger aktivitet i Actions tab

## Manuell Kjøring

Du kan kjøre workflow manuelt når som helst:
1. Gå til **Actions** → **Update Matches and Odds**
2. Klikk **Run workflow**
3. Velg branch (main) og klikk **Run workflow**

## Feilsøking

### Workflow feiler
- Sjekk **Actions** tab for error-meldinger
- Verifiser at alle 3 secrets er lagt inn korrekt
- Sjekk API-Football kvote: https://dashboard.api-football.com/

### Ingen kamper oppdateres
- Sjekk at `populate_matches.py` fungerer lokalt først
- Verifiser at SUPABASE_SERVICE_KEY er service_role (ikke anon)
- Sjekk Supabase RLS policies (må tillate INSERT/UPDATE for service_role)

### API-Football kvote oppbrukt
- Free tier: 100 requests/dag
- Workflow bruker ~2-3 requests per kjøring
- 24 kjøringer/dag = ~50-75 requests totalt
- Du bør ha nok kvote med margin

## Neste Steg

Etter setup er ferdig:
1. Fjern API-kall fra frontend (nettsiden skal kun lese fra Supabase)
2. Test at nettsiden laster raskt
3. Overvåk GitHub Actions at det fungerer hver time
