#!/usr/bin/env bash
set -euo pipefail
GW="${HOME}/.agents/prompt-os/enforce/gateway.mjs"
LOG="${HOME}/.agents/prompt-os/gateway.cloud.log"
PIDFILE="${HOME}/.agents/prompt-os/gateway.cloud.pid"
if [[ ! -f "$GW" ]]; then
  echo "POS gateway missing — skip"
  exit 0
fi
already_up() { curl -sf --max-time 2 "http://127.0.0.1:8555/health" >/dev/null 2>&1; }
if already_up; then
  echo "POS gateway already healthy on :8555"
  exit 0
fi
if [[ -f "$PIDFILE" ]]; then
  oldpid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "${oldpid}" ]] && kill -0 "$oldpid" 2>/dev/null; then
    :
  else
    rm -f "$PIDFILE"
  fi
fi
if ! already_up; then
  nohup node "$GW" >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
fi
for _ in $(seq 1 40); do
  if already_up; then
    echo "POS gateway healthy on :8555"
    exit 0
  fi
  sleep 0.25
done
echo "WARN: gateway not healthy; see ${LOG}" >&2
exit 0
