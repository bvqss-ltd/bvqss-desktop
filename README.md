# BVQSS desktop apps

Windows and Mac apps for the BVQSS Construction Suite:

| App | Opens | Windows | Mac |
|---|---|---|---|
| **BVQSS Tender** | bvqsstender.com | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-Tender-Setup.exe) | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-Tender-Mac.dmg) |
| **BVQSS Value** | bvqssvalue.com | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-Value-Setup.exe) | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-Value-Mac.dmg) |
| **BVQSS Damage** | bvqssdamage.com | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-Damage-Setup.exe) | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-Damage-Mac.dmg) |
| **BVQSS HSE** | bvqsshse.com | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-HSE-Setup.exe) | [Download](https://github.com/bvqss-ltd/bvqss-desktop/releases/latest/download/BVQSS-HSE-Mac.dmg) |

Each app is a desktop window around its live website, so it always shows the current version of the site.
Sign in with your usual BVQSS account; access and data are exactly as on the website. No data is stored in this repository.

What the app adds over a browser tab:
- its own window, icon, taskbar / Dock entry and Start-menu shortcut
- Save dialogs for every PDF, Word and Excel export, and a Print menu (Ctrl/Cmd + P)
- Value and Damage reopen at your company's address (e.g. bvqss.bvqssvalue.com); File → Switch company… to change
- links to other websites open in your normal browser
- an offline page when there is no internet, and automatic updates

## Building (BVQSS staff)
GitHub → **Actions → Desktop apps → Run workflow**, type the new version (e.g. `1.0.1`). About 15 minutes later the
release appears under **Releases** and installed apps update themselves.

Local test: `npm install`, then `npm start` (Tender), `npm run start:value`, `npm run start:damage` or `npm run start:hse`.

Folder: `apps/*.json` (name, address, allowed domains per app) · `src/` (the app) · `assets/` (icons) ·
`scripts/prepare.mjs` (prepares one app for building) · `.github/workflows/desktop.yml` (build and release).

Mac signing: add the `MAC_CERT_P12`, `MAC_CERT_PASSWORD`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` secrets
(see the top of the workflow file). Without them the Mac app is built unsigned.

© BVQSS, Quantity Surveyors & Valuers · K&K Building, Bay Street, Kingstown, St Vincent & the Grenadines · bvqss.com
