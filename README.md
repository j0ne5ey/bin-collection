# Bin Collection

A small installable web app showing the next Scottish Borders Council bin
collection — updates itself automatically every day.

- `scraper/fetch.py` — pulls the schedule from SBC's Bartec Municipal portal
  and writes `docs/data/collections.json`. Run daily by
  [`.github/workflows/update.yml`](.github/workflows/update.yml).
- `docs/` — the app itself, served by GitHub Pages. Open it on your phone and
  "Add to Home Screen" to install it.

## Setup

1. In the repo's Settings → Secrets and variables → Actions, add:
   - `SBC_POSTCODE` — e.g. `TD1 2QN`
   - `SBC_UPRN` — the property's UPRN (find at
     [findmyaddress.co.uk](https://www.findmyaddress.co.uk))
2. Settings → Pages → deploy from the `main` branch, `/docs` folder.
3. Run the "Update bin collection data" workflow once manually (Actions tab)
   to generate the first `collections.json`.

See [PLAN.md](PLAN.md) for the full design.
