#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo ""
echo "  ✦ Yazıcı v3.0.0"
echo ""

# Development mode (tsx, no build needed)
if command -v npx &> /dev/null; then
  npx tsx src/server.ts
else
  # Production: build first
  npm run build
  node dist/server.js
fi
