# Bin Collection App — Build Plan

Goal: a phone-friendly app, hosted entirely in GitHub (free), that always shows the
next Scottish Borders Council bin collection — which bin(s), which day, which date —
updating itself automatically with no manual steps.

## 1. The data source (already researched)

Scottish Borders Council doesn't publish an API or ICS feed. Their
[bin collection calendar](https://www.scotborders.gov.uk/bins-rubbish-recycling/bin-collection-calendar)
is an embedded third-party portal from **Bartec Municipal**:

```
https://scotborders-live-portal.bartecmunicipal.com/Embeddable/CollectionCalendar
```

The portal can be driven with three plain HTTP requests (no browser needed):

1. `GET  /Embeddable/CollectionCalendar` — page contains a hidden
   `__RequestVerificationToken` (extract with regex).
2. `POST /Embeddable/CollectionCalendar?handler=SearchPostcode` — send token + postcode;
   response contains an updated token.
3. `POST /Embeddable/CollectionCalendar?handler=SelectPrem` — send token + postcode + **UPRN**;
   response HTML embeds JSON blocks with `Subject` (bin type) and ISO dates
   (e.g. `2025-12-16T00:00:00`).

This exact flow is already implemented (Python) in the Home Assistant
[waste_collection_schedule project, PR #5113](https://github.com/mampfes/hacs_waste_collection_schedule/pull/5113)
— we can adapt that code rather than reverse-engineering from scratch.

**One-time prerequisite:** find the property's UPRN (unique property reference number)
via https://www.findmyaddress.co.uk — takes 2 minutes.

## 2. Architecture

Everything lives in one public GitHub repo. No servers, no cost.

```
GitHub Actions (cron, daily ~05:30)          GitHub Pages
┌──────────────────────────────┐             ┌──────────────────────────┐
│ scraper/fetch.py             │  commits    │ PWA (installable web app)│
│ postcode+UPRN from secrets   │ ──────────► │ reads collections.json   │
│ → docs/data/collections.json │             │ shows next collection    │
└──────────────────────────────┘             └──────────────────────────┘
```

- **"Mobile app" = a PWA** served by GitHub Pages: plain HTML/CSS/JS, a web app
  manifest and a service worker. On the phone you "Add to Home Screen" once and it
  behaves like a native app (own icon, full screen, works offline). No app store,
  no build tooling, no framework.
- **Auto-update**: a scheduled GitHub Actions workflow runs the scraper daily and
  commits `collections.json` only when it changed. The app always fetches the latest
  JSON on open (service worker uses network-first for the data file).

### Privacy in a public repo
Postcode and UPRN are stored as **GitHub Actions secrets** (`SBC_POSTCODE`, `SBC_UPRN`),
never in code. The published JSON contains only dates and bin types — nothing that
identifies the address.

## 3. Repo layout

```
bin-collection/
├── .github/workflows/update.yml     # cron + manual trigger
├── scraper/
│   ├── fetch.py                     # Bartec 3-step flow → JSON
│   └── requirements.txt             # requests only
├── docs/                            # GitHub Pages root
│   ├── index.html
│   ├── app.js                       # render next/upcoming collections
│   ├── style.css                    # colour-coded bins, big readable card
│   ├── manifest.webmanifest         # name, icons, theme colour
│   ├── sw.js                        # offline cache (network-first for data)
│   ├── icons/                       # app icons (192/512px)
│   └── data/collections.json        # written by the Action
└── PLAN.md
```

`collections.json` shape:

```json
{
  "updated": "2026-07-08T05:31:02Z",
  "collections": [
    { "date": "2026-07-10", "type": "Grey bin (general waste)" },
    { "date": "2026-07-17", "type": "Blue bin (recycling)" }
  ]
}
```

## 4. App UX

- Hero card: **"Grey bin — Thursday 10 July"** with a countdown ("in 2 days" /
  "Tomorrow" / "Today"), bin colour as the card accent.
- If two bins fall on the same day, show both.
- Below: list of the next ~6 upcoming collections.
- Footer: "Data updated 8 Jul, 05:31". If the data is >7 days old, show a stale-data
  warning (scrape has been failing).
- Past-midnight logic: a collection dated today still counts as "next" until end of day.

## 5. Workflow details & failure handling

- Cron `30 5 * * *` plus `workflow_dispatch` for manual runs. (GitHub cron can drift
  30–60 min; irrelevant here.)
- Scrape failure → workflow exits non-zero (visible email from GitHub), previous JSON
  stays in place. Collections are fortnightly, so stale data stays correct for days.
- **60-day rule**: GitHub disables scheduled workflows in repos with no activity for
  60 days. The daily data commit itself normally prevents this; as a belt-and-braces,
  add a keepalive step (e.g. `gautamkrishnar/keepalive-workflow`).
- If Bartec ever blocks GitHub's IP ranges or changes markup: fallback is Playwright
  headless in the same workflow (heavier but robust). Not needed initially.

## 6. Build order

1. Confirm UPRN via findmyaddress.co.uk; test the 3-request flow locally with curl/Python
   against the real postcode+UPRN; inspect the JSON we get back.
2. Write `scraper/fetch.py` (adapt the waste_collection_schedule implementation) →
   outputs `docs/data/collections.json`.
3. Build the PWA (index/app.js/style/manifest/sw + icons) against the real JSON;
   test locally in a browser at phone viewport.
4. Create GitHub repo, push, enable Pages (deploy from `docs/`), add the two secrets.
5. Add `update.yml`, run it manually, confirm the JSON commit and the live page.
6. On the phone: open the Pages URL → Add to Home Screen → done.

## 7. Stretch goals (later, optional)

- **ICS feed**: have the scraper also emit `collections.ics` so the schedule can be
  subscribed to in the phone's calendar app (free reminders, no code).
- **Push the night before**: one extra workflow that runs each evening and, if
  tomorrow is a collection day, sends a push via ntfy.sh (free, no signup) —
  more reliable than PWA web-push on iOS.
- Multiple addresses (e.g. a relative's house) via a second secret pair.
