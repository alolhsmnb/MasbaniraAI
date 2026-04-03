#!/bin/bash
# Keep-alive script for Next.js dev server
cd /home/z/my-project

while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Server died, restarting..." >> /tmp/keepalive.log
    rm -rf .next/cache
    nohup bun run dev > /tmp/next-dev.log 2>&1 &
    disown
    sleep 15
  fi
  sleep 5
done
