#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"
COMPOSE_FILE="$ROOT_DIR/compose.production.yml"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"

[[ -f "$ENV_FILE" ]] || { printf 'Не найден %s\n' "$ENV_FILE" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { printf 'Docker не установлен.\n' >&2; exit 1; }

read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1
}

postgres_user="$(read_env POSTGRES_USER)"
postgres_db="$(read_env POSTGRES_DB)"
stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
target="$BACKUP_ROOT/$stamp"
mkdir -p "$target"
chmod 700 "$target"

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

printf 'Создаю backup PostgreSQL...\n'
"${compose[@]}" exec -T db pg_dump \
  --username "$postgres_user" \
  --dbname "$postgres_db" \
  --format custom \
  --no-owner \
  --no-acl > "$target/database.dump"

printf 'Архивирую пользовательские изображения...\n'
docker run --rm --read-only \
  --volume kopilka_uploads:/source:ro \
  --volume "$target:/backup" \
  alpine:3.22 \
  tar -C /source -czf /backup/uploads.tar.gz .

(cd "$target" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
chmod 600 "$target"/*

printf 'Backup готов: %s\n' "$target"
printf 'Скопируйте его в зашифрованное внешнее хранилище.\n'
