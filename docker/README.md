# EinsatzWerk mit Docker installieren

Voraussetzung: Docker Desktop unter Windows oder Docker Engine mit Compose unter Linux.

1. `.env.docker.example` nach `.env` kopieren.
2. In `.env` mindestens `DB_PASSWORD` ändern.
3. Einen Laravel-Schlüssel erzeugen:

   ```bash
   docker run --rm php:8.4-cli-alpine php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
   ```

   Den ausgegebenen Wert als `APP_KEY` in `.env` eintragen.

4. Alles starten:

   ```bash
   docker compose up -d --build
   ```

Weboberfläche: `http://localhost:3000`  
API / Superadmin: `http://localhost:8080`

Ersten Benutzer anlegen:

```bash
docker compose exec backend php artisan einsatzwerk:bootstrap
```

Aktualisierung:

```bash
git pull
docker compose up -d --build
```

Die Images `postgres`, `redis`, `nginx`, `php` und `node` sind Multi-Arch-Images und
funktionieren auf üblichen x86-64- und ARM64-Systemen.
