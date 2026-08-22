# Архитектура PWA «Копилка»

## Статус документа

- Статус: действующий архитектурный контракт; foundation, PostgreSQL schema и базовые server-only домены реализованы, дальнейшие продуктовые этапы отслеживаются отдельно.
- Источник требований: `CODEX_KOPILKA_MASTER_PROMPT.md`, 2 422 строки, SHA-256 `6411F14E8938996A3714279DC333AAF5A133B88F3C208C293D7F749D22DADB08`.
- Дата фиксации: 2026-08-09; актуализирован 2026-08-11 после повторного аудита и hardening PostgreSQL infrastructure.
- Область: техническая архитектура, границы доверия, финансовые инварианты и правила реализации.
- Текущее состояние реализации отслеживается в `docs/implementation-status.md`; этот документ остаётся нормативным контрактом, а не снимком пустого репозитория.

Изменение решений, помеченных как инварианты, требует отдельной архитектурной записи, обновления `domain-model.md` и тестов, доказывающих сохранение финансовой корректности.

## 1. Контекст и цели

«Копилка» — персональный финансовый PWA без подключения к банковским API. Пользователь вручную ведёт счета, операции и виртуальные резервы на цели. Система обязана оставаться объяснимой: любой баланс восстанавливается из ledger, резерв не создаёт деньги, а финансовая мутация имеет доказуемый атомарный результат.

Приоритеты архитектуры в порядке важности:

1. Финансовая корректность и отсутствие двойного учёта.
2. Изоляция данных пользователей и безопасность сессий.
3. Восстанавливаемая история вместо скрытого переписывания баланса.
4. Тестируемость бизнес-логики вне UI.
5. Надёжный mobile-first PWA с безопасным read-only offline.
6. Поддерживаемые server/client boundaries и умеренный размер клиентского bundle.
7. Самостоятельный визуальный язык без готового icon pack.

## 2. Исходное и текущее состояние окружения

На момент первичного аудита репозиторий содержал только мастер-промпт; `AGENTS.md` и `.git` отсутствовали. Доступны Node.js 22.22.2, npm 10.9.7, Git 2.53.0, Docker 29.6.2 и Docker Compose 5.3.1. Локальный `psql` не установлен, поэтому локальная PostgreSQL предусмотрена через Docker Compose.

После foundation-этапа создан и проверен Next.js App Router каркас, зависимости зафиксированы `package-lock.json`, Prisma Client генерируется, чистые money/date/goal-calculation modules реализованы без UI/DB-зависимостей, а PostgreSQL 18 schema применяется реальными migrations. Server-only auth, onboarding, account, category, income/expense, transfer и goal services реализованы поверх DB-backed sessions и ledger. Продуктовые экраны счетов, главной, операций, целей, аналитики и профиля подключены к реальным read models и мутациям. Installable PWA имеет manifest, service worker, отдельный read-only offline fallback и минимальный IndexedDB snapshot без секретов; сквозные сценарии проверены в Chromium.

## 3. Технологический контракт

- Next.js с App Router и React.
- TypeScript в strict mode без подавления ошибок ради сборки.
- PostgreSQL как единственное production-хранилище финансовой истины.
- Prisma ORM, реальные migrations и constraints в SQL там, где DSL Prisma недостаточен.
- Zod для входных DTO и server-side validation.
- Argon2id для паролей.
- Собственные DB-backed sessions с хешированными токенами.
- Server Components для первичных запросов и рендеринга read models.
- Server Actions для first-party HTML-мутаций.
- Route Handlers только для upload/download, Web Push, PWA-specific endpoints и иных HTTP-контрактов, которым действительно нужен Request/Response API.
- Vitest для unit/integration и Playwright для end-to-end/visual проверок.
- Service worker, manifest и IndexedDB для PWA/offline слоя.
- CSS/Tailwind допускаются как инструменты, но не как готовая визуальная система.

Фактическая DB foundation зафиксирована в `prisma/schema.prisma` и семи реальных migrations: initial schema, 44 domain `CHECK` constraints и partial indexes, account hardening с ещё двумя `CHECK` и уникальным posting `(operationId, accountId)`, tenant/FK-index hardening, deferred transfer-balance triggers и ограничения жизненного цикла Goal. PostgreSQL самостоятельно защищает nonzero/positive money, sign-policy резервов, системные category slugs, session lifetime, безопасные image metadata, принадлежность reversal/supersession одному пользователю, неизменяемость completed Goal и финальное состояние transfer/reversal с ровно двумя взаимно компенсирующими проводками. Локальный Compose публикует PostgreSQL только на `127.0.0.1`, поэтому известный development credential не доступен из LAN.

Delete-policy задана явно:

- `CASCADE` применяется только к зависимому нефинансовому состоянию `Session`, `UserSettings`, `OnboardingState`, `NotificationPreference` и `PushSubscription`;
- `AuthAttempt.userId` получает `SET NULL`, сохраняя rate-limit/security history без удержания удалённого пользователя;
- `RESTRICT` защищает `Account`, `Category`, `FinancialOperation`, `LedgerEntry`, `Goal`, `GoalReservationEntry`, `IdempotencyKey`, `ImageAsset` и все составные ownership/self-reference связи от появления orphan или cross-user history.

