#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"
ENV_TEMPLATE="$ROOT_DIR/.env.production.example"
COMPOSE_FILE="$ROOT_DIR/compose.production.yml"

fail() {
  printf 'Ошибка: %s\n' "$1" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "Docker не установлен. См. docs/vds-deployment.md."
docker compose version >/dev/null 2>&1 || fail "Нужен Docker Compose v2."

if [[ ! -f "$ENV_FILE" ]]; then
  domain="${1:-}"
  email="${2:-}"
  [[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Первый запуск: ./scripts/deploy-vds.sh DOMAIN EMAIL"
  [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Укажите корректный email для TLS-сертификатов."
  command -v openssl >/dev/null 2>&1 || fail "Для генерации секретов нужен openssl."

  umask 077
  postgres_password="$(openssl rand -hex 24)"
  session_secret="$(openssl rand -hex 64)"

  sed \
    -e "s/^DOMAIN=.*/DOMAIN=$domain/" \
    -e "s/^ACME_EMAIL=.*/ACME_EMAIL=$email/" \
    -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$postgres_password/" \
    -e "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" \
    -e "s/^VAPID_SUBJECT=.*/VAPID_SUBJECT=mailto:$email/" \
    "$ENV_TEMPLATE" > "$ENV_FILE"
  printf 'Создан %s с правами доступа только для владельца.\n' "$ENV_FILE"
fi

chmod 600 "$ENV_FILE"

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

printf 'Проверяю production-конфигурацию...\n'
"${compose[@]}" config --quiet

printf 'Обновляю базовые production-образы в пределах зафиксированных major versions...\n'
"${compose[@]}" pull db caddy

printf 'Собираю образы...\n'
"${compose[@]}" build --pull app migrate

printf 'Запускаю PostgreSQL и ожидаю готовности...\n'
"${compose[@]}" up -d --wait db

printf 'Применяю Prisma migrations...\n'
"${compose[@]}" run --rm migrate

printf 'Запускаю приложение и HTTPS reverse proxy...\n'
"${compose[@]}" up -d --wait app caddy

domain="$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)"
if command -v curl >/dev/null 2>&1; then
  printf 'Проверяю https://%s/api/health...\n' "$domain"
  healthy=false
  for _ in {1..24}; do
    if curl --fail --silent --show-error --max-time 10 "https://$domain/api/health" >/dev/null 2>&1; then
      healthy=true
      break
    fi
    sleep 5
  done
  if [[ "$healthy" != true ]]; then
    "${compose[@]}" ps
    fail "HTTPS healthcheck не прошёл. Проверьте DNS, порты 80/443 и логи: docker compose --env-file .env.production -f compose.production.yml logs caddy app"
  fi
fi

"${compose[@]}" ps
printf '\nКопилка доступна: https://%s\n' "$domain"
