# Appregnskap (Budsjett PWA)

PWA som viser budsjett og kategorisering fra en eksportert `budget-export.json` (fra transaction-csv-parser-prosjektet).

**PWA-URL (etter deploy):** [https://vigleikn.github.io/appregnskap/](https://vigleikn.github.io/appregnskap/)

## Bruk

1. I hovedprosjektet (v7): Klikk **Eksporter til telefon** på Transaksjoner-siden. Lagre `budget-export.json` i din delte iCloud-mappe.
2. Åpne PWA-en på telefonen: **https://vigleikn.github.io/appregnskap/**
3. Trykk **Last inn fra iCloud** og velg `budget-export.json` fra den delte mappen.
4. Siste innlastede data lagres lokalt og vises ved neste åpning til du laster inn på nytt.
5. I Safari: **Del** → **Legg til på Hjem-skjerm** for app-ikon.

## Deploy til GitHub Pages

Repo: [vigleikn/appregnskap](https://github.com/vigleikn/appregnskap)

1. Klon repoet (hvis du ikke allerede har det):
   ```bash
   git clone https://github.com/vigleikn/appregnskap.git
   cd appregnskap
   ```
2. Kopier inn filene fra `phone-budget-pwa/` (index.html, styles.css, app.js, manifest.json, sw.js, .nojekyll, README.md).
3. Commit og push:
   ```bash
   git add .
   git commit -m "PWA for budsjett"
   git push origin main
   ```
4. Slå på GitHub Pages:
   - Gå til **https://github.com/vigleikn/appregnskap**
   - Klikk **Settings** (fanen øverst i repoet)
   - I venstremenyen: under **Code and automation** → **Pages** (eller bare **Pages** lenger ned)
   - Under **Build and deployment** → **Source**: velg **Deploy from a branch**
   - **Branch**: velg `main`, mappe **/ (root)** → **Save**
   - Vent 1–2 minutter. URL: **https://vigleikn.github.io/appregnskap/**

### Får du ikke til Pages?

- **Ser du ikke Settings?** Du må være eier av repoet (eller ha admin-rettigheter).
- **Står det «GitHub Pages is currently disabled»?** Noen kontoer må godkjenne Pages én gang: [github.com/settings/pages](https://github.com/settings/pages) (Settings for kontoen din, ikke repoet).
- **Ingen «Deploy from a branch»?** Sjekk at du har pushet minst én commit til `main`. Hvis repoet er helt tomt, opprett og push filene først, så dukker branch-alternativet opp.
- **Branchen heter noe annet (f.eks. `master`)?** Velg den branchen du faktisk pusher til i stedet for `main`.

## Valgfritt ikon

Legg en 192×192 px PNG som `icon-192.png` i repoet for eget ikon på hjemskjermen.