## 4. Слои и направления зависимостей

```text
UI: src/app, src/components
        |
        v
Application: server actions, route handlers, use-case services
        |
        v
Domain: money, dates, ledger rules, goal calculations, policies
        |
        v
Infrastructure: Prisma repositories, sessions, storage, push, IndexedDB adapter
```

Правила:

- UI не импортирует Prisma и не вычисляет финансовую истину.
- Route/Server Action не содержит бизнес-логику: он аутентифицирует запрос, валидирует DTO, вызывает один application service и преобразует известные ошибки в безопасный ответ.
- Application service управляет транзакцией, ownership, idempotency и согласованным изменением нескольких сущностей.
- Domain-модули не зависят от React, Next.js, Prisma или браузера.
- Infrastructure реализует интерфейсы репозиториев и внешних адаптеров.
- Server-only модули маркируются и не могут попасть в client bundle.
- Денежные агрегаты формируются на сервере; клиент получает сериализованный minor-unit string и готовые доступные подписи, но не становится источником истины.

## 5. Server/Client boundary

### На сервере

- Сессия, userId и ownership.
- Password hashing, session rotation и rate limiting.
- Prisma и DB transactions.
- Валидация всех команд.
- Ledger, балансы, доступные средства, резерв и аналитические агрегаты.
- Idempotency и concurrency control.
- Проверка upload MIME/signature и storage metadata.
- Подготовка минимальных read models.

### На клиенте

- Интерактивные формы, sheets/dialogs и локальные pending-состояния.
- Client validation только для быстрого UX; сервер повторяет проверку.
- Theme/privacy preference и install prompt state.
- Визуализация полученных серверных агрегатов.
- IndexedDB snapshot для read-only offline.

На клиент нельзя отправлять passwordHash, сырой session token, auth secret, storage credentials, VAPID private key, stack trace, произвольные Prisma records или ledger другого пользователя.

## 6. Маршруты и guards

Реализованные маршруты:

```text
/
/login
/register
/onboarding
/app/home
/app/accounts
/app/accounts/[id]
/app/transactions
/app/goals
/app/goals/new
/app/goals/[id]
/app/analytics
/app/profile
```

Guard-порядок реализован в server-only `src/server/auth/route-guards.ts` и серверных layout-компонентах `(public-auth)`, `onboarding` и `app`:

1. Public route определяет наличие валидной server-side session.
2. Авторизованный пользователь с public auth route перенаправляется в `/onboarding` либо `/app/home`.
3. Private route без session перенаправляет на `/login`; произвольный client return path не принимается, поэтому open redirect невозможен.
4. Пользователь с незавершённым onboarding допускается только к onboarding, logout и необходимым служебным endpoints.
5. Завершённый onboarding не открывается как основной рабочий flow повторно.

Чистая матрица решений находится в `src/lib/navigation/routes.ts` и отдельно тестируется без Next.js/DB. Реальный guard всегда получает пользователя из server-side cookie → hashed DB session; client `userId` и client-флаг onboarding не участвуют. Неаутентификационная ошибка БД не маскируется под отсутствие сессии.

`/` является серверной точкой входа и перенаправляет в `/login`, `/onboarding` либо `/app/home` по той же модели. Динамические `/app/accounts/[id]` и `/app/goals/[id]` читают server-side ownership-scoped read models; отсутствующая и чужая сущность не раскрываются как разные случаи.

App shell использует один mobile/PWA-контракт на всех ширинах: Главная, История, центральное действие, Хотелки и Профиль. Отдельного desktop rail нет — на широком экране приложение показывает центрированный телефонный canvas шириной до 30rem, поэтому browser preview и установленное PWA не расходятся по иерархии, плотности и навигации. Центральное действие всегда открывает доступный `BottomSheet` с рабочими формами дохода, расхода, перевода, пополнения хотелки и переходом к созданию новой цели. Нижняя навигация резервирует место в контенте и учитывает `safe-area-inset-left/right/bottom`; viewport использует `viewport-fit=cover` и `interactive-widget=resizes-content`, не запрещая пользовательский zoom.

## 7. Аутентификация и сессии

- Логин нормализуется детерминированно и имеет уникальный индекс.
- Пароль хранится только как Argon2id hash; plaintext никогда не логируется и не возвращается.
- После успешной регистрации/login создаётся криптографически случайный session token.
- В cookie хранится непрозрачный raw token; в БД — только его криптографический hash.
- Cookie: `HttpOnly`, `SameSite=Lax` или более строгое совместимое значение, `Secure` в production, ограниченный path и lifetime.
- Login, смена пароля и чувствительное изменение account security ротируют session для защиты от fixation.
- Logout удаляет/отзывает серверную сессию и очищает локальный offline snapshot.
- Смена пароля отзывает остальные сессии по принятой политике; политика фиксируется в UI и тестах.
- Registration, login и password change защищены DB-backed rate limiting. In-memory limiter не считается production-защитой.
- Mutating actions проверяют same-origin/CSRF в соответствии с фактическим транспортом.
- Ошибка неизвестного логина не отличается внешне от ошибки пароля.

