# Развёртывание «Копилки» на VDS с малым диском

Дата исследования: 22 августа 2026 года.

> Статус решения: реализован вариант B — GitHub Release со standalone, native systemd Node/Caddy и единственный PostgreSQL container. Разделы ниже сохраняют исходное сравнение вариантов, на основании которого принято решение.

## Исходные условия

По фактическому выводу с VDS корневой раздел имеет 8,8 ГБ, из которых свободно около 1,9 ГБ. Локальная сборка Docker остановилась на `npm ci` с `ENOSPC`. Это ограничение диска, а не ошибка npm и не нехватка оперативной памяти.

На момент начала исследования в репозитории уже был включён `output: "standalone"`, а production-образ приложения публиковался в GHCR. В итоговой реализации GHCR application images заменены более компактным standalone release.

## Подтверждённые факты из первичных источников

### Next.js standalone

- Next.js умеет трассировать runtime-зависимости и создавать `.next/standalone`, куда копируются только файлы, необходимые production-серверу, включая выбранные зависимости из `node_modules`. Папка запускается командой `node server.js` и не требует установки полного `node_modules` на сервере. `public` и `.next/static` нужно добавить к артефакту отдельно. [Next.js: `output: 'standalone'`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- Next.js требует Node.js версии не ниже 20.9. [Next.js: system requirements](https://nextjs.org/docs/app/getting-started/installation)
- systemd может запускать обычный foreground-процесс через `ExecStart`; upstream рекомендует `Type=exec` для долгоживущих сервисов, а `Restart=on-failure` — для автоматического восстановления после ошибки. `WorkingDirectory` и `EnvironmentFile` позволяют задать каталог релиза и runtime-секреты. [systemd: service unit source](https://github.com/systemd/systemd/blob/main/man/systemd.service.xml), [systemd: execution environment source](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml), [Ubuntu Server: systemd files](https://ubuntu.com/server/docs/explanation/software/changing-package-files/)
- Официальный пакет Caddy для Debian/Ubuntu устанавливает Caddy как systemd-сервис. Это позволяет не держать отдельный Docker-образ и контейнер прокси. [Caddy: install](https://caddyserver.com/docs/install), [Caddy: running as a service](https://caddyserver.com/docs/running)

### Внешняя Docker-сборка и registry

- GitHub Actions официально поддерживает сборку Docker-образа на GitHub-hosted runner и публикацию в GHCR через `docker/build-push-action`, `GITHUB_TOKEN` и разрешение `packages: write`. [GitHub: publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- VDS может скачать готовый образ с registry через `docker pull`/`docker compose pull`, то есть сборка и `npm ci` на VDS не нужны. Docker также позволяет закрепить образ по неизменяемому digest. [Docker: image pull](https://docs.docker.com/reference/cli/docker/image/pull/), [Docker: compose pull](https://docs.docker.com/reference/cli/docker/compose/pull/)
- GitHub Actions позволяет сохранить standalone-сборку как workflow artifact, а затем скачать её через GitHub CLI. Это даёт вариант доставки без Docker-образа приложения. [GitHub: workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts), [GitHub: downloading artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)

### Внешний PostgreSQL

- Prisma работает с PostgreSQL по обычному connection URL, где хост БД может находиться на другой машине или у managed-провайдера. [Prisma: PostgreSQL connection URL](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql)
- Prisma Postgres выдаёт pooled URL для запросов приложения и direct URL для миграций и административных инструментов. [Prisma Postgres: connecting](https://www.prisma.io/docs/postgres/database/connecting-to-your-database)
- Supabase рекомендует direct connection для постоянного backend на VM и миграций, а session pooler — как альтернативу для постоянного backend на IPv4-only сети. [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Neon поддерживает pooled и direct connection strings; в его документации direct connection рекомендован для миграций и `pg_dump`. [Neon: connection pooling](https://neon.com/docs/connect/connection-pooling)
- Prisma рекомендует применять production migrations в CI/CD через `prisma migrate deploy`, а не вручную с локального компьютера. [Prisma: deploy migrations](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-migrations-from-a-local-environment)

### Контроль диска Docker

- `docker builder prune` удаляет build cache; `docker system prune` удаляет неиспользуемые контейнеры, сети, образы и build cache. Volumes не удаляются без отдельного `--volumes`. [Docker: builder prune](https://docs.docker.com/reference/cli/docker/builder/prune/), [Docker: system prune](https://docs.docker.com/reference/cli/docker/system/prune/)
- `docker system df -v` показывает фактическое и reclaimable использование диска Docker. [Docker: system df](https://docs.docker.com/reference/cli/docker/system/df/)
- Docker `json-file` без лимитов может расти неограниченно. `max-size` и `max-file` включают ротацию. Альтернативный драйвер `local` оптимизирован по использованию диска и по умолчанию сжимает ротированные логи. [Docker: JSON logging driver](https://docs.docker.com/engine/logging/drivers/json-file/), [Docker: local logging driver](https://docs.docker.com/engine/logging/drivers/local/)
- `docker compose down` без `-v` не удаляет именованные volumes; флаг `-v` удаляет их. [Docker: compose down](https://docs.docker.com/reference/cli/docker/compose/down/)
- BuildKit поддерживает garbage collection с ограничением объёма cache. Это полезно на ограниченном диске, но не делает локальную Next.js-сборку бесплатной по временному месту. [Docker: build garbage collection](https://docs.docker.com/build/cache/garbage-collection/)

## Инженерная оценка вариантов

Следующие выводы являются оценкой применимости к данному VDS, а не дословными утверждениями источников.

| Вариант | Что остаётся на VDS | Потребность в диске | Сложность | Оценка для 1,9 ГБ свободного места |
|---|---|---:|---:|---|
| A. Сборка в GitHub Actions, pull готовых Docker-образов | Docker Engine, app image, migrator image на время миграции, PostgreSQL image/data, Caddy image | Средняя/высокая | Низкая, уже подготовлено | Возможен только если итоговые образы помещаются с запасом; долгосрочно тесно |
| B. Standalone artifact + Node.js + systemd; PostgreSQL остаётся локальным | Node runtime, standalone-релиз, PostgreSQL, Caddy | Ниже A | Средняя | Наиболее практичный вариант без переноса БД |
| C. Standalone + systemd + внешний managed PostgreSQL | Node runtime, standalone-релиз, Caddy, uploads | Самая низкая и предсказуемая | Средняя/высокая из-за миграции данных | Лучший долгосрочный вариант для неизменяемого диска |
| D. Docker app из registry + внешний managed PostgreSQL | Docker Engine, app image, Caddy image | Ниже A, выше C | Средняя | Приемлемый компромисс, если хочется сохранить Docker |
| E. Полная сборка Docker на VDS | Все build layers, npm cache, runtime images и данные | Очень высокая во время сборки | Низкая в настройке | Не рекомендована; уже подтверждён `ENOSPC` |

## Детали вариантов

### A. Оставить текущую схему: GitHub Actions → GHCR → VDS

Плюсы:

- минимальные изменения проекта;
- на VDS отсутствуют `npm ci`, `next build` и BuildKit cache;
- воспроизводимый образ можно закреплять по commit SHA или digest.

Ограничения:

- во время обновления Docker может одновременно хранить старые и новые слои;
- отдельно занимают место PostgreSQL, Caddy, migrator и данные БД;
- 1,9 ГБ — небольшой эксплуатационный запас для роста БД, uploads, журналов и обновлений ОС.

Вывод: этот вариант стоит попробовать первым только после успешной публикации небольшого runtime-образа. Перед pull нужно удалить неиспользуемый build cache и старые неактивные образы, но не volumes. Если pull снова завершится `ENOSPC`, дальнейшая чистка не решает архитектурную причину — нужен вариант B или C.

Универсального правила «1,9 ГБ достаточно для pull» нет: требуемое место зависит от размера и общих слоёв старого и нового образов. Размер следует измерить в registry/CI, а свободное место — через `df` и `docker system df -v`.

### B. Доставлять `.next/standalone`, запускать через systemd

Предлагаемая схема:

1. GitHub Actions выполняет `npm ci`, `prisma generate` и `next build` на Linux runner.
2. В артефакт помещаются `.next/standalone`, `.next/static` и `public`.
3. VDS скачивает один сжатый release-архив и распаковывает его в `/opt/kopilka/releases/<commit>`.
4. Симлинк `/opt/kopilka/current` переключается на новый релиз после проверки.
5. systemd запускает `/usr/bin/node /opt/kopilka/current/server.js` с `EnvironmentFile=/etc/kopilka.env`.
6. Caddy работает нативным systemd-сервисом и проксирует на `127.0.0.1:3000`.
7. Миграция выполняется отдельным CI job до переключения релиза.

Почему это экономнее: на VDS нет Docker layers приложения, отдельного migrator image и app build cache. Для отката достаточно хранить один предыдущий release; после успешного health-check более старые релизы удаляются.

Риски:

- native Node-модули должны собираться на совместимом Linux runner и архитектуре VDS;
- секреты нельзя помещать в artifact;
- release-скрипт должен проверять checksum, health endpoint и не удалять активный релиз;
- во время распаковки одновременно существуют архив и новый релиз, поэтому размер артефакта всё равно нужно измерять в CI.

Вывод: **это рекомендуемый следующий вариант**, если pull Docker-образа не помещается, а PostgreSQL пока нужно оставить на VDS.

### C. Вынести PostgreSQL наружу

Внешняя БД убирает с VDS PostgreSQL image/package, рабочие данные, WAL и локальные database backups. На сервере остаётся только приложение, proxy и пользовательские uploads.

Безопасная последовательность перехода:

1. сделать согласованный `pg_dump` текущей БД;
2. создать managed PostgreSQL в близком регионе;
3. восстановить dump через direct connection;
4. применить `prisma migrate deploy` через direct URL в CI;
5. направить приложение на runtime URL (direct или pooler в соответствии с рекомендацией провайдера);
6. проверить пользователей, ledger, goals и sessions;
7. только после проверки и резервной копии остановить локальный PostgreSQL;
8. локальный volume удалять отдельно и только после явно подтверждённого восстановления.

Риски: зависимость от внешней сети и провайдера, возможная задержка запросов, тарифные лимиты и необходимость защищать connection strings. Managed DB нужно выбирать в географически близком регионе.

Вывод: **это наиболее устойчивое решение**, если VDS нельзя расширить и приложение должно жить на нём долго.

### D. Оставить Docker только для приложения

Компромиссный вариант: PostgreSQL переносится к managed-провайдеру, приложение продолжает скачиваться готовым образом из GHCR. Он требует меньше переделок deploy-процесса, но сохраняет Docker image store и временную потребность в месте при обновлении образа.

Вывод: предпочтительнее полного Docker Compose на малом диске, но менее экономен, чем standalone + systemd.

## Что не решает проблему

- Swap помогает при нехватке RAM, но не исправляет `ENOSPC` на файловой системе.
- Обновление npm не освобождает место и не устраняет ошибку записи на диск.
- Постоянный `docker system prune -a` уменьшает накопившийся мусор, но не меняет минимальное место, необходимое для runtime images и их обновления.
- Static export не подходит текущей «Копилке»: приложение использует server-side session, Prisma, Server Actions и динамические серверные запросы, поэтому ему нужен Node.js runtime.
- Удаление Docker volumes ради нескольких гигабайт без подтверждённого backup/restore может уничтожить PostgreSQL и uploads.

## Рекомендация

1. **Краткосрочно:** завершить публикацию готового runtime image в GHCR и один раз проверить его фактический compressed/uncompressed размер в GitHub Actions до pull. На VDS не собирать ничего.
2. **Если образ не помещается:** перейти на доставку `.next/standalone` как GitHub artifact/release и запуск Node через systemd; Caddy установить нативным пакетом. PostgreSQL временно оставить там, где он уже работает.
3. **Для нормальной долгосрочной эксплуатации:** вынести PostgreSQL в managed service и оставить VDS только для standalone Node-приложения, Caddy и uploads.
4. Независимо от варианта: сохранить ротацию логов, держать только текущий и один предыдущий release/image, не использовать `--volumes` при автоматической очистке, а migrations выполнять через CI.

Итоговый выбор для диска 8,8 ГБ без возможности расширения: **standalone + systemd + внешний PostgreSQL** даёт наибольший запас и минимальный рост занятого места. Если перенос БД сейчас нежелателен, оптимальный промежуточный шаг — **standalone + systemd при локальном PostgreSQL**.
