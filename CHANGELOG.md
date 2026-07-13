# Changelog

Notable changes to the app and infrastructure. The daily automated commit from
the scraper workflow (`Update bin collection schedule`) and any backstop
commits from `keepalive.yml` aren't listed here — those are routine data
refreshes, not changes to the project itself.

## 2026-07-13

### Added
- A "Then" section between the next-collection card and the Upcoming list,
  showing the collection after the imminent one so both are visible at a
  glance instead of just the next one.

### Changed
- The Then section is now its own mini-card (accent border, larger bold
  type text, a countdown pill) instead of a plain list row, so it reads as
  clearly more important than the Upcoming list while staying visually
  secondary to the primary next-collection card.
- Added a subtle backdrop: the app's logo mark (a continuous arc +
  arrowhead representing the weekly collection cycle, from a provided
  design handoff), rendered giant and near-invisible, bleeding off the
  top-right corner behind all content.

## 2026-07-08

### Added
- Initial build: installable PWA served via GitHub Pages, with a daily
  GitHub Actions workflow scraping the schedule from Scottish Borders
  Council's Bartec Municipal portal. Shows the next collection with a
  countdown, a colour-coded upcoming list, dark/light mode, and offline
  support via a service worker.
- `keepalive.yml`: a monthly backstop workflow that pushes a trivial commit
  if the scraper hasn't committed anything in 45+ days, so a prolonged
  scraper failure can't let GitHub disable the schedule entirely (GitHub
  turns off scheduled workflows after 60 days of repo inactivity).
- Swipe-down-to-refresh gesture, implemented by hand since installed/
  standalone PWAs don't reliably get the browser's native pull-to-refresh.
- A manual Refresh button in the footer, as a visible fallback for anyone
  who doesn't know about the swipe gesture or is using a mouse.

### Fixed
- README's example postcode was accidentally the real address; replaced
  with a generic placeholder.
- The Refresh button (and footer generally) could be scrolled off-screen on
  real phone viewports, since the page's height depended on how much
  content it had. Restructured to a fixed-height app shell — header, next-
  collection card, and footer are always visible; only the Upcoming list
  scrolls internally if it has more entries than fit.

### Changed
- The pull-to-refresh indicator now shows a down/up arrow that flips as the
  pull crosses the release threshold, then spins during the actual refresh,
  in place of the plain spinner ring it used before.
