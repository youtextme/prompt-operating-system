#!/usr/bin/env bash
# Prompt OS — one-command install (macOS / Linux)
set -euo pipefail
REPO="${PROMPT_OS_REPO:-https://github.com/youtextme/prompt-operating-system.git}"
BRANCH="${PROMPT_OS_BRANCH:-main}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ required. Install from https://nodejs.org/" >&2
  exit 1
fi

git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/repo" 2>/dev/null && {
  node "$TMP/repo/install.mjs" "$@"
  exit $?
}

curl -fsSL "https://github.com/youtextme/prompt-operating-system/archive/refs/heads/${BRANCH}.tar.gz" -o "$TMP/repo.tar.gz"
tar -xzf "$TMP/repo.tar.gz" -C "$TMP"
EXTRACTED=$(find "$TMP" -maxdepth 1 -type d -name 'prompt-operating-system*' | head -1)
node "$EXTRACTED/install.mjs" "$@"
