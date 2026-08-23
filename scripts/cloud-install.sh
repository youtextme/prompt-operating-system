#!/usr/bin/env bash
# Cursor Cloud — install this checkout the same way PC runs install.sh | bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
unset npm_config_prefix || true
if [[ -d "${HOME}/.nvm/versions/node" ]]; then
  NVM_NODE="$(ls -d "${HOME}/.nvm/versions/node"/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "${NVM_NODE}" ]]; then
    export PATH="${NVM_NODE}:${PATH}"
  fi
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ required" >&2
  exit 1
fi
node "${ROOT}/install.mjs" --force
mkdir -p "${HOME}/.agents/prompt-os/bin"
cp -f "${ROOT}/bin/pos.mjs" "${HOME}/.agents/prompt-os/bin/pos.mjs"
test -f "${HOME}/.agents/prompt-os/INSTALL.json"
test -f "${HOME}/.agents/router/PROMPT-ROUTER.md"
test -f "${HOME}/.cursor/rules/00-prompt-os.mdc"
echo "Prompt OS cloud install OK (from this repo checkout)"