Фактическая реализация находится в `src/server/auth`, `src/server/actions/auth.ts` и `src/lib/auth`. Используется `argon2@0.45.1` с Argon2id, 19 MiB memory cost, двумя итерациями и 32-byte hash. Session token содержит 256 бит энтропии; PostgreSQL хранит только HMAC-SHA-256 token hash, а raw token существует только в hardened cookie и внутри server action до её установки. Некорректный raw token трактуется как отсутствующая сессия и не мешает безопасному login/logout. Lifetime — 30 дней. Смена пароля отзывает все активные сессии пользователя и выдаёт одну новую; login и регистрация отзывают предъявленную прежнюю сессию. Rate-limit события хранят только HMAC-псевдонимы логина/сетевого источника, action, outcome и время. Заголовки сетевого источника читаются только при явном `TRUST_PROXY_HEADERS=true`, когда deployment гарантирует их перезапись доверенным proxy; иначе они игнорируются, а subject-based DB-limit действует всегда.

Auth UI находится в `src/components/auth` и использует общий client-safe контракт из `src/features/auth`, не импортируя `server-only` код. Client validation нужна только для быстрого UX; каждый Server Action повторно выполняет Zod validation, same-origin проверку и вызывает server-only service. Формы используют native labels, password-manager autocomplete, inline `aria-invalid` errors, фокус на первом ошибочном поле и собственный `AppIcon` visibility toggle. `useActionState` даёт pending/disabled защиту от повторного submit; сетевые исключения преобразуются в нейтральное восстанавливаемое сообщение без stack trace. Registration всегда направляет в `/onboarding`, а login выбирает `/onboarding` или `/app/home` исключительно по серверному `OnboardingState`. Базовая валюта не спрашивается в auth-форме и остаётся ответственностью onboarding.

## 8. Деньги и сериализация

- Единица истины — целое количество minor units в PostgreSQL `bigint` и TypeScript `bigint`.
- JS `number`/float запрещён для хранения, сложения, вычитания и сравнения денег.
- Формы передают локализованную строку; `parseMoney` превращает её в bigint после строгой проверки.
- На JSON/React boundary bigint сериализуется как decimal string, а не небезопасный number.
- Форматирование выполняется централизованно с валютой и локалью.
- Проценты и коэффициенты могут вычисляться как целочисленные отношения или безопасные рациональные значения; итоговые деньги всегда округляются явно.
- Рекомендации накопления округляются вверх, когда округление вниз может не довести цель до target.
- Одна пользовательская учётная запись имеет одну base currency. Автоматической конвертации и неявного смешения валют нет.
- Перевод разрешён только между счетами одной валюты, пока не появится отдельная проверенная FX-модель.

## 9. Ledger как источник истины

`FinancialOperation` — заголовок бизнес-события. `LedgerEntry` — неизменяемая подписанная проводка по конкретному счёту.

Знаки проводок:

- income: положительная;
- expense/goal purchase: отрицательная;
- opening balance: подписанная введённая сумма;
- balance adjustment: подписанная delta;
- transfer: отрицательная source и равная положительная destination;
- reversal: проводки, точно противоположные исходным.

Баланс счёта:

```text
accountBalance = SUM(LedgerEntry.amountMinor)
```

Общий капитал:

```text
totalCapital = SUM(accountBalance всех не удалённых счетов пользователя)
```

Архивный счёт с ненулевым балансом продолжает учитываться в капитале и истории, но не принимает новые обычные операции. UI должен предложить перевести или скорректировать остаток перед архивом.

Опубликованные проводки не редактируются и не удаляются физически. Исправление создаёт в одной DB transaction:

1. компенсирующую operation с обратными проводками;
2. при редактировании — новую replacement operation;
3. связи `reversesOperationId`/`supersedesOperationId` для объяснимой истории.

Так balance всегда равен сумме всех проводок, а отмена не требует скрытого исключения строк из агрегата.

## 10. Атомарный перевод

Transfer — одна `FinancialOperation` с ровно двумя основными `LedgerEntry`:

```text
source:      -amount
destination: +amount
SUM:          0
```

Обе записи создаются, компенсируются и заменяются в одной DB transaction. До изменения блокируются счета в стабильном порядке идентификаторов, чтобы уменьшить риск deadlock. Проверяются session user, ownership обоих счетов, одна валюта, разные accountId и доступная сумма source. Частично записанный перевод невозможен.

## 11. Виртуальный резерв целей

`GoalReservationEntry` — отдельный неизменяемый ledger резервирования. Он не является `LedgerEntry` и не меняет баланс счёта или капитал.

