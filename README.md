# EinsatzWerk

Configurable Field Service Management platform for service, planning, and
field technicians.

## Product entry points

- Office: `/office/call-intake`
- Technician: `/technician/today`
- Superadmin: backend `/superadmin`
- API: backend `/api/v1`

There is no generic client Dashboard.

## Repository

```text
apps/
  backend/   Laravel 13, REST API, Filament Superadmin
  web/       Next.js 16, React 19, TypeScript, Metronic Tailwind
docs/
  product/   approved UI references and decisions
infrastructure/
  nginx/     direct-server reverse proxy templates
  systemd/   direct-server process templates
tools/
  legacy-analysis/
```

Docker is intentionally not used. The application is deployed and tested on
the target server with native PHP, PostgreSQL, Redis, Node.js, Nginx, and
systemd services.

## Backend

```bash
cd apps/backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

Create the first office account without putting its password into shell
history:

```bash
export EINSATZWERK_BOOTSTRAP_PASSWORD='use-a-secret-value'
php artisan einsatzwerk:bootstrap --email=office@example.de
unset EINSATZWERK_BOOTSTRAP_PASSWORD
```

Production legacy import:

```bash
php artisan legacy:import /secure/path/to/legacy-files
```

The directory must contain:

- `Kunden.txt`
- `lsArtikel.txt`
- `PLZ-Gebiet.xlsx`
- `Tourplan2017.xlsx`

Source rows and identifiers are retained. Re-running an unchanged source is
idempotent. Legacy source files must never be committed to Git.

## Frontend

```bash
cd apps/web
pnpm install
cp .env.example .env.local
pnpm build
pnpm start
```

## Deployment

Server templates are in `infrastructure/`. Secrets and server-specific values
belong in server environment files, not in the repository.
