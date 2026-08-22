#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"
ENV_TEMPLATE="$ROOT_DIR/.env.production.example"
COMPOSE_FILE="$ROOT_DIR/compose.production.yml"
RUNTIME_ROOT="/opt/kopilka-runtime"
RELEASES_DIR="$RUNTIME_ROOT/releases"
SYSTEM_ENV_DIR="/etc/kopilka"
SYSTEM_ENV_FILE="$SYSTEM_ENV_DIR/kopilka.env"
UPLOADS_DIR="/var/lib/kopilka/uploads"
CACHE_DIR="/var/cache/kopilka"
BACKUP_ROOT="/var/backups/kopilka"
REPOSITORY="DaniilDevyatkin/kopilka"
RELEASE_TAG="production"
APP_ASSET="kopilka-app-linux-x64.tar.gz"
MIGRATOR_ASSET="kopilka-migrator-linux-x64.tar.gz"
CHECKSUM_ASSET="SHA256SUMS"
CADDY_VERSION="2.11.4"

fail() {
  printf 'Ошибка: %s\n' "$1" >&2
  exit 1
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите скрипт от root: sudo bash scripts/deploy-vds.sh"
[[ "$(uname -m)" == "x86_64" ]] || fail "Готовый артефакт сейчас выпускается для x86_64/amd64."
command -v docker >/dev/null 2>&1 || fail "Docker не установлен: он нужен только для PostgreSQL."
docker compose version >/dev/null 2>&1 || fail "Нужен Docker Compose v2."
command -v flock >/dev/null 2>&1 || fail "Не найден flock (пакет util-linux)."

exec 9>/run/lock/kopilka-deploy.lock
flock -n 9 || fail "Другой deploy уже выполняется."

read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r'
}