```text
goalReserved   = SUM(GoalReservationEntry.amountMinor по цели)
accountReserved = SUM(... по source account и активным резервам)
totalReserved  = SUM(goalReserved активных целей)
freeMoney      = totalCapital - totalReserved
```

Знаки:

- contribution/initial reserve: положительный;
- withdrawal/release/reversal: отрицательный.

Инварианты:

- резерв цели никогда не отрицателен;
- резерв счёта не превышает разрешённые свободные собственные средства;
- обычный expense/transfer не может потратить зарезервированную часть debit/cash/savings/bank/custom счёта;
- contribution и withdrawal не создают `LedgerEntry`;
- архивирование/отмена активной цели атомарно освобождает весь её резерв;
- completed/archived goal имеет нулевой открытый резерв.

Резерв с credit account допускается только из положительной собственной части после учёта долга; кредитный лимит не считается накоплением.

## 12. Доступные средства и отрицательные балансы

Для обычных счетов:

```text
availableForSpending(account) = accountBalance - activeAccountReserved
```

Для debit, cash, savings, bank account и custom обычная расходная мутация разрешена, только если итоговый `availableForSpending >= 0`.

Для credit account отрицательный баланс допустим только при явно заданном `creditLimitMinor`. Доступный кредит вычисляется по отдельной политике; при отсутствии лимита уход ниже нуля запрещён. Кредитный лимит не входит в капитал и не может резервироваться на цель.

## 13. Атомарное завершение цели

В одной transaction и под блокировкой goal/payment account:

1. Проверяется session, ownership, статус и idempotency.
2. Определяется фактическая цена и payment account.
3. Создаются отрицательные reservation entries, закрывающие весь открытый резерв цели.
4. После освобождения резерва проверяется допустимость единственного expense с payment account.
5. Создаётся одна `FinancialOperation` покупки и одна отрицательная `LedgerEntry` на actual price.
6. Goal получает `COMPLETED`, `completedAt` и `actualPurchaseAmountMinor`.

Если цена меньше резерва, остаток становится свободным. Если больше — операция разрешена только при достаточных доступных средствах после освобождения. Резерв не превращается во второй расход, поэтому double charge невозможен.

## 14. Ownership и защита от IDOR

- Единственный источник текущего userId — проверенная server-side session.
- Client `userId` игнорируется и не входит в публичные mutation DTO.
- Каждый repository query начинается с user scope либо использует составной ключ `(id, userId)`.
- Где возможно, таблицы имеют `userId` и composite foreign keys, не позволяющие связать operation/entry/goal/account разных пользователей на уровне БД.
- Global categories отделены от user-owned categories явным owner/null contract.
- Upload, image metadata, push subscription, idempotency record и offline read model подчиняются тем же правилам.
- Не найденная и чужая сущность возвращают одинаковый безопасный `not found` результат.

## 15. Idempotency

Критические команды требуют client-generated mutation id:

- account creation/opening balance;
- income/expense;
- transfer;
- reconciliation;
- goal contribution/withdrawal;
- goal completion;
- edit/cancel финансовых операций.

В БД действует уникальность `(userId, scope, key)`. Запись содержит hash канонического запроса и ссылку/безопасный сериализованный результат.

- Повтор с тем же key и тем же request hash возвращает исходный результат без новой мутации.
- Тот же key с другим payload возвращает conflict.
- Idempotency record и бизнес-изменение фиксируются в одной DB transaction.
- Кнопка pending и client-side блокировка улучшают UX, но не заменяют серверную идемпотентность.

## 16. Транзакционность и конкуренция

DB transaction обязательна для transfer, reserve/unreserve, completion, reconciliation, reversal/replacement и onboarding-шагов, создающих несколько сущностей.

Стратегия:

- блокировать затрагиваемые account/goal rows;
- при нескольких счетах брать locks в стабильном порядке;
- вычислять balance/reserve внутри той же transaction после lock;
- использовать подходящий высокий isolation level или явные row locks;
- безопасно повторять только транзакции, завершившиеся serialization/deadlock error;
- уникальные constraints остаются последней линией защиты.

Для account, income/expense и transfer domains этот протокол реализован фактически. Transfer service блокирует все затронутые owned accounts в стабильном порядке UUID, использует Serializable transaction и ограниченно повторяет Prisma `P2034` либо PostgreSQL serialization/deadlock SQLSTATE `40001`/`40P01`. Idempotency record, operation headers и все entries фиксируются одной transaction. Future goal services обязаны использовать тот же lock protocol.

## 17. Даты и недельный план

- `occurredAt` хранится как UTC instant и отображается в timezone пользователя.
- `targetDate` хранится как календарная дата без преобразования в полуночный UTC instant.
- `UserSettings.timeZone` задаёт пользовательское today и границы периодов.
- Неделя: понедельник 00:00 — воскресенье 23:59:59.999 локального времени.
- Цель, созданная посреди недели, получает документированную pro-rata норму на оставшиеся календарные дни; следующая неделя полная.
- Расчёт today/tomorrow/past и переходы месяца/года выполняются чистыми helpers с инъекцией clock/timezone.

