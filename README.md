#  PerFit - Bruksanvisning

Dette prosjektet er en Chrome-utvidelse som hjelper brukere med å finne riktig klesstørrelse ved å sammenligne kroppsmål med nettbutikkers størrelsestabeller.

## 🛠 Installasjon og Oppsett
Følg disse stegene hvis du bytter maskin eller starter prosjektet på nytt:

1. **Gå til prosjektmappen:**
   ```bash
   cd perfit
Installer nødvendige pakker:

Bash

npm install
Hvordan kjøre programmet (Daglig bruk)
Hver gang du har gjort endringer i koden og vil se dem i nettleseren:


Oppdater i Chrome:

Gå til chrome://extensions/

Finn PerFit

Klikk på oppdater-ikonet (⟳)

 Viktige filer og mapper
src/chrome-extension/popup/index.tsx: Her endrer du det lille vinduet som dukker opp når du klikker på utvidelsen.

src/chrome-extension/options/index.tsx: Her endrer du innstillingssiden (brukerprofil/mål).

src/content: (Må opprettes) Her skal vi legge logikken som leser tabeller på Zalando osv.

dist: Den ferdige utvidelsen som Chrome leser. Denne skal ikke endres manuelt.

Utviklingsrutine
Bruk npm run dev hvis du vil jobbe raskt med kun selve React-grensesnittet (popup).

Bruk npm run build for å teste den faktiske utvidelsen på ekte nettsider.

Skriv alltid logg i UTVIKLINGSLOGG.md etter hver økt.
