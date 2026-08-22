# Копилка

Mobile-first PWA для личных финансов: карты, ledger-операции, виртуальный резерв и финансовые хотелки. Деньги хранятся только как `bigint` в минорных единицах; клиент никогда не определяет `userId`.

## Локальный запуск

Требуются Node.js 22+, npm 10+, Docker Desktop.

```powershell
Copy-Item .env.example .env
docker compose up -d
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Откройте `http://127.0.0.1:3000`. Для проверки PWA используйте установленную версию или HTTPS; localhost/127.0.0.1 браузеры считают безопасным контекстом.

## Проверки

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev
```

## Production

Готовый вариант для одного Linux VDS включает PostgreSQL, автоматические Prisma migrations, приложение и Caddy с автоматическим HTTPS:

```bash
bash scripts/deploy-vds.sh kopim.devyatkinprod.ru admin@example.com
```

Перед первым запуском направьте A/AAAA-запись домена на VDS и откройте TCP 80/443 и UDP 443. Повторный запуск той же команды безопасно пересобирает образ, применяет только новые migrations и обновляет сервисы. Production seed не запускается.

Полная инструкция, backup и восстановление: [`docs/vds-deployment.md`](docs/vds-deployment.md). Readiness endpoint — `/api/health`.

Архитектура находится в `docs/architecture.md`, модель данных — в `docs/domain-model.md`, эксплуатационный порядок — в `docs/operations-runbook.md`.
