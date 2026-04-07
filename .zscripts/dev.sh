#!/bin/bash
cd /home/z/my-project

# Workaround: .config is a JuiceFS file that Prisma tries to load as directory
[ -f ".config" ] && [ ! -d ".config" ] && mv .config .config_juicefs_tmp
bun run db:push 2>/dev/null
[ -f ".config_juicefs_tmp" ] && mv .config_juicefs_tmp .config

rm -rf .next

while true; do
  /home/z/my-project/node_modules/.bin/next dev -p 3000 2>&1
  echo "[$(date)] RESTARTING..."
  sleep 3
done