create_environment() {
  local domain="${1:-}"
  local email="${2:-}"

  [[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Первый запуск: bash scripts/deploy-vds.sh kopim.devyatkinprod.ru EMAIL"
  [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Укажите корректный email для TLS-сертификатов."
  command -v openssl >/dev/null 2>&1 || fail "Для генерации секретов нужен openssl."

  umask 077
  local postgres_password
  local session_secret
  postgres_password="$(openssl rand -hex 24)"
  session_secret="$(openssl rand -hex 64)"

  sed \
    -e "s/^DOMAIN=.*/DOMAIN=$domain/" \
    -e "s/^ACME_EMAIL=.*/ACME_EMAIL=$email/" \
    -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$postgres_password/" \
    -e "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" \
    -e "s/^VAPID_SUBJECT=.*/VAPID_SUBJECT=mailto:$email/" \
    "$ENV_TEMPLATE" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  printf 'Создан защищённый файл %s.\n' "$ENV_FILE"
}

install_runtime_packages() {
  local -a packages=(ca-certificates curl jq openssl tar)
  local -a missing=()
  local package
  local deadline

  for package in "${packages[@]}"; do
    if ! dpkg-query -W -f='${Status}' "$package" 2>/dev/null \
      | grep -q '^install ok installed$'; then
      missing+=("$package")
    fi
  done

  if (( ${#missing[@]} == 0 )); then
    printf 'Системные runtime-пакеты уже установлены; apt не запускаю.\n'
    return
  fi

  deadline=$((SECONDS + 600))
  while pgrep -x apt >/dev/null 2>&1 \
    || pgrep -x apt-get >/dev/null 2>&1 \
    || pgrep -x dpkg >/dev/null 2>&1 \
    || pgrep -f '^/usr/bin/unattended-upgrade' >/dev/null 2>&1 \
    || pgrep -f '^/usr/lib/apt/apt.systemd.daily' >/dev/null 2>&1; do
    (( SECONDS < deadline )) \
      || fail "apt/dpkg занят дольше 10 минут. Не удаляйте lock-файлы; проверьте: ps aux | grep -E '[a]pt|[d]pkg'"
    printf 'apt/dpkg занят системным обновлением; жду освобождения блокировки...\n'
    sleep 5
  done

  export DEBIAN_FRONTEND=noninteractive
  apt-get -o DPkg::Lock::Timeout=600 update
  apt-get -o DPkg::Lock::Timeout=600 install -y --no-install-recommends \
    "${missing[@]}"

  apt-get clean
  rm -rf -- /var/lib/apt/lists/*
}

install_native_caddy() {
  if [[ -x /usr/local/bin/caddy ]] \
    && /usr/local/bin/caddy version 2>/dev/null | grep -q "^v${CADDY_VERSION}"; then
    return
  fi

  local caddy_temp
  local archive="caddy_${CADDY_VERSION}_linux_amd64.tar.gz"
  local base_url="https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}"
  local checksum_line
  caddy_temp="$(mktemp -d /tmp/caddy-install.XXXXXX)"

  curl --fail --silent --show-error --location \
    "$base_url/caddy_${CADDY_VERSION}_checksums.txt" \
    > "$caddy_temp/checksums.txt"
  curl --fail --silent --show-error --location \
    "$base_url/$archive" \
    > "$caddy_temp/$archive"
  checksum_line="$(grep "  $archive\$" "$caddy_temp/checksums.txt" | head -n 1)"
  [[ -n "$checksum_line" ]] || fail "Не найден checksum Caddy $CADDY_VERSION."
  (cd "$caddy_temp" && printf '%s\n' "$checksum_line" | sha256sum --check -)
  tar -xzf "$caddy_temp/$archive" -C "$caddy_temp" caddy
  install -m 0755 "$caddy_temp/caddy" /usr/local/bin/caddy
  rm -rf -- "$caddy_temp"
}

github_headers=()
load_github_token() {
  local token_file="/root/.config/kopilka/github-token"
  local token="${GITHUB_TOKEN:-}"
  if [[ -z "$token" && -f "$token_file" ]]; then
    token="$(<"$token_file")"
  fi
  if [[ -n "$token" ]]; then
    github_headers=(-H "Authorization: Bearer $token")
  fi
}

fetch_release_json() {
  curl --fail --silent --show-error --location \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "${github_headers[@]}" \
    "https://api.github.com/repos/$REPOSITORY/releases/tags/$RELEASE_TAG"
}

ensure_release_access() {
  local token
  if release_json="$(fetch_release_json 2>/dev/null)"; then
    return
  fi

  [[ -t 0 ]] || fail "Не удалось получить GitHub Release. Передайте GITHUB_TOKEN с правом Contents: read."
  printf 'Для приватного репозитория нужен GitHub token с правом Contents: read.\n'
  read -r -s -p 'GitHub token: ' token
  printf '\n'
  [[ -n "$token" ]] || fail "Token не введён."

  install -d -m 0700 /root/.config/kopilka
  umask 077
  printf '%s' "$token" > /root/.config/kopilka/github-token
  chmod 0600 /root/.config/kopilka/github-token
  github_headers=(-H "Authorization: Bearer $token")
  release_json="$(fetch_release_json)" || fail "GitHub Release недоступен. Проверьте token и запуск workflow."
}

download_asset() {
  local asset_name="$1"
  local output_path="$2"
  local asset_url
  asset_url="$(jq -r --arg name "$asset_name" '.assets[] | select(.name == $name) | .url' <<<"$release_json" | head -n 1)"
  [[ -n "$asset_url" && "$asset_url" != "null" ]] || fail "В release нет файла $asset_name. Дождитесь зелёного workflow Publish standalone production release."

  curl --fail --silent --show-error --location \
    -H 'Accept: application/octet-stream' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "${github_headers[@]}" \
    "$asset_url" > "$output_path"
}

remove_old_compose_service() {
  local service="$1"
  local container_id
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    docker rm --force "$container_id" >/dev/null
  done < <(docker ps -aq \
    --filter 'label=com.docker.compose.project=kopilka' \
    --filter "label=com.docker.compose.service=$service")
}

prune_releases() {
  local -a releases=()
  local index
  local path
  mapfile -t releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
  for ((index=2; index<${#releases[@]}; index++)); do
    path="${releases[$index]}"
    [[ "$path" == "$RELEASES_DIR/"* ]] || fail "Отказ удаления неожиданного пути: $path"
    rm -rf -- "$path"
  done
}

prune_backups() {
  local -a backups=()
  local index
  local path
  mapfile -t backups < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
  for ((index=2; index<${#backups[@]}; index++)); do
    path="${backups[$index]}"
    [[ "$path" == "$BACKUP_ROOT/"* ]] || fail "Отказ удаления неожиданного пути: $path"
    rm -rf -- "$path"
  done
}

if [[ ! -f "$ENV_FILE" ]]; then
  create_environment "${1:-}" "${2:-}"
fi
chmod 600 "$ENV_FILE"

domain="$(read_env DOMAIN)"
email="$(read_env ACME_EMAIL)"
postgres_db="$(read_env POSTGRES_DB)"
postgres_user="$(read_env POSTGRES_USER)"
postgres_password="$(read_env POSTGRES_PASSWORD)"
session_secret="$(read_env SESSION_SECRET)"
[[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Некорректный DOMAIN в .env.production."
[[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Некорректный ACME_EMAIL."
[[ "$postgres_db" =~ ^[A-Za-z0-9_]+$ ]] || fail "POSTGRES_DB должен содержать только буквы, цифры и _."
[[ "$postgres_user" =~ ^[A-Za-z0-9_]+$ ]] || fail "POSTGRES_USER должен содержать только буквы, цифры и _."
[[ "$postgres_password" =~ ^[A-Za-z0-9_-]+$ ]] || fail "POSTGRES_PASSWORD должен быть URL-safe."
[[ ${#session_secret} -ge 64 ]] || fail "SESSION_SECRET должен содержать не менее 64 символов."

printf 'Устанавливаю маленький native runtime и Caddy (один раз)...\n'
install_runtime_packages
install_native_caddy

if ! id kopilka >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/kopilka --create-home --shell /usr/sbin/nologin kopilka
fi
if ! id caddy >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
fi
install -d -m 0755 "$RUNTIME_ROOT" "$RELEASES_DIR"
install -d -o kopilka -g kopilka -m 0700 "$UPLOADS_DIR" "$CACHE_DIR"
install -d -o caddy -g caddy -m 0700 /var/lib/caddy
install -d -m 0700 "$SYSTEM_ENV_DIR" "$BACKUP_ROOT"

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

printf 'Освобождаю безопасно удаляемый Docker build cache...\n'
docker builder prune --all --force >/dev/null 2>&1 || true

printf 'Запускаю единственный production-контейнер — PostgreSQL...\n'
"${compose[@]}" pull db
"${compose[@]}" up -d --wait db

legacy_uploads_copied=false
if docker volume inspect kopilka_uploads >/dev/null 2>&1 \
  && [[ -z "$(find "$UPLOADS_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  printf 'Переношу существующие uploads из старого Docker volume...\n'
  docker run --rm --entrypoint sh \
    --volume kopilka_uploads:/source:ro \
    --volume "$UPLOADS_DIR:/destination" \
    postgres:18-alpine \
    -c 'cd /source && tar -cf - . | tar -C /destination -xf -'
  chown -R kopilka:kopilka "$UPLOADS_DIR"
  legacy_uploads_copied=true
fi

printf 'Создаю компактный backup перед migration...\n'
BACKUP_ROOT="$BACKUP_ROOT" bash "$ROOT_DIR/scripts/backup-vds.sh"
prune_backups

load_github_token
ensure_release_access

temporary_dir="$(mktemp -d /tmp/kopilka-deploy.XXXXXX)"
trap 'rm -rf -- "$temporary_dir"' EXIT

available_bytes="$(df --output=avail -B1 "$RUNTIME_ROOT" | tail -n 1 | tr -d ' ')"
(( available_bytes >= 650000000 )) || fail "Для безопасного deploy нужно хотя бы 650 MB свободного места. Сейчас: $((available_bytes / 1024 / 1024)) MB."

printf 'Скачиваю готовый standalone, мигратор и checksums (npm ci на VDS не будет)...\n'
download_asset "$APP_ASSET" "$temporary_dir/$APP_ASSET"
download_asset "$MIGRATOR_ASSET" "$temporary_dir/$MIGRATOR_ASSET"
download_asset "$CHECKSUM_ASSET" "$temporary_dir/$CHECKSUM_ASSET"
(cd "$temporary_dir" && sha256sum --check "$CHECKSUM_ASSET")

app_stage="$temporary_dir/app"
migrator_stage="$temporary_dir/migrator"
mkdir -p "$app_stage" "$migrator_stage"
tar -xzf "$temporary_dir/$APP_ASSET" -C "$app_stage"
tar -xzf "$temporary_dir/$MIGRATOR_ASSET" -C "$migrator_stage"

version="$(tr -cd 'A-Fa-f0-9' < "$app_stage/VERSION" | cut -c1-40)"
[[ ${#version} -ge 7 ]] || fail "Некорректный VERSION в application artifact."
release_id="${version:0:12}-$(date -u +'%Y%m%dT%H%M%SZ')"
release_dir="$RELEASES_DIR/$release_id"
mv "$app_stage" "$release_dir"
chmod 0755 "$release_dir/bin/node"
chown -R root:root "$release_dir"

if [[ -e "$release_dir/.next/cache" || -L "$release_dir/.next/cache" ]]; then
  rm -rf -- "$release_dir/.next/cache"
fi
ln -s "$CACHE_DIR" "$release_dir/.next/cache"

database_url="postgresql://${postgres_user}:${postgres_password}@127.0.0.1:5432/${postgres_db}?schema=public"
printf 'Применяю Prisma migrations временным артефактом...\n'
(
  cd "$migrator_stage"
  NODE_ENV=production DATABASE_URL="$database_url" \
    "$release_dir/bin/node" node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
)
rm -rf -- "$migrator_stage" "$temporary_dir/$MIGRATOR_ASSET"

escape_systemd_value() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_systemd_env() {
  local key="$1"
  local value="$2"
  printf '%s="%s"\n' "$key" "$(escape_systemd_value "$value")" >> "$SYSTEM_ENV_FILE"
}

umask 077
: > "$SYSTEM_ENV_FILE"
write_systemd_env PORT "3000"
write_systemd_env HOSTNAME "127.0.0.1"
write_systemd_env DATABASE_URL "$database_url"
write_systemd_env SESSION_SECRET "$session_secret"
write_systemd_env APP_ORIGIN "https://$domain"
write_systemd_env TRUST_PROXY_HEADERS "true"
write_systemd_env STORAGE_DRIVER "$(read_env STORAGE_DRIVER)"
write_systemd_env STORAGE_LOCAL_DIRECTORY "$UPLOADS_DIR"
write_systemd_env STORAGE_BUCKET "$(read_env STORAGE_BUCKET)"
write_systemd_env STORAGE_REGION "$(read_env STORAGE_REGION)"
write_systemd_env STORAGE_ENDPOINT "$(read_env STORAGE_ENDPOINT)"
write_systemd_env STORAGE_ACCESS_KEY_ID "$(read_env STORAGE_ACCESS_KEY_ID)"
write_systemd_env STORAGE_SECRET_ACCESS_KEY "$(read_env STORAGE_SECRET_ACCESS_KEY)"
write_systemd_env NEXT_PUBLIC_VAPID_PUBLIC_KEY "$(read_env NEXT_PUBLIC_VAPID_PUBLIC_KEY)"
write_systemd_env VAPID_PRIVATE_KEY "$(read_env VAPID_PRIVATE_KEY)"
write_systemd_env VAPID_SUBJECT "$(read_env VAPID_SUBJECT)"
chmod 0600 "$SYSTEM_ENV_FILE"

previous_release="$(readlink -f "$RUNTIME_ROOT/current" 2>/dev/null || true)"
ln -sfn "$release_dir" "$RUNTIME_ROOT/current.next"
mv -Tf "$RUNTIME_ROOT/current.next" "$RUNTIME_ROOT/current"

install -m 0644 "$ROOT_DIR/deploy/kopilka.service" /etc/systemd/system/kopilka.service
systemctl daemon-reload
systemctl enable kopilka.service >/dev/null
systemctl restart kopilka.service

healthy=false
for _ in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  journalctl -u kopilka.service --no-pager --lines=100 || true
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$RUNTIME_ROOT/current.rollback"
    mv -Tf "$RUNTIME_ROOT/current.rollback" "$RUNTIME_ROOT/current"
    systemctl restart kopilka.service || true
  fi
  fail "Новый standalone не прошёл локальный healthcheck; выполнен откат приложения."
fi

printf 'Переключаю HTTPS на native Caddy...\n'
remove_old_compose_service caddy
install -d -o root -g caddy -m 0750 /etc/caddy
sed \
  -e "s/__DOMAIN__/$domain/g" \
  -e "s/__ACME_EMAIL__/$email/g" \
  "$ROOT_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
install -m 0644 "$ROOT_DIR/deploy/caddy.service" /etc/systemd/system/caddy.service
systemctl daemon-reload
systemctl enable caddy.service >/dev/null
systemctl restart caddy.service

public_healthy=false
for _ in {1..24}; do
  if curl --fail --silent --show-error --max-time 10 "https://$domain/api/health" >/dev/null 2>&1; then
    public_healthy=true
    break
  fi
  sleep 5
done
[[ "$public_healthy" == true ]] || fail "HTTPS healthcheck не прошёл. Проверьте DNS, firewall и: journalctl -u caddy -n 100"

printf 'Удаляю старые application-контейнеры и их тяжёлые образы...\n'
remove_old_compose_service app
remove_old_compose_service migrate
if [[ "$legacy_uploads_copied" == true ]]; then
  docker volume rm kopilka_uploads >/dev/null 2>&1 || true
fi
docker volume rm kopilka_next_cache kopilka_caddy_data kopilka_caddy_config >/dev/null 2>&1 || true
while IFS= read -r image_id; do
  [[ -n "$image_id" ]] || continue
  docker image rm "$image_id" >/dev/null 2>&1 || true
done < <(docker image ls --format '{{.Repository}} {{.ID}}' \
  | awk '$1 ~ /^ghcr.io\/daniildevyatkin\/kopilka/ {print $2}' \
  | sort -u)
docker image rm caddy:2-alpine >/dev/null 2>&1 || true
docker image prune --force >/dev/null 2>&1 || true

for generated_dir in "$ROOT_DIR/node_modules" "$ROOT_DIR/.next"; do
  [[ "$generated_dir" == "$ROOT_DIR/"* ]] || fail "Отказ очистки неожиданного пути: $generated_dir"
  [[ -e "$generated_dir" ]] && rm -rf -- "$generated_dir"
done

prune_releases

printf '\nГотово: https://%s\n' "$domain"
printf 'Приложение: native standalone; база: единственный Docker-контейнер PostgreSQL.\n'
printf 'Свободное место:\n'
df -h /
docker system df
