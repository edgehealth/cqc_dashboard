# Learning from CQC local authority assessments

Static site exported from a Claude Design canvas. No build step.

Live at https://edgehealth.github.io/cqc_dashboard/

## Pages

- `index.html` – National overview
- `council.html` – Council profile
- `statements.html` – Quality statements
- `method.html` – Method

Each page holds its own markup and logic. The data is shared.

## Data

- `data/councils.js` – the 152 council records (scores, rating, dates, page
  numbers, CQC report path)
- `data/statements.js` – the nine quality statements and their findings text
- `data/examples.js` – examples to learn from, quoted from the reports
- `data/quotes.js` – what CQC found, quoted from each report

Change data in these files only. Counts, averages and the headline tiles are
calculated from them. Findings written as prose (on the overview, the method
page and in `statements.js`) are not, but the tests fail if the figures in
them stop matching the data.

## Other files

- `_runtime/` – scripts that render the pages
- `assets/` – logo, favicon, link-preview card and self-hosted fonts
- `sitemap.xml` – page list for search engines

## Viewing locally

Start a web server in this folder (for example `python3 -m http.server`) and
open `http://localhost:8000`. Opening the files directly does not work.

## Tests

Needs Node 22 or later. Install once with `npm install` and
`npx playwright install chromium`, then run `npm test` (about two minutes).

- `tests/data.test.js` – the data is unchanged, well formed and consistent
  with the figures written into the prose
- `tests/render.test.js` – renders about 2,000 page states in a browser and
  compares them with `tests/baseline/render.json`
- `tests/navigation.test.js` – shareable links, back button, links between
  pages, and headline figures following the data
- `tests/publish.test.js` – the deploy workflow publishes everything the
  pages load

After an intended change to the data or to what the pages show, review the
failures, then run `npm run test:update-baseline` and commit the new baseline.

## Deploying

Pushes to `main` are published to GitHub Pages by
`.github/workflows/static.yml`. Only the top-level `*.html` files,
`sitemap.xml`, `_runtime/`, `assets/` and `data/` are published.
