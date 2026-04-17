#!/usr/bin/env bash
set -euo pipefail

N="${N:-4}"
TICKER_INTERVAL="${TICKER_INTERVAL:-20}"
REPO_ROOT="/Users/orlandocantoni/Desktop/QPP website"
LOG_DIR="$REPO_ROOT/namely-site/backend/logs"

mkdir -p "$LOG_DIR"

python3 - <<'PY'
import json, math, os
items = json.load(open("namely-site/backend/combined_daily_assets.json"))
n = int(os.environ.get("N", "4"))
size = math.ceil(len(items) / n)
for i in range(n):
    chunk = items[i * size : (i + 1) * size]
    with open(f"namely-site/backend/combined_daily_assets.part{i+1}.json", "w") as f:
        json.dump(chunk, f, indent=2)
    print(i + 1, len(chunk))
PY

PIDS=()
for i in $(seq 1 "$N"); do
  python3 -u namely-site/backend/qpp_daily_update.py \
    --download \
    --download-bars 30 \
    --daily-config "namely-site/backend/combined_daily_assets.part${i}.json" \
    --assets "namely-site/backend/combined_assets.json" \
    --output-dir "namely-site/data/levels" \
    --skip-analysis \
    --log-file "$LOG_DIR/update_30d_part${i}.log" &
  PIDS+=($!)
done

progress_ticker() {
  while :; do
    local running=0
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        running=1
        break
      fi
    done
    if [[ "$running" -eq 0 ]]; then
      return
    fi
    echo "---- progress $(date '+%H:%M:%S') ----"
    for i in $(seq 1 "$N"); do
      local log="$LOG_DIR/update_30d_part${i}.log"
      if [[ -f "$log" ]]; then
        local last
        last="$(awk '/^\[daily/ {line=$0} END{print line}' "$log")"
        if [[ -n "$last" ]]; then
          echo "part${i}: $last"
        else
          echo "part${i}: (no output yet)"
        fi
      else
        echo "part${i}: (log not created yet)"
      fi
    done
    sleep "$TICKER_INTERVAL"
  done
}

progress_ticker &
TICKER_PID=$!
wait "${PIDS[@]}"
kill "$TICKER_PID" 2>/dev/null || true

python3 -u namely-site/backend/qpp_daily_update.py \
  --assets "namely-site/backend/combined_assets.json" \
  --output-dir "namely-site/data/levels" \
  --write-ohlcv \
  --skip-analysis

python3 -u namely-site/backend/qpp_daily_update.py \
  --assets "namely-site/backend/combined_assets.json" \
  --output-dir "namely-site/data/levels" \
  --skip-analysis \
  --upload-ohlcv \
  --env "/Users/orlandocantoni/Desktop/QPP website/namely-site/.env.local" \
  --log-file "$LOG_DIR/upload_30d.log" &
UPLOAD_PID=$!
tail -f "$LOG_DIR/upload_30d.log" &
TAIL_PID=$!
wait "$UPLOAD_PID"
kill "$TAIL_PID" 2>/dev/null || true

# Warm the movers cache on the live site now that fresh OHLCV data is in Wasabi
ENV_FILE="/Users/orlandocantoni/Desktop/QPP website/namely-site/.env.local"
ADMIN_SECRET="$(grep '^ADMIN_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r\n')"

if [[ -n "$ADMIN_SECRET" ]]; then
  echo "---- warming movers cache $(date '+%H:%M:%S') ----"
  for MODEL in pro simple beta; do
    echo -n "  model=$MODEL ... "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "x-admin-secret: $ADMIN_SECRET" \
      "https://price-vault.com/api/movers?source=live&model=$MODEL&_=$(date +%s)")
    echo "HTTP $STATUS"
  done
  echo "---- movers cache warmed ----"
else
  echo "WARN: ADMIN_SECRET not found in $ENV_FILE — skipping movers cache warm"
fi
