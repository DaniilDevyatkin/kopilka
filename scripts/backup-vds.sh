#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"
COMPOSE_FILE="$ROOT_DIR/compose.production.yml"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/kopilka}"
UPLOADS_DIR="${UPLOADS_DIR:-/var/lib/kopilka/uploads}"

fail() {
  printf 'Ошибка: %s\n' "$1" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || fail "Не найден $ENV_FILE"
command -v docker >/dev/null 2>&1 || fail "Docker не установлен."
command -v tar >/dev/null 2>&1 || fail "tar не установлен."

read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r'
}

postgres_user="$(read_env POSTGRES_USER)"
postgres_db="$(read_env POSTGRES_DB)"
stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
target="$BACKUP_ROOT/$stamp"

install -d -m 0700 "$BACKUP_ROOT" "$target"
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

printf 'Создаю сжатый backup PostgreSQL...\n'
"${compose[@]}" exec -T db pg_dump \
  --username "$postgres_user" \
  --dbname "$postgres_db" \
  --format custom \
  --compress=6 \
  --no-owner \
  --no-acl > "$target/database.dump"

printf 'Архивирую загруженные изображения...\n'
if [[ -d "$UPLOADS_DIR" ]]; then
  tar -C "$UPLOADS_DIR" -czf "$target/uploads.tar.gz" .
else
  tar -C "$target" -czf "$target/uploads.tar.gz" --files-from /dev/null
fi

(cd "$target" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
chmod 0600 "$target"/*

printf 'Backup готов: %s\n' "$target"
printf 'Скопируйте каталог во внешнее зашифрованное хранилище.\n'
