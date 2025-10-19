# Firebase Oppsett - Steg-for-steg Guide

## Steg 1: Opprett Firebase-prosjekt

1. Gå til https://console.firebase.google.com/
2. Klikk "Add project" / "Legg til prosjekt"
3. Gi prosjektet et navn (f.eks. "tippekonkurranse")
4. Godta vilkårene og klikk "Continue"
5. Deaktiver Google Analytics (ikke nødvendig) eller la det være på
6. Klikk "Create project"

## Steg 2: Legg til Web App

1. I Firebase Console, klikk på Web-ikonet (</>)
2. Registrer appen med et navn (f.eks. "Tippekonkurranse Web")
3. Ikke huk av "Firebase Hosting" ennå
4. Klikk "Register app"
5. **VIKTIG**: Kopier Firebase config-objektet som vises
   - Det ser slik ut:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. Lim inn denne configurasjonen i `firebase-config.js` filen

## Steg 3: Aktiver Authentication

1. I Firebase Console, gå til "Authentication" i sidemenyen
2. Klikk "Get started"
3. Under "Sign-in method", klikk "Email/Password"
4. Toggle "Enable" til på
5. Klikk "Save"

## Steg 4: Aktiver Firestore Database

1. I Firebase Console, gå til "Firestore Database"
2. Klikk "Create database"
3. Velg "Start in test mode" (vi endrer reglene senere)
4. Velg en region (f.eks. "europe-west1")
5. Klikk "Enable"

## Steg 5: Sett opp Firestore Rules

1. Gå til "Firestore Database" > "Rules"
2. Erstatt innholdet med følgende:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read all user data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Users can read all tips
    match /tips/{tipId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

3. Klikk "Publish"

## Steg 6: Oppdater firebase-config.js

Lim inn dine Firebase-verdier i `firebase-config.js` filen som jeg har laget.

## Du er klar!

Når du har gjort dette, vil appen bruke Firebase for:
- Innlogging med epost/passord
- Lagring av brukere i cloud
- Lagring av tips i cloud
- Sanntids toppliste

## Hosting (valgfritt - for å legge ut på nettet)

1. Installer Firebase CLI: `npm install -g firebase-tools`
2. Logg inn: `firebase login`
3. Initialiser: `firebase init hosting`
4. Deploy: `firebase deploy`
