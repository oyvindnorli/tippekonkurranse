# Vercel Deployment Setup

## Environment Variables

For å få API-Football til å fungere på Vercel, må du legge til API-nøkkelen som en environment variable.

### Steg 1: Gå til Vercel Dashboard

1. Gå til https://vercel.com/dashboard
2. Velg ditt prosjekt (tippekonkurranse)
3. Gå til **Settings** > **Environment Variables**

### Steg 2: Legg til API-nøkkel

1. Klikk på **Add New**
2. Fyll inn:
   - **Name:** `API_FOOTBALL_KEY`
   - **Value:** `dc3a8f33b796becd652ac9b08a8ff0ce`
   - **Environment:** Velg alle (Production, Preview, Development)
3. Klikk **Save**

### Steg 3: Redeploy

Etter å ha lagt til environment variable, må du redeploy applikasjonen:

1. Gå til **Deployments** tab
2. Finn siste deployment
3. Klikk på de tre prikkene (•••)
4. Velg **Redeploy**

## Lokal Testing

For å teste serverless function lokalt:

1. Installer Vercel CLI: `npm i -g vercel`
2. Kjør: `vercel dev`
3. Åpne http://localhost:3000

## Serverless Function

API-Football proxy-funksjonen ligger i `/api/football.js` og:
- Håndterer alle API-Football requests
- Skjuler API-nøkkelen fra frontend
- Unngår CORS-problemer

## Troubleshooting

### CORS errors
Hvis du fortsatt får CORS-feil, sjekk at:
- Environment variable er riktig satt
- Du har redeployet etter å ha lagt til variabelen
- Du bruker riktig URL (ikke localhost i produksjon)

### API-nøkkel ikke funnet
Hvis du får "API key not configured" error:
- Sjekk at environment variabelen heter nøyaktig `API_FOOTBALL_KEY`
- Sjekk at den er satt for Production environment
- Redeploy applikasjonen
