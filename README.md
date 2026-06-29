# austinulrigg.github.io

Personal website + CV for Austin Ulrigg. Custom static site (HTML/CSS/JS), no build step.

## Structure
- `index.html` — About / home
- `research.html` + `research-genus-algorithm.html`, `research-thesis.html`
- `writing.html` + `writing-max-cut.html`, `writing-pearls.html`
- `teaching.html`, `tutoring.html`, `cv.html`
- `lab.html` — interactive Rotation Systems Lab (placeholder; built separately, then swapped in)
- `404.html`
- `css/style.css` — design system (cool palette, per-page gradients, glass cards, Fraunces + Inter Tight)
- `images/`, `files/` — assets and PDFs
- `.nojekyll` — tells GitHub Pages to serve files as-is (no Jekyll processing)

## Deploy (replace the existing GitHub Pages site) — when ready
1. Back up the current repo first (e.g. branch it or download a zip).
2. Remove the old Jekyll files from the repo root (`_config.yml`, `_pages`, `_posts`, `Gemfile`, etc.).
3. Copy everything from this folder into the repo root (including `.nojekyll`).
4. Commit and push to the default branch. GitHub Pages serves it within a minute or two.
5. No custom domain or base path is required — links are relative.
