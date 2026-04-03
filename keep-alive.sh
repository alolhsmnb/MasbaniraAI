#!/bin/bash
# Auto-restart dev server if it crashes
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..."
  bun run dev >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Dev server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