### Реализованный goal calculator

`src/lib/goals/calculations.ts` — чистый синхронный доменный модуль без React, Prisma, сети и скрытого clock. Вызывающая сторона сначала получает календарный `today` в IANA timezone пользователя и передаёт его явно вместе с `targetDate`. Все суммы принимаются и возвращаются как `bigint` minor units; промежуточные отношения считаются целочисленно, а денежный результат проверяется на диапазон PostgreSQL `bigint`.

Для `R = max(targetMinor - savedMinor, 0)` действуют следующие правила:

- progress хранится в целых basis points; raw значение может быть больше `10_000`, а отдельное capped значение безопасно для progress bar;
- календарное расстояние сегодня равно `0`, но период накопления включает текущий день и target date: `planningDays = differenceInCalendarDays(today, targetDate) + 1`;
- для будущей даты full-week темп равен `ceil(R × 7 / planningDays)`;
- текущая неполная неделя — период от `today` включительно до ближайшего воскресенья или target date, если она раньше; её норма равна `ceil(R × currentWeekDays / planningDays)`;
- полная неделя всегда понедельник–воскресенье; monthly approximation равна `ceil(weekly × 52 / 12)`;
- для deadline сегодня или в прошлом weekly/current-week/monthly recommendation равны `R`, то есть остаток считается подлежащим внесению сейчас без деления на ноль;
- каждое деление, создающее денежную рекомендацию, округляется вверх; уже достигнутая/overfunded цель возвращает нулевые рекомендации.

`availableMonthly = max(monthlyIncome - mandatoryMonthlyExpenses, 0)`. Feasibility определяется детерминированно: `comfortable` («комфортно»), если рекомендация не больше половины доступного бюджета; `strained` («напряжённо»), если она помещается в бюджет, но превышает половину; `unrealistic` («нереалистично»), если превышает доступный бюджет. Нулевая рекомендация всегда `comfortable`.

Без target date модуль строит 10/20/30% сценарии от дохода, округляет minor units вверх и отдельно сообщает, помещается ли вариант в `availableMonthly`; невозможная сумма не маскируется уменьшением рекомендации. Projected date считается по целому числу ежемесячных взносов `ceil(R / monthlyContribution)` с календарным добавлением месяцев и clamp последнего дня месяца. Также реализованы ориентиры финансовой подушки на 3/6 месяцев обязательных расходов и агрегат нескольких целей, который явно отделяет цели без даты от scheduled weekly/monthly totals.

## 18. Архивирование и destructive actions

- Account с историей физически не удаляется; используется `archivedAt`.
- Goal физически не удаляется после появления ledger/reservation history; cancel/archive освобождает резерв и сохраняет историю.
- Completed goal хранится в архиве.
- Financial operation отменяется компенсацией, а не удалением проводок.
- User-facing destructive действие использует собственный dialog, не `window.confirm()`.
- Архивные сущности исключаются из основных списков, но остаются в истории и аналитике.

## 19. PWA и offline

PWA включает manifest со stable id `/app`, запуском сразу в `/app/home`, standalone/minimal-ui display override, portrait orientation, собственные icons/maskable/apple-touch-icon, пять iPhone launch images, реальный narrow install screenshot, safe areas, service worker, безопасный static-shell cache, offline fallback и install UX для поддерживаемых браузеров/iOS. Manifest shortcuts ведут в рабочие быстрые действия и хотелки. Mobile shell проектируется как основной интерфейс: floating bottom navigation, крупные touch targets, card carousel и доступ к доходу/расходу/переводу без desktop-only промежуточного экрана.

Стратегия offline:

- service worker кэширует только версионированную оболочку и безопасные статические assets; scripts/styles идут network-first с cached offline fallback, чтобы новая HTML-версия не гидратировалась старым bundle, а immutable images/fonts остаются cache-first;
- navigation остаётся network-first с navigation preload, а новая версия worker активируется через явное controlled update;
- authenticated HTML/API не помещаются в общий cache без доказанной изоляции;
- последний успешный минимальный read model хранится в отдельной IndexedDB `kopilka-read-only`; user id в snapshot не сохраняется, а устройство хранит только последний локально открытый профиль;
- snapshot не содержит session token, hash, секреты, upload credentials или избыточный ledger;
- snapshot имеет schema version и время актуальности;
- logout очищает snapshot и связанные client caches;
- успешный logout очищает object store, удаляет IndexedDB и уведомляет service worker об очистке приватных caches до перехода на login;
- без сети финансовые мутации отключены с честным сообщением;
- mutation queue и background sync для финансовых записей не реализуются.

Известный остаточный риск: offline-клиент не может проверить серверное истечение сессии. Поэтому snapshot доступен только пока пользователь локально не выполнил logout, хранит минимум данных и подчиняется privacy mode; этот компромисс должен быть явно проверен в threat model.

