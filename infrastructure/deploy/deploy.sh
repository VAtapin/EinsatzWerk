#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/einsatzwerk/current}"
LOCK_FILE="${LOCK_FILE:-/var/lock/einsatzwerk-deploy.lock}"

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another EinsatzWerk deployment is already running."
  exit 1
}

cd "$APP_DIR"

git fetch --prune origin
git checkout main
git pull --ff-only origin main

cd "$APP_DIR/apps/backend"
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
php artisan config:clear

cd "$APP_DIR/apps/web"
pnpm install --frozen-lockfile
pnpm build

cd "$APP_DIR/apps/backend"
php artisan down --retry=30
trap 'php artisan up' EXIT
php artisan migrate --force
php artisan storage:link || true
php artisan optimize

sudo systemctl restart einsatzwerk-web
sudo systemctl restart einsatzwerk-worker
sudo systemctl restart einsatzwerk-scheduler

sudo systemctl reload nginx

php artisan up
trap - EXIT
