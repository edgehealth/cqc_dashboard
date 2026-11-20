# Instructions for Claude

## Commit authorship

Do not author or co-author commits as Claude in this repository.

- Before committing, set the git author and committer to the person you are
  working for in this session, using their GitHub username and their GitHub
  no-reply email address (`ID+username@users.noreply.github.com`). If you
  cannot determine these, ask them; do not guess and do not fall back to the
  default `Claude <noreply@anthropic.com>` identity.
- Do not add `Co-Authored-By`, `Claude-Session`, "Generated with" or any other
  Claude or AI attribution lines to commit messages or pull request
  descriptions.
- This identity is per session. Never reuse another contributor's name or
  email from the git history.

## Publishing

Pushes to `main` deploy straight to the public GitHub Pages site. The workflow
in `.github/workflows/static.yml` publishes only the top-level `*.html` files, `sitemap.xml`,
`_runtime/`, `assets/` and `data/`. Anything else in the repository is not
published.

## Data and tests

The dashboard data lives only in `data/*.js`; do not paste data into the pages.
Run `npm test` before pushing any change to the pages, the data or the
workflow. Update the baseline (`npm run test:update-baseline`) only for a
change the person you are working for intended, and say that you did.