## 20. Upload и внешние assets

- Пользователь может загружать только PNG/JPEG/WebP в установленных пределах (5 MB, 4096 px по каждой стороне).
- Проверяются content signature, MIME, размеры и возможность декодирования; расширению и filename доверять нельзя. Формат определяется sharp по байтам, вход ре-кодируется (auto-orient, без metadata); SVG и не-изображения отклоняются.
- Имя в storage генерируется сервером (`goals/<userId>/<uuid>.<ext>`), путь проверяется против traversal; пользовательский SVG не принимается.
- Контракт хранилища — `StorageAdapter` (put/get/delete/list) в `src/server/images/storage.ts`; dev adapter — `LocalStorageAdapter` над `STORAGE_LOCAL_DIRECTORY`, production adapter — `S3StorageAdapter` с AWS SigV4 для S3-compatible endpoint. Неполная S3-конфигурация отклоняется fail-closed при старте.
- Upload: server-only Route Handler `POST /api/goals/images` — session auth, same-origin (CSRF), early Content-Length лимит, повторная проверка размера в сервисе. Download: `GET /api/goals/images/:assetId` — uuid-валидация, ownership (userId + `deletedAt: null`), Content-Type из БД, `X-Content-Type-Options: nosniff`, `Cache-Control: private`.
- Замена/удаление изображения цели (updateGoal) мягко удаляет запись (`deletedAt`) и физически удаляет файл (best-effort `reclaimImage`); `sweepOrphanFiles` удаляет файлы без активной записи (crash-остатки).
- Основной UI, placeholders, logo, icons, onboarding и empty states не зависят от внешних картинок или remote SVG.

## 21. Read models и аналитика

- Dashboard и analytics получают специализированные агрегированные read models. По последнему UX-решению mobile home показывает только capital/free/reserved и быстрые действия; карты, хотелки и история используют те же read models на отдельных routes и не дублируются на главной.
- Полный ledger не отправляется клиенту без необходимости.
- Transfer исключается из income/expense и имеет нулевое влияние на капитал.
- Opening balance показывается отдельно от заработанного дохода.
- Balance adjustment показывается отдельно либо явно маркируется, чтобы не искажать поведенческую аналитику.
- Goal reservations входят в `reserved`, но не в cashflow и не прибавляются к capital.
- Архивная финансовая история участвует в ретроспективной аналитике.
- Индексы проектируются под user/date/account/category/goal/status запросы; N+1 запрещён.

## 22. Ошибки и наблюдаемость

Domain/application layer возвращает типизированные известные ошибки: validation, unauthenticated, not found, conflict, insufficient funds, rate limited, unsupported currency и storage failure.

- Пользователь не видит Prisma/SQL error, stack trace, `undefined` или `[object Object]`.
- Server logs получают correlation id и техническую причину, но не пароль, raw session token и чувствительный upload payload.
- Неожиданная ошибка преобразуется в нейтральное сообщение и фиксируется серверно.
- Успех показывается только после подтверждённого commit.

## 23. Планируемая структура репозитория

### Реализованная визуальная система

Визуальная концепция называется «тихая точность»: тёплый нейтральный фон, минеральный нефритовый accent, сдержанная типографика и абстрактная геометрия накопления. Это не dashboard template и не копия банковской карты. Источник истины — `src/styles/tokens.css` с тремя слоями:

1. primitive OKLCH palette, type/spacing/radius/motion scales;
2. semantic light/dark roles (`--bg`, surfaces, text, border, accent, statuses, focus, charts);
3. component contracts для button/input/surface/account cards.

Тёмная тема имеет собственные lightness/chroma mappings, тени, градиенты карточек и status/chart colors; она не строится через invert. `prefers-contrast: more` усиливает смысловые границы, `forced-colors` сохраняет системный focus и убирает декоративные эффекты, а animation/transition включаются только внутри `prefers-reduced-motion: no-preference`.

Theme preference (`light | dark | system`) хранится локально под ключом `kopilka-theme`. Статический ранний script в `<head>` валидирует значение и устанавливает `data-theme` до первого paint; `<html suppressHydrationWarning>` разрешает ожидаемое различие server HTML и DOM, созданное только этим доверенным bootstrap. Без JavaScript системная тема работает через media query. Client switcher использует `useSyncExternalStore`, слушает system/storage changes и не делает синхронный state update в hydration effect. Inline bootstrap не содержит пользовательских данных; при введении строгой CSP ему потребуется nonce или зафиксированный hash.

`/dev/design-system` — внутренняя visual laboratory с semantic colors, typography, большими суммами, account cards, states, controls и chart scale. В production её module остаётся в build manifest, но route вызывает `notFound()` и фактически отвечает HTTP 404; основной UI и production-навигация на него не ссылаются.

