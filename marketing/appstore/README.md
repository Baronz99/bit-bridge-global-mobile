# BitBridge App Store Screenshot Generator

This folder is fully isolated from app/backend production code.

## Folder Layout

- `brand/`
  - Put your brand logo as `logo.png` or `logo.svg`.
  - If missing, generator falls back to `logo-placeholder.svg`.
- `inputs/screens/`
  - Add raw app screenshots named `01.png` to `08.png`.
- `inputs/copy.json`
  - Slide copy (headline + subhead) for each screenshot.
- `templates/`
  - HTML slides (`01.html` ... `08.html`).
- `styles/shared.css`
  - Shared premium fintech visual system.
- `assets/`
  - Local mesh/glow assets.
- `output/`
  - Exported App Store screenshots.

## Install & Run

```bash
cd marketing/appstore
npm i
node export.mjs
```

Outputs are written to:

- `marketing/appstore/output/01-hero.png`
- `marketing/appstore/output/02-airtime-data.png`
- `marketing/appstore/output/03-utilities.png`
- `marketing/appstore/output/04-fund-wallet.png`
- `marketing/appstore/output/05-timeline.png`
- `marketing/appstore/output/06-security.png`
- `marketing/appstore/output/07-receipts-history.png`
- `marketing/appstore/output/08-brand.png`

## Output Specs

- Size: `1290x2796` (iPhone 6.7")
- Format: PNG
- No network/CDN assets used at render time

## Customization

- Copy: edit `inputs/copy.json`
- Colors: edit CSS variables in `styles/shared.css`
  - Default palette:
    - Background: `#050A18 -> #0B1630`
    - Accent: `#D6B15E`
    - Text: `#FFFFFF`
    - Muted text: `#B9C2D3`
- Replace screenshot device captures in `inputs/screens/01.png..08.png`

## Notes

- If a screenshot file is missing, template renders a built-in placeholder so export still succeeds.
- Keep text short for App Store-safe margins.
