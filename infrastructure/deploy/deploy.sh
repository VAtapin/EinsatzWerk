#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/einsatzwerk/current}"

cd "$APP_DIR"

git fetch --prune origin
git checkout main
git pull --ff-only origin main

cd "$APP_DIR/apps/backend"
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
php artisan migrate --force
php artisan storage:link || true
php artisan optimize

cd "$APP_DIR/apps/web"
pnpm install --frozen-lockfile
pnpm build

sudo systemctl restart einsatzwerk-web
sudo systemctl restart einsatzwerk-worker
sudo systemctl restart einsatzwerk-scheduler

sudo systemctl reload nginx