Правило представления денег едино для всех будущих экранов: `.amount` / `[data-amount]` используют tabular numerals и не разрывают число с валютой. Для экстремально длинного значения контейнер остаётся в пределах доступной ширины и прокручивается только по своей inline-оси, поэтому мобильная сетка не получает горизонтального overflow, а сумма не обрезается и не подменяется многоточием.

### Brand assets

Фирменный знак «контур накопления» соединяет абстрактную букву «К», устойчивый вертикальный контейнер, три растущих уровня и золотую точку решения. Геометрия оригинальна, не использует банковскую карту, кошелёк, свинку, готовый icon pack или trademark другого продукта. Правила применения зафиксированы в `docs/brand-guidelines.md`.

Векторный master app icon хранится в `src/assets/brand/app-icon-source.svg`; публичные `logo-mark.svg`, `logo-horizontal.svg`, reversed mark и `favicon.svg` состоят только из локальных SVG paths/shapes. `scripts/generate-brand-assets.mjs` через зафиксированный `sharp` воспроизводимо создаёт favicon PNG, PWA 192/512, промежуточные PWA-размеры, Apple Touch и отдельные maskable 192/512. Обычные app icons полностью непрозрачны; maskable glyph программно масштабируется до 72% master и проверяется по foreground pixels внутри обязательной окружности диаметром 80%. Raster-файлы являются release assets и не генерируются автоматически при build.

### AppIcon system

Интерфейсная графика реализована локальным `src/components/icons/AppIcon`, без стороннего icon pack. Публичный контракт ограничивает размер значениями `16 | 20 | 24` и имя union-типом из 71 значения. Полнота `name → glyph` проверяется TypeScript через `satisfies Record<AppIconName, ReactNode>`, поэтому новое имя нельзя добавить без геометрии и наоборот.

Все глифы используют `viewBox="0 0 24 24"`, `currentColor`, обводку `1.8`, круглые окончания/соединения и не содержат remote references. Набор разделён на core, financial categories, goal categories и status/priority modules. Имена 20 financial-category icons совпадают с `prisma/seed.ts`; goal/status/priority покрывают все значения соответствующих Prisma enum.

`AppIcon` server/client neutral: в нём нет browser API, state или hydration-зависимости. Без доступного имени SVG декоративен (`aria-hidden="true"`); `title` создаёт `<title>`, `role="img"` и `aria-label`. Icon-only control всё равно обязан задавать собственное имя кнопке, поскольку название графики не заменяет accessible name интерактивного элемента.

`/dev/icons` показывает все глифы одновременно в 16/20/24 px и обеих темах. Route является Server Component и вызывает `notFound()` в production; production-навигация на него не ссылается.

### UI primitives

Переиспользуемая библиотека находится в `src/components/ui` и не зависит от visual kit. Статические primitives (`Button`, form controls, `FormField`, surfaces, badges, progress, skeleton и state blocks) остаются server/client-neutral; только элементы с browser state или focus management (`PasswordInput`, `MoneyInput`, `SubmitButton`, `Dialog`/`BottomSheet`, `Popover`, `Toast`) объявляют узкую client boundary.

Формы используют native controls и явные labels. `FormField` связывает label, hint и inline error через стабильные id, `aria-describedby` и `aria-invalid`. `MoneyInput` принимает локализованную строку, использует общий bigint `parseMoney`, а на клиент отдаёт minor units только безопасной decimal string. `Button.pending` и `SubmitButton/useFormStatus` блокируют повторное UI-submit, сохраняя видимую подпись; финансовая гарантия всё равно остаётся за server-side idempotency.

Modal layer основан на native `<dialog>.showModal()`: дополнительно реализованы deterministic initial focus, Tab wrap fallback, Escape/backdrop close, возврат фокуса и reference-counted body scroll lock. Destructive confirmation фокусирует менее опасную кнопку и блокирует только повторный confirm. Bottom sheet использует тот же контракт с mobile placement, `overscroll-behavior` и `env(safe-area-inset-bottom)`. Popover немодален, закрывается по Escape/outside pointer и возвращает фокус только при клавиатурном закрытии.

Motion включается только внутри `prefers-reduced-motion: no-preference`; forced-colors сохраняет системные границы/checked state. Toast/error/status semantics различают polite `status` и urgent `alert`; критичные сообщения не исчезают по таймеру. Development route `/dev/ui` демонстрирует все состояния, доступен только вне production и отдельно проверяется keyboard/desktop/mobile Playwright-сценариями.

```text
src/
  app/
    (public-auth)/
    onboarding/
    app/
      accounts/[id]/
      goals/[id]/
  components/
    icons/
    ui/
    finance/
    accounts/
    goals/
    analytics/
    auth/
    onboarding/
    pwa/
  features/
  lib/
    auth/
    db/
    money/
    dates/
    goals/
    validation/
    pwa/
  server/
    actions/
    services/
    repositories/
    policies/
  styles/
  assets/
    icons/
    brand/
    illustrations/
prisma/
public/
tests/
  unit/
  integration/
  e2e/
docs/
```

Фактические имена могут уточняться, но направления зависимостей и разделение ответственности обязательны.

