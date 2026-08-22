# Возможность перехода «Копилки» с PostgreSQL на SQLite

Дата проверки: 22 августа 2026 года.

## Краткий вердикт

**Технически перейти можно, но прямо сейчас переводить production-финансы на SQLite с текущим стеком Prisma 7.9.1 небезопасно.**

SQLite действительно уменьшит занимаемое место: исчезнут сервер PostgreSQL, его Docker-образ, отдельный volume и служебные файлы PostgreSQL. Для одного экземпляра приложения и небольшой нагрузки SQLite является нормальным классом решения: официальный сайт SQLite относит его к подходящим базам для большинства сайтов с низкой и средней нагрузкой ([Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)).

Однако это **не исправит исходную ошибку `npm ci` само по себе**: ошибка возникла во время сборки приложения, до запуска базы. Для VDS с диском 8,8 ГБ SQLite имеет смысл только вместе со схемой `GitHub Actions -> .next/standalone -> Node.js/systemd`, без `npm ci`, `next build` и Docker build на VDS.

Блокирующий риск текущего варианта: проект использует Prisma 7.9.1, а официальный репозиторий Prisma содержит открытый отчёт именно для `@prisma/adapter-better-sqlite3` 7.9.1 о том, что `SQLITE_BUSY` во время `COMMIT` может повредить состояние соединения и привести к потере записей, которые приложение считало сохранёнными ([prisma/prisma#29933](https://github.com/prisma/prisma/issues/29933)). Для обычного контентного сайта это уже серьёзно; для ledger, переводов и резервов это неприемлемо.

Поэтому безопасный порядок выбора такой:

1. Сейчас — не менять финансовую БД только ради срочного деплоя; убрать сборку с VDS и доставлять standalone-артефакт.
2. SQLite рассматривать после исправления указанной проблемы в используемой версии Prisma/адаптера либо после выбора и проверки другого поддерживаемого SQLite-драйвера.
3. Переход выполнять отдельной миграционной задачей с новым migration history, переработанными DB-инвариантами и полным concurrency-набором тестов.

## Что поддерживается

### Prisma 7 и локальный SQLite

Prisma 7 поддерживает `provider = "sqlite"`. Для локального файла официальный путь использует `@prisma/adapter-better-sqlite3`, URL вида `file:...` и передачу адаптера в `new PrismaClient({ adapter })` ([Prisma: SQLite connector](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite), [Prisma SQLite quickstart](https://www.prisma.io/docs/prisma-orm/quickstart/sqlite)).

В проекте сейчас используются:

- `prisma`, `@prisma/client` и `@prisma/adapter-pg` версии 7.9.1;
- `provider = "postgresql"`;
- `PrismaPg` в runtime, seed и тестах;
- PostgreSQL migration history из восьми миграций.

Для SQLite понадобятся `@prisma/adapter-better-sqlite3` и его native dependency вместо `@prisma/adapter-pg` и `pg`. Native binary должен собираться в CI под ту же Linux-архитектуру и libc, что и VDS, и попадать в standalone-релиз.

### Деньги в `BigInt`

Prisma отображает `BigInt` в SQLite `INTEGER` ([Prisma: SQLite type mappings](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite)). SQLite хранит целые значения как signed 64-bit integer; допустимый диапазон — от `-9223372036854775808` до `9223372036854775807` ([SQLite 64-bit integers](https://sqlite.org/c3ref/int64.html)). Следовательно, модель денег в minor units и TypeScript `bigint` сохраняется без перехода на float.

Обязательное ограничение: сумма каждой проводки, резерва, лимита, изображения и итог любого агрегата должна оставаться в signed 64-bit диапазоне. В PostgreSQL `sum(bigint)` возвращает `numeric`, а SQLite `sum()` бросает ошибку integer overflow при переполнении целых ([PostgreSQL aggregate types](https://www.postgresql.org/docs/15/functions-aggregate.html), [SQLite aggregate functions](https://www.sqlite.org/lang_aggfunc.html)). Значит, существующие запросы баланса и капитала нужно проверить на предельных наборах, а не заменять `sum()` на `total()` — `total()` возвращает float и нарушит денежный контракт.

### `DateTime`, target date, enum и JSON

Prisma поддерживает для SQLite `DateTime`, `Enum` и `Json`. При driver adapter новый SQLite-проект по умолчанию хранит `DateTime` как ISO 8601; `unixepoch-ms` нужен в основном для совместимости со старым native SQLite driver ([Prisma: SQLite connector](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite)).

Но PostgreSQL native types из текущей схемы непереносимы напрямую:

- все `@db.Uuid`, `@db.VarChar`, `@db.Char`, `@db.Timestamptz(3)` и `@db.Date` нужно удалить или заменить допустимой моделью SQLite;
- UUID останутся строками, но формат должен продолжить проверяться validation/`CHECK`;
- timestamp следует хранить единообразно в UTC ISO 8601;
- календарный `Goal.targetDate` больше не защищён отдельным PostgreSQL `DATE`, поэтому его семантику «дата без времени» надо закрепить `CHECK` и тестами сериализации;
- enum в SQLite хранится как `TEXT`, и документация Prisma отдельно предупреждает, что SQLite не обеспечивает enum-домен так же, как PostgreSQL; значения следует продублировать `CHECK (... IN (...))`, если нужна защита вне Prisma Client ([Prisma: SQLite enum validation](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite)).

SQLite использует динамическую типизацию, если таблица не объявлена `STRICT`; длина в `VARCHAR(191)` сама по себе не ограничивает текст ([SQLite datatypes](https://www.sqlite.org/datatype3.html)). Поэтому текущие максимальные длины остаются обязательной Zod/server validation, а критичные ограничения при необходимости дублируются `CHECK(length(...))`.

## Транзакции, ledger и конкурентность

SQLite обеспечивает serializable-транзакции, фактически сериализуя запись: одновременно возможен только один writer ([SQLite isolation](https://www.sqlite.org/isolation.html), [SQLite transactions](https://sqlite.org/lang_transaction.html)). Prisma также указывает, что SQLite поддерживает только isolation level `Serializable` ([Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)). Это совместимо с атомарной записью header + ledger entries + idempotency record внутри одной транзакции.

Но текущий код нельзя оставить без изменений:

- PostgreSQL `SELECT ... FOR UPDATE` в account, operation, transfer и goal services SQLite не поддерживает;
- casts `${value}::uuid` в raw SQL SQLite не поддерживает;
- обработчик повторов сейчас ориентирован на Prisma `P2034` и PostgreSQL SQLSTATE `40001`/`40P01`; для SQLite нужны распознавание `SQLITE_BUSY`/`SQLITE_BUSY_SNAPSHOT`, ограниченный retry с jitter и полный повтор бизнес-транзакции;
- production должен запускать **ровно один Node.js process**. Нельзя использовать cluster/PM2 с несколькими workers или несколько реплик, пока конкурентная модель не доказана тестами;
- длительные чтения и тяжёлые запросы внутри write transaction нужно исключить.

### WAL и timeout

Для web-приложения нужен локальный файл на обычной файловой системе VDS, не NFS/network mount. WAL позволяет читателям работать одновременно с writer, но writer всё равно только один; WAL также создаёт связанные `-wal` и `-shm` файлы ([SQLite WAL](https://sqlite.org/wal.html)).

Обязательная конфигурация каждого production-процесса:

- `PRAGMA foreign_keys = ON` и проверка, что вернулось `1`; SQLite не рекомендует полагаться на default ([SQLite foreign keys](https://www.sqlite.org/foreignkeys.html));
- `PRAGMA journal_mode = WAL` с проверкой фактического ответа `wal`;
- ненулевой busy timeout; `better-sqlite3` по умолчанию ждёт 5000 мс, но значение надо задать явно и покрыть нагрузочным тестом ([better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md));
- для финансовых данных — `PRAGMA synchronous = FULL`, пока отдельным решением не принят риск потери последнего commit при отключении питания. Документация SQLite говорит, что WAL + `NORMAL` сохраняет consistency, но может потерять durability при power loss ([SQLite PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous));
- контролируемые checkpoints и мониторинг размера `-wal`, потому что долгий reader способен мешать checkpoint и раздувать WAL ([SQLite WAL checkpoints](https://sqlite.org/wal.html#ckpt)).

Нужно также зафиксировать минимально допустимую версию SQLite. В официальной WAL-документации описан редкий WAL-reset bug, исправленный в SQLite 3.51.3 и некоторых backport-версиях ([SQLite WAL-reset bug](https://sqlite.org/wal.html#walreset)). Используемый native module обязан включать исправленную версию.

## DB-инварианты и миграции

### Что переносится

SQLite поддерживает:

- составные foreign keys и `CASCADE`/`RESTRICT`/`SET NULL` при включённом `foreign_keys` ([SQLite foreign keys](https://www.sqlite.org/foreignkeys.html));
- `CHECK` constraints;
- обычные, unique и partial indexes ([SQLite partial indexes](https://www.sqlite.org/partialindex.html));
- row triggers и `RAISE()` для отклонения операции ([SQLite triggers](https://sqlite.org/lang_createtrigger.html)).

Поэтому ownership-связи, уникальность idempotency key, запрет нулевых проводок, знаки резервов, жизненный цикл goals и большинство форматных проверок можно воспроизвести новым SQLite SQL.

PostgreSQL-выражения нужно переписать: `btrim` на `trim`, regex `~` — на допустимые SQLite-проверки или application validation, функции PL/pgSQL — на SQLite trigger SQL.

### Блокирующее различие для переводов

Сейчас balanced transfer обеспечивается PostgreSQL `DEFERRABLE INITIALLY DEFERRED CONSTRAINT TRIGGER`: проверка выполняется при commit, когда уже существуют header и обе проводки. SQLite поддерживает только row triggers, а не deferred constraint triggers общего вида ([SQLite trigger model](https://sqlite.org/lang_createtrigger.html)). Отложенными в SQLite могут быть foreign keys, но это не помогает проверить `COUNT = 2`, сумму `0` и роли проводок.

Нельзя просто сделать немедленный trigger на `ledger_entries`: после вставки первой из двух строк перевод временно несбалансирован и trigger отклонит корректную транзакцию. Нельзя и ослабить trigger до «проверять только если уже две строки»: тогда commit сможет сохранить одну проводку.

Надёжный вариант требует изменения модели:

1. Добавить operation lifecycle (`DRAFT`/`FINALIZED` либо отдельный `finalizedAt`).
2. Создать header в `DRAFT`.
3. Добавить обе проводки внутри одной transaction.
4. Последним statement перевести header в `FINALIZED`.
5. SQLite `BEFORE UPDATE` trigger разрешает финализацию только при двух entries, разных счетах, сумме `0` и правильных ролях/знаках.
6. Triggers запрещают изменение/удаление entries у finalized transfer и обратный перевод finalized operation в draft.
7. Все пользовательские выборки игнорируют draft; после rollback draft не останется.

Так атомарность и DB-level защита сохраняются без доверия только к приложению.

### Новый migration history обязателен

Prisma Migrate не умеет автоматически переключать provider: PostgreSQL SQL несовместим с SQLite SQL. Официальная процедура требует архивировать старую историю и создать новую initial migration; custom SQL приходится переносить вручную ([Prisma Migrate limitations](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues)).

Следовательно:

- существующие восемь PostgreSQL миграций нельзя выполнять на SQLite;
- нужен новый SQLite migration history и новый `migration_lock.toml`;
- initial migration надо создать `--create-only`, затем вручную добавить `CHECK`, partial indexes и triggers;
- будущие сложные изменения таблиц надо тестировать на копии: SQLite имеет ограниченный `ALTER TABLE` и для многих изменений пересоздаёт таблицу ([SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html));
- старую PostgreSQL историю нельзя редактировать задним числом; её нужно сохранить отдельно для аудита и восстановления.

## Перенос существующих данных

Автоматического преобразования `pg_dump` в SQLite для этой схемы нет. Безопасный перенос должен быть отдельной программой, использующей Prisma/typed records, а не замену строк в SQL dump.

Порядок:

1. Остановить мутации или включить maintenance/read-only mode.
2. Сделать проверяемый `pg_dump` и проверить восстановление.
3. Создать пустую SQLite DB новой миграцией.
4. Экспортировать данные PostgreSQL в стабильный промежуточный формат: `BigInt` как decimal string, timestamps как UTC ISO, target date как `YYYY-MM-DD`, enum как schema name.
5. Импортировать в порядке зависимостей внутри контролируемых транзакций.
6. Сверить количество строк по таблицам, пользователей/sessions, суммы ledger по каждому счёту, общий капитал, резервы по каждой цели, balanced transfers и idempotency records.
7. Запустить весь integration и concurrency набор на SQLite.
8. Только после успешной сверки переключить приложение; PostgreSQL backup оставить неизменяемым на срок отката.

## Резервное копирование

Копировать живой `.db` обычным `cp`/`rsync` небезопасно: копия может совместить страницы из разных состояний, а в WAL mode файлы `.db`, `-wal` и `-shm` образуют связанное состояние. SQLite рекомендует Online Backup API, `VACUUM INTO` или `sqlite3_rsync`; эти способы создают согласованный snapshot живой базы ([SQLite corruption prevention](https://www.sqlite.org/howtocorrupt.html#_backup_or_restore_while_a_transaction_is_active), [SQLite Backup API](https://www.sqlite.org/backup.html)).

Для этой VDS:

- хранить рабочую DB в постоянном каталоге, например `/var/lib/kopilka/kopilka.db`, вне release directory;
- после создания snapshot проверять `PRAGMA quick_check`/`integrity_check` и размер;
- отправлять зашифрованную копию **вне VDS**, потому что локальная копия не спасает от потери диска;
- хранить ограниченное число локальных временных копий и удалять их только после успешной внешней загрузки;
- регулярно выполнять пробное восстановление;
- перед release backup оценивать свободное место: snapshot временно требует примерно ещё один размер базы;
- никогда не отделять или вручную удалять активный `-wal` файл.

## Полный список обязательных изменений

1. Заменить datasource/adapter: PostgreSQL -> SQLite, `PrismaPg` -> проверенная версия SQLite adapter.
2. Удалить PostgreSQL packages и добавить Linux-compatible SQLite native dependency в CI artifact.
3. Удалить все PostgreSQL native type annotations из Prisma schema.
4. Создать отдельный SQLite migration history; вручную перенести все `CHECK`, partial indexes и triggers.
5. Переписать regex/trim/date constraints на SQLite SQL.
6. Ввести `DRAFT`/`FINALIZED` для DB-level balanced-transfer invariant.
7. Переписать 16 PostgreSQL raw-query мест: убрать `FOR UPDATE`, `::uuid` и PostgreSQL-specific SQL.
8. Перепроверить все `SUM(BigInt)` и граничные суммы на overflow без float fallback.
9. Перенастроить transaction retry на SQLite busy/conflict errors и протестировать double tap/concurrency.
10. Запускать один application process; DB-файл держать на локальной файловой системе.
11. На старте явно включать и проверять `foreign_keys`, WAL, timeout, synchronous и версию SQLite.
12. Переписать seed, integration/e2e test database helpers и CI, сейчас создающие PostgreSQL databases и `PrismaPg` clients.
13. Создать typed data migration и автоматическую финансовую сверку PostgreSQL -> SQLite.
14. Реализовать off-host consistent backups и регулярный restore test.
15. Провести fault-injection: kill -9/power-loss simulation, `SQLITE_BUSY`, заполнение диска, обрыв backup, crash между двумя entries и finalization.
16. Не удалять PostgreSQL и его backup до подтверждённого периода эксплуатации SQLite.

## Решение для проекта

Для личного приложения с одним Node-процессом SQLite **может стать хорошей конечной БД и существенно упростить маленькую VDS**, но это самостоятельная миграция архитектуры, а не лёгкая настройка деплоя.

На версии Prisma 7.9.1 переход сейчас имеет статус **no-go для production-финансов**, пока не устранён/обойдён подтверждённый риск транзакций `adapter-better-sqlite3`. После исправления адаптера решение можно пересмотреть при выполнении всех пунктов выше. До этого самый быстрый безопасный путь — standalone Node/systemd без сборки на VDS и сохранение PostgreSQL (локально или во внешнем managed service).
