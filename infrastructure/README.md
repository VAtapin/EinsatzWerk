# EinsatzWerk server deployment

Target: a native Ubuntu server with Nginx, PHP-FPM, PostgreSQL, Redis,
Node.js and systemd. Production does not require Docker.

## 1. Provision

```bash
sudo REPOSITORY=https://github.com/VAtapin/EinsatzWerk.git \
  bash /path/to/EinsatzWerk/infrastructure/deploy/provision-ubuntu.sh
```

The script installs runtime packages, clones the repository, installs systemd
and the initial HTTP Nginx configuration, and creates protected environment
templates under `/var/www/einsatzwerk/shared`.

## 2. PostgreSQL

Choose a strong password and use the same value in `shared/backend.env`:

```bash
sudo -u postgres psql
CREATE ROLE einsatzwerk LOGIN PASSWORD 'CHANGE_ME';
CREATE DATABASE einsatzwerk OWNER einsatzwerk ENCODING 'UTF8';
\q
```

## 3. Secrets

Edit both files:

```bash
sudoedit /var/www/einsatzwerk/shared/backend.env
sudoedit /var/www/einsatzwerk/shared/web.env
```

Generate `APP_KEY` without writing it to the repository:

```bash
cd /var/www/einsatzwerk/current/apps/backend
php artisan key:generate --show
```

## 4. DNS and TLS

Create A/AAAA records for `einsatz-werk.de`, `app.einsatz-werk.de` and
`api.einsatz-werk.de`. Once they resolve to the server:

```bash
sudo certbot --nginx \
  -d einsatz-werk.de \
  -d app.einsatz-werk.de \
  -d api.einsatz-werk.de
```

## 5. First and subsequent deployments

```bash
sudo APP_DIR=/var/www/einsatzwerk/current \
  /var/www/einsatzwerk/current/infrastructure/deploy/deploy.sh
```

The deploy command is locked against concurrent runs, only accepts a
fast-forward update from `main`, installs locked dependencies, builds the
frontend with the production environment, runs migrations, fixes runtime
permissions, restarts services and performs local health checks.

Create the initial organization and user after the first successful deploy:

```bash
export EINSATZWERK_BOOTSTRAP_PASSWORD='a-long-one-time-password'
php artisan einsatzwerk:bootstrap --email=office@example.de
unset EINSATZWERK_BOOTSTRAP_PASSWORD
```
