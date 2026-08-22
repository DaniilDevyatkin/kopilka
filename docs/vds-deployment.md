# Развёртывание Копилки на VDS

Этот сценарий рассчитан на один Linux VDS с публичным доменом. В production-контур входят:

- `app` — Next.js standalone под непривилегированным пользователем, read-only root filesystem;
- `db` — PostgreSQL во внутренней Docker-сети без опубликованного порта;
- `migrate` — одноразовый контейнер `prisma migrate deploy`;
- `caddy` — единственная публичная точка входа, автоматический HTTPS и HTTP → HTTPS redirect;
- persistent volumes для PostgreSQL, uploaded images, Next cache и TLS-данных Caddy.

## 1. Требования

- Ubuntu 24.04 LTS или другой актуальный Linux;
- 2 vCPU, 2–4 GB RAM и 20+ GB SSD для небольшого личного инстанса;
- домен или поддомен с A-записью на IPv4 VDS; AAAA добавляйте только при рабочем IPv6;
- открытые TCP-порты `22`, `80`, `443` и UDP-порт `443`;
- Docker Engine с Compose v2, Git, `curl` и `openssl`.

Установка Docker на Ubuntu выполняется из официального репозитория Docker. После установки проверьте:

```bash
docker version
docker compose version
```

Не публикуйте `5432`: база доступна только контейнерам production stack.

## 2. Первый запуск

Скопируйте репозиторий на сервер, например в `/opt/kopilka`, и перейдите в каталог:

```bash
cd /opt/kopilka
bash scripts/deploy-vds.sh kopim.devyatkinprod.ru admin@example.com
```

Первый запуск:

1. создаёт `.env.production` с mode `600`;
2. генерирует URL-safe пароль PostgreSQL и 128-символьный `SESSION_SECRET`;
3. проверяет Compose config;
4. собирает standalone application image и migration image;
5. запускает PostgreSQL, применяет migrations, затем запускает app и Caddy;
6. ожидает успешный `https://DOMAIN/api/health`.

`.env.production` не входит в Docker build context и игнорируется Git. Сохраните его отдельно в менеджере секретов: потеря `SESSION_SECRET` инвалидирует все существующие сессии.

Если DNS ещё не обновился, Caddy не сможет получить сертификат. Исправьте DNS/файрвол и повторите ту же команду: существующие данные и секреты сохранятся.

## 3. Обновление

Перед обновлением сделайте backup, замените исходный код и повторите deploy:

```bash
cd /opt/kopilka
bash scripts/backup-vds.sh
bash scripts/deploy-vds.sh
```

Скрипт не запускает seed и не пересоздаёт persistent volumes. Prisma применяет только отсутствующие migrations. Не используйте `prisma migrate dev` на сервере.

Полезные команды:

```bash
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs -f --tail=200 app caddy
docker compose --env-file .env.production -f compose.production.yml restart app
```

## 4. Backup

```bash
bash scripts/backup-vds.sh
```

Результат появится в `backups/<UTC timestamp>/`:

- `database.dump` — PostgreSQL custom dump;
- `uploads.tar.gz` — uploaded images;
- `SHA256SUMS` — контроль целостности.

Каталог `backups/` игнорируется Git. Ежедневно копируйте новые backup в зашифрованное внешнее хранилище. Пример cron в 03:20 UTC:

```cron
20 3 * * * cd /opt/kopilka && BACKUP_ROOT=/srv/kopilka-backups bash scripts/backup-vds.sh >> /var/log/kopilka-backup.log 2>&1
```

## 5. Восстановление

Восстановление изменяет данные, поэтому выполняйте его вручную только в окно обслуживания.

1. Проверьте checksums: `sha256sum -c SHA256SUMS`.
2. Остановите приложение и Caddy, оставив БД запущенной.
3. Сначала восстановите dump в отдельную временную БД и выполните smoke-проверку ledger totals.
4. Только после проверки переключайте production database или восстанавливайте основной экземпляр.
5. Разверните uploads в volume `kopilka_uploads` и снова запустите stack.

Не откатывайте уже применённую migration удалением таблиц. Для совместимого rollback верните предыдущий application image; изменение схемы выполняйте новой additive/forward-fix migration.

## 6. Проверка после деплоя

```bash
curl --fail --show-error https://kopim.devyatkinprod.ru/api/health
curl -I https://kopim.devyatkinprod.ru/manifest.webmanifest
curl -I https://kopim.devyatkinprod.ru/sw.js
```

Затем вручную проверьте на отдельном тестовом пользователе:

1. регистрацию, вход и logout;
2. создание карты и изменение баланса операцией;
3. создание хотелки;
4. загрузку и последующее чтение изображения;
5. установку PWA на телефоне и открытие в standalone mode.

## 7. Эксплуатационные правила

- Не редактируйте `.env.production` во время работающего deploy. После смены секрета перезапустите app.
- При компрометации `SESSION_SECRET` замените его, очистите таблицу sessions и повторно разверните приложение.
- При росте до нескольких app replicas перенесите uploaded images в S3-compatible storage и задайте общий `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` на build time.
- Для обновления PostgreSQL между major versions используйте официальный upgrade/backup-restore процесс, а не простую смену image tag.
- Ежемесячно тестируйте восстановление backup; наличие файла без теста восстановления не подтверждает его пригодность.
