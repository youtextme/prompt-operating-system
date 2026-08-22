#!/bin/bash
# Prompt OS — one-command install (macOS/Linux)
set -euo pipefail

REPO="${PROMPT_OS_REPO:-https://github.com/youtextme/prompt-operating-system.git}"
BRANCH="${PROMPT_OS_BRANCH:-main}"
TMP=$(mktemp -d)

cleanup() {
    rm -rf "$TMP"
}
trap cleanup EXIT

if ! command -v node &> /dev/null; then
    echo "Node.js 20+ required. Install from https://nodejs.org/"
    exit 1
fi

cd "$TMP"
# Try git clone first
if git clone --depth 1 --branch "$BRANCH" "$REPO" repo 2>/dev/null; then
    node repo/install.mjs "$@"
else
    # Fallback to zip download
    curl -fsSL "https://github.com/youtextme/prompt-operating-system/archive/refs/heads/$BRANCH.zip" -o repo.zip
    unzip -q repo.zip
    cd prompt-operating-system-*
    node install.mjs "$@"
fi
