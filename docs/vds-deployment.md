# Развёртывание Копилки на малом VDS

Production-контур рассчитан на текущий VDS с диском 8.8 GB. На сервере **ничего не собирается** и `npm ci` не запускается:

- GitHub Actions собирает `.next/standalone`, добавляет один Node.js binary и публикует проверяемые SHA-256 артефакты;
- приложение работает как непривилегированный systemd-сервис `kopilka`;
- Caddy работает одним native binary и автоматически обслуживает HTTPS;
- в Docker остаётся только `postgres:18-alpine` с существующим volume `kopilka_postgres_data`;
- Prisma migrator скачивается только на время deploy и сразу удаляется;
- хранятся максимум две версии приложения и два локальных pre-deploy backup;
- Docker build cache, старые app/migrator/Caddy images, `.next` и `node_modules` на VDS удаляются;
- PostgreSQL ограничен 30 соединениями, 64 MB shared buffers и мягким WAL-пределом 256 MB с WAL compression;
- database volume никогда автоматически не удаляется.

## 1. Что должно быть готово

1. VDS работает на Ubuntu/Debian x86_64 и имеет Docker Engine с Compose v2.
2. A-запись `kopim.devyatkinprod.ru` указывает на IPv4 VDS. AAAA нужна только при реально настроенном IPv6.
3. Открыты TCP-порты 22, 80 и 443, при желании UDP 443 для HTTP/3.
4. В GitHub Actions workflow **Publish standalone production release** завершился зелёным. Он создаёт/обновляет release с тегом `production`.
5. Перед deploy свободно не менее 650 MB. Текущих 1.9 GB достаточно с большим запасом.

## 2. Первый запуск

На VDS:

```bash
cd /opt/kopilka
git pull --ff-only origin main
bash scripts/deploy-vds.sh kopim.devyatkinprod.ru YOUR_EMAIL
```

Если репозиторий или release приватный, скрипт сам попросит GitHub token с минимальным правом **Contents: read**. Token вводится скрыто, не попадает в shell history и сохраняется в `/root/.config/kopilka/github-token` с mode `600`. Для публичного release token не нужен.

Первый запуск автоматически:

1. создаёт `.env.production` с mode `600`, случайными URL-safe паролем PostgreSQL и `SESSION_SECRET`;
2. сохраняет существующий volume PostgreSQL и переносит старый `kopilka_uploads` в `/var/lib/kopilka/uploads`, если каталог ещё пуст;
3. запускает только PostgreSQL container;
4. создаёт сжатый backup перед migration;
5. скачивает три небольших release assets и проверяет SHA-256;
6. выполняет `prisma migrate deploy`, затем удаляет мигратор;
7. атомарно переключает symlink на новый standalone и проверяет `127.0.0.1:3000/api/health`;
8. переключает HTTPS на native Caddy и проверяет публичный endpoint;
9. только после успешной проверки удаляет старые Docker app/migrator/Caddy images и build cache; прежние uploads/cache/TLS volumes удаляются только после переноса uploads и успешного HTTPS healthcheck.

## 3. Обычное обновление

После зелёного production workflow:

```bash
cd /opt/kopilka
git pull --ff-only origin main
bash scripts/deploy-vds.sh
```

Скрипт не запускает seed и не пересоздаёт database volume. При неуспешном локальном healthcheck приложение автоматически возвращается на предыдущий standalone. Уже применённые migration не откатываются удалением схемы: исправления БД выпускаются новой forward migration.

## 4. Диагностика

```bash
systemctl status kopilka --no-pager
systemctl status caddy --no-pager
journalctl -u kopilka -n 100 --no-pager
journalctl -u caddy -n 100 --no-pager
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 db
curl --fail http://127.0.0.1:3000/api/health
curl --fail https://kopim.devyatkinprod.ru/api/health
df -h /
docker system df
```

## 5. Backup

```bash
cd /opt/kopilka
bash scripts/backup-vds.sh
```

Backup содержит:

- `database.dump` — сжатый PostgreSQL custom dump;
- `uploads.tar.gz` — пользовательские изображения;
- `SHA256SUMS` — контроль целостности.

Локальный backup не заменяет внешнюю копию. После создания перенесите его в зашифрованное внешнее хранилище. Deploy автоматически оставляет локально только два последних pre-deploy backup, чтобы диск не заполнялся.

## 6. Реальный бюджет диска

Основной расход после перехода:

| Компонент | Хранение |
|---|---:|
| PostgreSQL image + служебные слои Docker | обычно сотни MB |
| Данные PostgreSQL | фактический объём личных данных |
| Native Caddy | один binary, десятки MB |
| Два standalone releases с Node.js | обычно несколько сотен MB суммарно |
| Два сжатых backup | зависит от данных |
| Migrator | 0 MB между deploy |
| npm/node_modules/build cache на VDS | 0 MB между deploy |

Таким образом, прежний пик `npm ci`/`next build` и несколько production Docker images полностью исключены. PostgreSQL сохранён ради транзакций, constraints и финансовой целостности; переход на SQLite не требуется и не решает исходную ENOSPC-проблему сборки.

## 7. Проверка PWA после deploy

```bash
curl -I https://kopim.devyatkinprod.ru/manifest.webmanifest
curl -I https://kopim.devyatkinprod.ru/sw.js
```

Затем на тестовом пользователе вручную проверьте регистрацию, вход, создание карты, доход/расход, перевод, хотелку, logout и установку PWA с домашнего экрана.
