#!/bin/bash
cd /home/z/my-project
export PATH="/home/z/my-project/node_modules/.bin:$PATH"
while true; do
  ./node_modules/.bin/next dev -p 3000 2>&1
  echo "[DEV] Server exited, restarting in 3s..."
  sleep 3
done
