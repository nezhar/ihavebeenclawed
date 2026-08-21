# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the same house rules for other agents; keep the two in sync when conventions change.

## What this is

A static, build-less archive of AI-agent and chatbot incidents. No package manager, no bundler, no dependencies — plain HTML/CSS/JS served over HTTP.

## Commands

Serve locally (must be HTTP — the page `fetch`es `incidents.json`, so `file://` fails into the error state):

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
```

Full check suite (run from the repo root — tests read `index.html` / `incidents.json` via relative paths):

```bash
node scripts/validate-incidents.js
node --test tests/*.test.js
node --check incident-data.js && node --check image-slot.js && node --check support.js
```

Single test file: `node --test tests/incident-data.test.js`. Single test case: `node --test --test-name-pattern 'duplicate IDs' tests/*.test.js`.

## Architecture

**Data is the source of truth.** `incidents.json` (`schemaVersion: 1`, `updatedAt`, `incidents[]`) is the only incident store. Nothing may hardcode a second copy — `tests/page-contract.test.js` fails the build if `index.html` declares `const DATA|FEATURED|HALL`.

**One validator, two runtimes.** `incident-data.js` is a UMD-ish module exporting `validateDataset` and `deriveStats`. It runs in Node (via `scripts/validate-incidents.js` and tests) and in the browser (as `window.IncidentData`, called inside `loadIncidents()` after the fetch). Schema changes go here first; the CLI, the tests, and the page all inherit them. `validUrl` deliberately rejects non-http(s)/non-relative URLs (e.g. `javascript:`), so it is a security boundary, not just a lint.

**The page is a DC component, not vanilla DOM.** `index.html` contains:
- a `<x-dc>` template using `{{ expr }}` interpolation plus the control-flow elements `<sc-for list="{{ … }}" as="x">` and `<sc-if value="{{ … }}">`. The `hint-placeholder-count` / `hint-placeholder-val` attributes only drive the pre-hydration placeholder render.
- a `<script type="text/x-dc" data-dc-script>` defining `class Component extends DCLogic`. State lives in `state`; **all derived view data is computed in one `renderVals()`** which returns the object the template binds against. Event handlers are passed down as closures inside that returned object (`onClick`, `onKeyDown`, …), so adding interaction means adding a field in `renderVals()`, not wiring listeners in the template.
- `support.js` is the generated DC runtime (React-based). **Never edit it** — its header points at the `dc-runtime` source repo.

Data flow: `componentDidMount` → `loadIncidents()` → fetch + `validateDataset` → `state.incidents` → `renderVals()` derives filters, featured carousel, hall-of-claws, stats, modal. Filter chips, agent/damage lists, and counters are all derived from the dataset, so a new incident automatically extends the filter options.

Cross-cutting behaviors already wired in `renderVals()`/lifecycle that new code must not regress: theme vars (`DARK`/`LIGHT` → CSS custom properties on the root div), `prefers-reduced-motion` (`state.reduced` nulls out every `transition`), carousel pause on hover/focus, modal focus trap + Escape + focus restore + `body` scroll lock, and `linkAttrs()` which adds `target="_blank" rel="noopener noreferrer"` only for remote URLs.

**Images.** `image-slot.js` implements the `<image-slot>` custom element (drag-drop fillable placeholder, persisted via an omelette sidecar; read-only outside that runtime). It is copied starter code — regenerating it overwrites local edits. Incident images live in `assets/images/`; `tests/asset-contract.test.js` pins the exact set of referenced assets and forbids `uploads/` paths or `ChatGPT Image` filenames in shipped content, so adding or renaming an image means updating that test.

`ihavebeenclawed.dc.html` is a meta-refresh redirect to `index.html` only; it must never regain app code.

`docs/superpowers/` holds local spec/plan files — keep them untracked, never commit them.

## Conventions

Two-space indent in HTML/CSS/JS/JSON. `const`/`let`, semicolons, single quotes in standalone scripts, camelCase, UPPER_SNAKE_CASE constants. No formatter is configured — match nearby code. Preserve accessible labels, keyboard focus states, and reduced-motion behavior. Image-slot ids are descriptive and unique (`featured-claude-home-delete`); image files are lowercase kebab-case (`scratched-wrist.png`).

## Incident data & sources

Lowercase slug `id`, ISO `YYYY-MM-DD` dates (`date` may be `null`), severity 1–5, `preventable` true/false/null, and only schema-supported `damageCategory` / `evidenceLevel` values. Every incident needs at least one source with `title`, `publisher`, `url`, `sourceType`, `accessedAt`; `featured` incidents additionally require `imageCaption`.

Summarize sources rather than copying long passages, prefer primary artifacts, include access dates. Never imply that illustrative artwork is incident evidence.

Field semantics the validator cannot enforce — apply them by hand:

- **`evidenceLevel`** — `verified` requires an official document: court or tribunal decision, regulator finding, or a published postmortem/incident report from the responsible organization. Journalism and independent firsthand testing are *not* enough on their own; those are `reported`, however good the reporting is. `reported` covers first-person issue reports, community posts, and press coverage with traceable artifacts. `anecdotal` is for stories with no traceable evidence at all.
- **`severity`** — 5: irreversible loss of primary data, or a production outage/legal judgment against the operator. 4: major loss or production impact that was mostly recovered, or a serious breach of a security boundary. 3: contained and recoverable damage, or wasted spend without lasting loss. 2: reputational damage only. 1: near miss, caught before impact. Score the *outcome described in the record* — if `details` says the data came back, it is not a 5.
- **`date`** — the date of the documented event this record is about (the incident, or the ruling/decision when that is the record). Not the date you read the source and not the article's publication date. Put publication dates in `details` prose if they matter.
- **`agent`** — the product name only, spelled one way across the whole dataset (`Claude Code`, not also `Claude CLI`; `Codex`, not also `Codex CLI`). Every distinct string becomes its own filter chip and counts toward the "agents implicated" stat, so a variant spelling silently inflates the headline number. Put the tool version in `agentVersion`; a model name is not a version — say it in `details`.
- **`displayId`** — the upstream identifier where one exists (`COD-35707`, `CLINE-8422`, `REDDIT-1PGXCKK`, `BCCRT-149`). Do not invent sequence numbers; they imply a register that does not exist.

`featured` incidents should not all come from one evidence tier or one product category — the carousel is the archive's credibility argument, so keep at least one `verified` record in it.

## Verification beyond the test suite

Manually check loading and failure states, filters, source links, theme switching, carousel rotation, the incident modal, responsive layout, and the browser console at narrow and desktop widths.

## Commits & PRs

Short imperative commit subjects (`add sourced Gemini incident`). PRs summarize visible changes, list verification performed, link issues, and include before/after screenshots for visual changes. Call out new sources, assets, attribution requirements, and generated-runtime updates.
