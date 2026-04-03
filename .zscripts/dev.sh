#!/bin/bash
# Dev server startup script for PixelForge AI
# Managed by the system's start.sh

cd /home/z/my-project

# Install dependencies
echo "[DEV] Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# Setup database
echo "[DEV] Setting up database..."
bun run db:push

# Clean build cache for fresh start
rm -rf .next

# Start dev server with auto-restart on crash
echo "[DEV] Starting Next.js dev server..."
while true; do
  bun run dev
  echo "[DEV] Server exited, restarting in 3s..."
  sleep 3
done
