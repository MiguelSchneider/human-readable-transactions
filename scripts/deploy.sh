#!/usr/bin/env bash
# Re-deploy to GitHub Pages: build, then publish dist/ to the gh-pages branch.
# Pages is configured to serve from gh-pages (root). Run: npm run deploy
set -euo pipefail

REPO_URL="https://github.com/MiguelSchneider/human-readable-transactions.git"
PAGES_URL="https://miguelschneider.github.io/human-readable-transactions/"

cd "$(dirname "$0")/.."
echo "▶ Building…"
npm run build

tmp="$(mktemp -d)"
cp -r dist/. "$tmp"/
touch "$tmp/.nojekyll"   # don't run Jekyll on the output

cd "$tmp"
git init -q
git config user.name "MiguelSchneider"
git config user.email "miguel@securitize.io"
git checkout -q -b gh-pages
git add -A
git commit -qm "Deploy $(date -u +%FT%TZ)"
echo "▶ Publishing to gh-pages…"
git push -qf "$REPO_URL" gh-pages

echo "✓ Deployed → $PAGES_URL (Pages rebuild takes ~30-60s)"
