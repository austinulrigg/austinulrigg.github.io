# austinulrigg.github.io

My personal site, [austinulrigg.com](https://austinulrigg.com). Hand-written HTML/CSS/JS, no build step, served by GitHub Pages.

- Pages: `index.html` (About), `research.html`, `cv.html`, `writing.html`, `teaching.html`, `tutoring.html`, `rotations.html`.
- Writing posts are native HTML. Math posts are authored as `post-NAME.src.html` and pre-rendered to `post-NAME.html` with KaTeX, so no math JavaScript runs in the browser.
- `rotations.html` is an interactive explorer for graph rotation systems; `layouts/` holds its precomputed embeddings.
- `css/style.css` is the design system; `images/` and `files/` hold figures and PDFs.

## Toroidal catalogue: Recent Additions

On the two-week catalogue review, record each new **published, verified** release
against its immediately preceding published snapshot. Skip reviews with no new
release. Use the public release timestamp and public contributor display names
confirmed by the maintainers, not submitter contact details or commit author
names inferred to be contributors. A release timestamp records when a batch
was published, not when its graphs were originally submitted. For example:

```sh
python3 scripts/update_toroidal_recent_additions.py \
  --previous 2026-10-12-r2 --release 2026-11-11 \
  --published-at 2026-11-11T18:52:53-08:00 \
  --credit "Alexander Metzger" --credit "Austin Ulrigg" \
  --source https://github.com/austinulrigg/austinulrigg.github.io/commit/b09a3afaabf0d9f1a8dd7f6ee4c56321ad4ea020
```

The script verifies the manifest checksums and compares canonical graph6 records
from both releases using the same canonicalization. It counts new graphs rather
than subtracting total sizes, takes minor-order flags from the newer release,
and keeps the latest six batches. It only updates
`data/toroidal/recent-additions.json`. Review that diff and commit it through
the normal GitHub Pages process. Neither this script nor the website imports
submissions or publishes anything automatically.
