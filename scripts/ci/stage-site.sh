#!/usr/bin/env bash
# Stage the built portfolio into public/ for the deploy (was inline in
# deploy.yml and deploy-staging.yml; moved 11-09 when the deploys became
# rendered from the oodim repo profile). Every dist-<name>/ goes to
# public/<name>/ (auto-derived, so a new product needs no entry here), then
# the landing page at the root.
set -euo pipefail
rm -rf public
shopt -s nullglob
staged=0
for d in dist-*/; do
  name="${d#dist-}"
  name="${name%/}"
  mkdir -p "public/$name"
  cp -r "$d"* "public/$name/"
  echo "staged dist-$name -> public/$name/"
  staged=$((staged + 1))
done
if [ "$staged" -eq 0 ]; then
  echo "::error::no dist-*/ dirs to stage — did the build run?"
  exit 1
fi
cp -r landing/. public/
