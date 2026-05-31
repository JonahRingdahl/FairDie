# FairDie — static site

## Structure

Pure vanilla HTML/CSS/JS — no build, no bundler, no npm. Three files:

- `index.html` — loads Chart.js from CDN (`cdn.jsdelivr.net/npm/chart.js`)
- `index.css` — single stylesheet
- `index.js` — all application logic, 831 lines

## Verify syntax (no runtime tests available)

```bash
node --check index.js
```

Functional testing requires a local HTTP server and manual browser check:

```bash
python3 -m http.server 8080
```

## Notable quirks

- **Chi-squared p-value** computed in-browser via a Lanczos-approximation `logGamma` + series expansion of the regularized lower incomplete gamma function (`index.js:532-550`). This is the whole point of the app; don't break it.
- **Two modes** (`index.js:6`): `'record'` (click die-face buttons) and `'upload'` (drag/drop or browse a file). The mode selector is built into the page — no query params.
- **Auto-detection heuristic** (`index.js:491`): when a file provides exactly `numSides` values all in range `1..numSides`, the code decides between raw rolls and aggregated counts by checking `sum >= numSides * numSides`.
- **CSV with optional header**: first line is treated as a header if its first cell is non-numeric (`index.js:400-404`).
- **JSON accepted formats**: flat array, `{rolls: []}`, `{data: []}`, or `{face: count, ...}` object.
- **Saved dice persist in localStorage** under key `fairDieDice` as an array of `{id, name, sides, counts, total, savedAt}`. Auto-saved entries (id prefix `auto_`) are created on each roll and used for page-load restore but hidden from the Saved Dice list. Explicitly saved entries (id prefix `saved_`) appear in the list and can be Loaded/Deleted. Saving with a matching name+sides overwrites the existing entry.
- **"Stats for nerds"** panel (`index.js:751`): a collapsible section below results showing Cramér's V effect size, Wilson 95% confidence intervals per face, and per-face binomial z-tests with continuity correction. Toggle state resets when switching modes or clearing rolls.
- **No local dependencies** — everything is browser-native. No `package.json`, no lockfile, no linter config.
- **Chart.js must stay loaded via `<script>` tag** in `index.html:91`. The `chart` global variable (`index.js:3`) holds the Chart.js instance and must be `destroy()`ed before creating a new one (`index.js:624-626`).
