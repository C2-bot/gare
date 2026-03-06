# C2 Group — Analizzatore Disciplinari di Gara (Web)

## Deploy su Netlify

### 1. Carica su GitHub
Crea un repository GitHub (privato) e carica tutti i file:
```
index.html
netlify.toml
package.json
netlify/functions/login.js
netlify/functions/analizza.js
```

### 2. Collega a Netlify
- Vai su netlify.com → "Add new site" → "Import from Git"
- Seleziona il repository
- Build command: (lascia vuoto)
- Publish directory: `.`
- Clicca "Deploy site"

### 3. Configura variabili d'ambiente
In Netlify → Site settings → Environment variables, aggiungi:

| Variabile | Valore |
|-----------|--------|
| `ANTHROPIC_API_KEY` | sk-ant-api03-... |
| `JWT_SECRET` | (stringa casuale lunga, es. c2group-secret-2026-xyz) |

### 4. Configura sottodominio
In Netlify → Domain management → Add custom domain:
- Aggiungi `gare.c2group.it`
- Nel DNS del dominio c2group.it, aggiungi un record CNAME:
  - Nome: `gare`
  - Valore: `[nome-sito].netlify.app`

### 5. Aggiungere utenti
Modifica `netlify/functions/login.js`, array `USERS`:
```js
const USERS = [
  { email: "nicola.roli@c2group.it", password: "AnalisiBandi", nome: "Nicola Roli" },
  { email: "nuovo.utente@c2group.it", password: "NuovaPassword", nome: "Nome Cognome" },
];
```
Poi fai push su GitHub — Netlify rideploya automaticamente.

## Note di sicurezza
- La chiave API Anthropic risiede solo nelle variabili Netlify (mai nel codice)
- I PDF caricati non vengono mai salvati — elaborati in memoria e subito scartati
- Il JWT scade dopo 8 ore (richiede nuovo login)