## 24. Проверочная стратегия

- Unit: money, dates, goal formulas, feasibility, weekly plan и чистые policies.
- Integration с реальной PostgreSQL: ledger, transfer, reserve, completion, concurrency, idempotency, auth и ownership.
- E2E: сценарии A–H мастер-промпта.
- Component/accessibility: формы, dialogs, sheets, keyboard, focus и screen-reader labels.
- Visual: ключевые страницы, light/dark, empty/error/offline, iPhone и desktop.
- PWA: manifest, service worker, install detection, offline snapshot и standalone.

Каждая задача оставляет рабочие `lint`, `typecheck`, релевантные tests и build. Финал требует прохождения полного quality gate.

## 25. Нерушимые финансовые инварианты

1. `accountBalance = sum(account ledger entries)`.
2. `totalCapital = sum(all account balances)`; reserve к нему не прибавляется.
3. Transfer имеет нулевую сумму проводок и не меняет total capital.
4. Income увеличивает total capital ровно на amount.
5. Expense уменьшает total capital ровно на amount.
6. Adjustment меняет total capital только на delta.
7. Contribution/withdrawal меняют reserved/free, но не capital.
8. `freeMoney = totalCapital - totalReserved` для принятой модели.
9. Goal completion уменьшает capital ровно на actual purchase amount и закрывает reserve без второго списания.
10. Reversal полностью компенсирует исходную operation.
11. Одинаковая idempotent command применяется не более одного раза.
12. Пользователь не может ссылаться на сущность другого пользователя.
13. Обычный расход/перевод не тратит зарезервированные средства.
14. Никакой денежный источник истины не использует JS float.

### 25.1. Production topology для одного VDS

Принята воспроизводимая topology `Caddy → Next.js standalone → PostgreSQL` в Docker Compose:

- снаружи публикуются только TCP 80/443 и UDP 443 у Caddy; порт PostgreSQL и app port не публикуются;
- Caddy автоматически выпускает/обновляет TLS-сертификаты и формирует forwarding headers, поэтому `TRUST_PROXY_HEADERS=true` допустим только в этом production stack;
- Next.js работает непривилегированным пользователем, с read-only root filesystem, writable `tmpfs`, persistent Next cache и отдельным volume uploads;
- PostgreSQL находится во внутренней Docker-сети и хранит данные в persistent volume;
- `prisma migrate deploy` выполняется отдельным одноразовым `migrator` container до запуска новой версии app;
- `/api/health` проверяет не только HTTP-процесс, но и реальное соединение с PostgreSQL;
- для single-instance VDS local uploads допустимы только вместе с ежедневным backup volume. Перед горизонтальным масштабированием storage переключается на S3-compatible adapter.

Реализация: `compose.production.yml`, `deploy/Caddyfile`, `scripts/deploy-vds.sh`, `scripts/backup-vds.sh`; эксплуатационная инструкция — `docs/vds-deployment.md`.

## 26. Риски и принятые меры

| Риск | Уровень | Мера |
|---|---|---|
| Race между двумя расходами | Высокий | Row locks/isolation, расчёт доступного остатка внутри transaction, integration concurrency tests |
| Double charge при completion | Высокий | Один application service и одна transaction; reserve release отдельно от единственного expense |
| Cross-user IDOR | Высокий | Session-derived userId, user-scoped queries, composite foreign keys, negative tests |
| BigInt на client boundary | Средний | Decimal string DTO и централизованная сериализация |
| Истечение session во время offline | Средний | Минимальный snapshot, очистка logout, отсутствие mutation, threat-model disclosure |
| Неверная production object-storage конфигурация | Средний | `StorageAdapter` имеет локальный driver и S3-compatible AWS SigV4 driver; обязательные endpoint/bucket/region/credentials валидируются fail-closed, uploads re-encode и сохраняют server-generated key |
| Credit account создаёт неограниченный долг | Средний | Явный credit limit; без него отрицательный баланс запрещён |
| Архивный счёт с остатком исчезает из капитала | Высокий | Архивный остаток продолжает учитываться; UI предупреждает и предлагает обнуление |
| Неверные date boundaries | Средний | Calendar target date, user timezone, injected clock, boundary tests |
| Service worker выдаёт приватные данные другому user | Высокий | Не кэшировать private responses общим cache; IndexedDB namespace и очистка |
| Готовая UI-библиотека разрушает айдентику | Средний | Собственные tokens, SVG icon system и visual QA |

## 27. Открытые эксплуатационные решения

Это не блокеры текущего архитектурного этапа; окончательный выбор фиксируется до соответствующей миграции или интеграции:

1. S3 bucket policy/CORS и реальные credentials потребуются только перед добавлением второго app replica.
2. Production distributed scheduling/Web Push delivery и VAPID setup, если уведомления включаются.
3. Физическая проверка standalone-install и safe areas на целевых версиях iOS.

Ни одно открытое решение не разрешает ослабить перечисленные финансовые и security-инварианты.
