#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash infrastructure/deploy/provision-ubuntu.sh"
  exit 1
fi

REPOSITORY="${REPOSITORY:-https://github.com/VAtapin/EinsatzWerk.git}"
APP_ROOT="${APP_ROOT:-/var/www/einsatzwerk}"
APP_DIR="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  acl ca-certificates curl git nginx postgresql redis-server unzip \
  php-cli php-fpm php-curl php-intl php-mbstring php-pgsql php-redis \
  php-xml php-zip certbot python3-certbot-nginx

if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@11.9.0 --activate

if ! command -v composer >/dev/null; then
  EXPECTED_CHECKSUM="$(curl -fsSL https://composer.github.io/installer.sig)"
  curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
  ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', '/tmp/composer-setup.php');")"
  [[ "$EXPECTED_CHECKSUM" == "$ACTUAL_CHECKSUM" ]] || {
    echo "Invalid Composer installer checksum."
    exit 1
  }
  php /tmp/composer-setup.php --quiet --install-dir=/usr/local/bin --filename=composer
fi

install -d -o www-data -g www-data "$APP_ROOT" "$SHARED_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPOSITORY" "$APP_DIR"
fi

if [[ ! -f "$SHARED_DIR/backend.env" ]]; then
  install -m 640 -o root -g www-data \
    "$APP_DIR/infrastructure/env/backend.env.example" "$SHARED_DIR/backend.env"
fi
if [[ ! -f "$SHARED_DIR/web.env" ]]; then
  install -m 640 -o root -g www-data \
    "$APP_DIR/infrastructure/env/web.env.example" "$SHARED_DIR/web.env"
fi
ln -sfn "$SHARED_DIR/backend.env" "$APP_DIR/apps/backend/.env"

PHP_FPM_SOCKET="$(find /run/php -maxdepth 1 -type s -name 'php*-fpm.sock' | sort -V | tail -n 1)"
if [[ -z "$PHP_FPM_SOCKET" ]]; then
  echo "No PHP-FPM socket found in /run/php."
  exit 1
fi
ln -sfn "$PHP_FPM_SOCKET" /run/php/php-fpm.sock

install -m 644 "$APP_DIR/infrastructure/systemd/"einsatzwerk-*.service /etc/systemd/system/
install -m 644 "$APP_DIR/infrastructure/nginx/einsatzwerk-http.conf.example" \
  /etc/nginx/sites-available/einsatzwerk
ln -sfn /etc/nginx/sites-available/einsatzwerk /etc/nginx/sites-enabled/einsatzwerk
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable --now postgresql redis-server
nginx -t
systemctl reload nginx

echo
echo "Provisioning complete."
echo "1. Edit $SHARED_DIR/backend.env and $SHARED_DIR/web.env"
echo "2. Create the PostgreSQL database/user described in infrastructure/README.md"
echo "3. Point DNS for app.einsatz-werk.de and api.einsatz-werk.de to this server"
echo "4. Run: certbot --nginx -d einsatz-werk.de -d app.einsatz-werk.de -d api.einsatz-werk.de"
echo "5. Run: APP_DIR=$APP_DIR $APP_DIR/infrastructure/deploy/deploy.sh"
