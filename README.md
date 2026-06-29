# austinulrigg.github.io

Personal website + CV for Austin Ulrigg. Custom static site (HTML/CSS/JS), no build step.

## Pages
- `index.html` — About / home
- `research.html` (+ `research-genus-algorithm.html`, `research-thesis.html`)
- `writing.html` (+ `writing-max-cut.html`, `writing-pearls.html`)
- `teaching.html`, `tutoring.html`, `cv.html`
- `rotations.html` — interactive rotation-systems explorer (3D surface via Alexander Metzger's solver, used with permission)
- `lab.html` — redirect to `rotations.html` (kept so old links work)
- `404.html`, `css/style.css`, `images/`, `files/`, `.nojekyll`

## Deploy (replace the existing GitHub Pages site)
Your repo's default branch is **master**. Run in a terminal:

```bash
cd ~/Downloads

# 1) Clone your current repo — this also serves as your backup (full history kept)
git clone https://github.com/austinulrigg/austinulrigg.github.io.git repo-deploy
cd repo-deploy

# 2) Remove the old Jekyll files (keeps the .git history)
git rm -rqf .

# 3) Copy in the new site (dot at the end copies hidden files like .nojekyll)
cp -R ~/Downloads/austinulrigg.github.io/. .

# 4) Commit and publish
git add -A
git commit -m "Rebuild as custom static site"
git push origin master
```

GitHub Pages rebuilds within a minute. Visit https://austinulrigg.github.io and hard-refresh (Cmd-Shift-R).

If `git push` asks for a password, use a GitHub Personal Access Token (not your account password), or switch the remote to SSH:
`git remote set-url origin git@github.com:austinulrigg/austinulrigg.github.io.git`
