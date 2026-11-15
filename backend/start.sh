#!/usr/bin/env bash
set -e

# Paytm Soundbox Autonomous Merchant Agent Backend Startup Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load local API credentials without placing them in source control.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}

echo "=========================================================="
echo " Starting Paytm Soundbox Autonomous Merchant Agent Backend"
echo " Host: $HOST | Port: $PORT"
echo " Docs: http://$HOST:$PORT/docs"
echo " Health Check: http://$HOST:$PORT/health"
echo "=========================================================="

exec uvicorn app.main:app --host "$HOST" --port "$PORT" --reload
