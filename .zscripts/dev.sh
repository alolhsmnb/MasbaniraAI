#!/bin/bash
# Dev server startup script for PixelForge AI
# Managed by the system's start.sh

cd /home/z/my-project

# Install dependencies
echo "[DEV] Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# Setup database
# Note: .config is a JuiceFS mount file (not a directory), Prisma v6 tries
# to load .config/prisma and crashes. Temporarily rename it during prisma commands.
echo "[DEV] Setting up database..."
if [ -f ".config" ] && [ ! -d ".config" ]; then
  mv .config .config_juicefs_backup
  bun run db:push
  mv .config_juicefs_backup .config
else
  bun run db:push
fi

# Clean build cache for fresh start
rm -rf .next

# Start dev server with auto-restart on crash
echo "[DEV] Starting Next.js dev server..."
while true; do
  bun run dev
  echo "[DEV] Server exited, restarting in 3s..."
  sleep 3
done
