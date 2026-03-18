#!/bin/bash
# Deploy script - run this on the server to pull changes and rebuild
# Usage: ./scripts/deploy.sh

set -e

echo "⬇️  Bajando cambios..."
git pull

echo "🔨 Reconstruyendo contenedores..."
docker compose --env-file .env.production up -d --build

echo "📋 Estado:"
docker compose --env-file .env.production ps

echo ""
echo "✅ Listo. Logs: docker compose --env-file .env.production logs -f"
