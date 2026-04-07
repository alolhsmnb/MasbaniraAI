#!/bin/bash
# Minimal dev server - only runs Next.js, no db push (already synced)
cd /home/z/my-project

# Skip .next cache cleanup for faster restarts
while true; do
  echo "[$(date)] Starting Next.js dev server..."
  /home/z/my-project/node_modules/.bin/next dev -p 3000 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
