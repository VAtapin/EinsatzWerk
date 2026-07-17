#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/einsatzwerk/current}"
SHARED_DIR="${SHARED_DIR:-/var/www/einsatzwerk/shared}"
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
ln -sfn "$SHARED_DIR/backend.env" "$APP_DIR/apps/backend/.env"

cd "$APP_DIR/apps/backend"
set -a
# shellcheck disable=SC1091
source "$SHARED_DIR/backend.env"
set +a
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
php artisan config:clear

cd "$APP_DIR/apps/web"
set -a
# shellcheck disable=SC1091
source "$SHARED_DIR/web.env"
set +a
pnpm install --frozen-lockfile
pnpm build

cd "$APP_DIR/apps/backend"
php artisan down --retry=30
trap 'php artisan up' EXIT
php artisan migrate --force
php artisan optimize
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

sudo systemctl restart einsatzwerk-web
sudo systemctl restart einsatzwerk-worker
sudo systemctl restart einsatzwerk-scheduler

sudo systemctl reload nginx

php artisan up
trap - EXIT

curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null
curl --fail --silent --show-error -H 'Host: api.einsatz-werk.de' \
  http://127.0.0.1/up >/dev/null

echo "EinsatzWerk deployment completed: $(git -C "$APP_DIR" rev-parse --short HEAD)"
