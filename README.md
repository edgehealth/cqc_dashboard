# Learning from CQC local authority assessments

Static site exported from a Claude Design canvas. No build step.

- `index.html` – National overview (same page as `Main.dc.html`)
- `Council.dc.html`, `Statement.dc.html`, `Method.dc.html` – the other pages
- `_runtime/` – scripts that render the pages
- `assets/` – logo
- `.nojekyll` – required on GitHub Pages; without it the `_runtime` folder is not served

## Deploy to GitHub Pages

1. Put these files at the root of a repository (keep `.nojekyll`).
2. Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site appears at `https://<owner>.github.io/<repo>/`.
