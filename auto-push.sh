#!/bin/bash
# Auto-push script - commit and push all changes to GitHub
cd /home/z/my-project

# Check if there are any changes
if [ -z "$(git status --porcelain)" ]; then
  echo "No changes to commit."
  exit 0
fi

# Stage all changes
git add -A

# Commit with timestamp
TIMESTAMP=$(TZ='Africa/Cairo' date '+%Y-%m-%d %H:%M:%S')
git commit -m "🚀 Auto-push: $TIMESTAMP

- Auto-committed changes"

# Push to GitHub
git push origin main 2>&1

echo "✅ Pushed to GitHub at $TIMESTAMP"
