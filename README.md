# Learning from CQC local authority assessments

Static site exported from a Claude Design canvas. No build step.

Live at https://edgehealth.github.io/cqc_dashboard/

## Pages

- `index.html` – National overview
- `council.html` – Council profile
- `statements.html` – Quality statements
- `method.html` – Method

Each page holds its own markup, logic and data. The council data is repeated
in `index.html`, `council.html` and `statements.html`, so a data change must
be applied to all three.

## Other files

- `_runtime/` – scripts that render the pages
- `assets/` – logo, favicon, link-preview card and self-hosted fonts
- `sitemap.xml` – page list for search engines

## Viewing locally

Start a web server in this folder (for example `python3 -m http.server`) and
open `http://localhost:8000`. Opening the files directly does not work.

## Deploying

Pushes to `main` are published to GitHub Pages by
`.github/workflows/static.yml`. Only the top-level `*.html` files,
`sitemap.xml`, `_runtime/` and `assets/` are published.
