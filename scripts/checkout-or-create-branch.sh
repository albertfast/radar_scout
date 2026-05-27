#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${1:-iosbuild}"
BASE_BRANCH="${2:-main}"

echo "==> Fetching origin"
git fetch origin --prune

echo "==> Updating ${BASE_BRANCH}"
git checkout "${BASE_BRANCH}"
git pull --ff-only origin "${BASE_BRANCH}"

if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
  echo "==> Switching to existing local branch ${TARGET_BRANCH}"
  git checkout "${TARGET_BRANCH}"
else
  echo "==> Creating local branch ${TARGET_BRANCH} from ${BASE_BRANCH}"
  git checkout -b "${TARGET_BRANCH}"
fi

if git ls-remote --exit-code --heads origin "${TARGET_BRANCH}" >/dev/null 2>&1; then
  echo "==> Setting upstream to origin/${TARGET_BRANCH}"
  git branch --set-upstream-to="origin/${TARGET_BRANCH}" "${TARGET_BRANCH}" >/dev/null 2>&1 || true
  git pull --ff-only origin "${TARGET_BRANCH}" || true
else
  echo "==> Publishing ${TARGET_BRANCH} and setting upstream"
  git push -u origin "${TARGET_BRANCH}"
fi

echo "==> Done"
echo "Branch: $(git branch --show-current)"
echo "Upstream: $(git rev-parse --abbrev-ref --symbolic-full-name @{u})"
git status --short
