# Repository Guidelines

## Project Structure & Module Organization

This repository is a static AI-agent and chatbot incident archive. `index.html` is the canonical archive template with `DCLogic` behavior; `incident.html` renders individual incidents at `incident.html?id=<slug>`. `archive.css` holds shared styles, and `archive-navigation.js` handles search, filter URLs, and theme persistence; `ihavebeenclawed.dc.html` is a compatibility redirect only. `incidents.json` is the canonical content store, and `incident-data.js` validates it in Node and the browser. `scripts/` contains the validation CLI, `tests/` contains Node tests, and `assets/images/` holds illustrative artwork. `image-slot.js` implements `<image-slot>`. `support.js` is generated DC runtime code; do not edit it directly.

The homepage archive is paginated: 12 cards per page, newest `date` first with undated incidents last, using `sortNewestFirst` and `paginate` from `archive-navigation.js`. The page number is the `page` URL parameter, omitted on page 1; search and filter changes reset to page 1, and paging pushes a history entry and moves focus to the archive heading. Never put `<title>` inside `<helmet>`: the runtime copies its text verbatim on every render, so template expressions appear literally in the browser tab. Keep a static `<title>` in each page's real `<head>` and update `document.title` from the component's `syncTitle()`.

## Build, Test, and Development Commands

There is no package installation or build step. Serve the directory over HTTP, then open `http://localhost:8000/`:

```bash
python3 -m http.server 8000
```

Run all repository checks with:

```bash
node scripts/validate-incidents.js
node --test tests/*.test.js
node --check incident-data.js && node --check archive-navigation.js && node --check image-slot.js && node --check support.js
```

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, JavaScript, and JSON. Follow existing JavaScript conventions: `const`/`let`, semicolons, single quotes in standalone scripts, camelCase names, and UPPER_SNAKE_CASE constants. Preserve accessible labels, keyboard focus states, and reduced-motion behavior. Use descriptive, unique image-slot IDs such as `featured-claude-home-delete`. Name image files with semantic lowercase kebab-case, such as `scratched-wrist.png`. No formatter is configured, so match nearby code.

## Testing Guidelines

Tests use Node's built-in `node:test` runner and files end in `.test.js`. Run validation, tests, and syntax checks before submitting. Manually verify loading and failure states, search and filters, direct incident links, browser Back navigation, copy-link feedback, source links, theme switching, carousel rotation, responsive layouts, and browser-console output at narrow and desktop widths.

## Incident Data & Sources

Use stable lowercase slug IDs, ISO `YYYY-MM-DD` dates, and schema-supported categories. Summarize sources; do not copy long passages. Prefer primary artifacts and include access dates. Never imply that illustrative artwork is incident evidence.

Sources may carry an optional `archiveUrl` (an http(s) Wayback/archive snapshot of `url`, shown as "Archived copy" on the incident page). `scripts/archive-sources.js` fills them in from the Wayback Machine — idempotent and resumable, re-run until no source is unresolved (`--dry-run`, `--limit N` supported). Run it after adding incidents.

Apply these field rules by hand; the validator cannot check them:

- `evidenceLevel`: `verified` requires an official document (court or tribunal decision, regulator finding, or the responsible organization's own postmortem). Journalism and independent firsthand testing stay `reported`, along with issue reports and community posts. `anecdotal` means no traceable evidence.
- `severity`: 5 irreversible primary-data loss, production outage, or judgment against the operator; 4 major impact mostly recovered, or a serious security-boundary breach; 3 contained and recoverable, or wasted spend; 2 reputational only; 1 near miss. Score what the record's own `details` describe — recovered data is not a 5.
- `date`: the documented event's date (incident, or the ruling when that is the record), never the access or publication date.
- `agent`: product name only, spelled one way dataset-wide — each distinct string becomes a filter chip and inflates the "agents implicated" counter. Tool version goes in `agentVersion`; a model name is not a version.
- `displayId`: use the upstream identifier (`COD-35707`, `REDDIT-1PGXCKK`, `BCCRT-149`); do not invent sequence numbers.
- `preventable`: scored from the victim's side — `true` only when the tool's operator could realistically have prevented the outcome with known precautions; vendor bugs and supply-chain compromises invisible to the user are `false`; `null` when it depends on whose prevention counts. Hindsight lessons alone do not make an incident `true`.

Keep at least one `verified` record among the `featured` incidents, and do not let the carousel collapse into a single product or damage category.

## Commit & Pull Request Guidelines

Git history is unavailable here, so use short, imperative commits such as `add sourced Gemini incident`. Pull requests should summarize visible changes, list verification, link issues, and include before/after screenshots for visual changes. Call out new sources, assets, attribution requirements, and generated-runtime updates.
