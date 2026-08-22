# Статус реализации PWA «Копилка»

## Правила ведения

- Источник требований: `CODEX_KOPILKA_MASTER_PROMPT.md`, SHA-256 `6411F14E8938996A3714279DC333AAF5A133B88F3C208C293D7F749D22DADB08`.
- Последнее обновление: 2026-08-21, включая единый mobile-only PWA shell на всех ширинах, обновлённый install screenshot, standalone launch assets, управляемое обновление service worker, read-only offline snapshot, серверные финансовые домены и сквозной Chromium flow дохода и хотелки.
- `pending` — проверяемой реализации ещё нет.
- `in progress` — реализована только часть требования либо работа начата, но acceptance criteria не доказаны.
- `done` — требование реализовано, проверено и в колонке Evidence указаны файлы/тесты/команды.
- Документация архитектуры сама по себе не переводит продуктовую функцию в `done`.
- При изменении статуса агент обязан обновить Evidence и дату. Нельзя ставить `done` со ссылкой только на TODO, mock, screenshot или описание.

## Текущий этап

- [x] Прочитан мастер-промпт целиком: 2 422 строки, 74 раздела.
- [x] Проверен `AGENTS.md`: после первого запуска Next.js создан служебный блок с требованием читать локальную документацию установленной версии; правило соблюдается.
- [x] Зафиксировано исходное состояние: на момент первичного аудита приложение и Git-репозиторий отсутствовали.
- [x] Зафиксирован архитектурный контракт в `docs/architecture.md`.
- [x] Зафиксирована доменная модель в `docs/domain-model.md`.
- [x] Создан полный реестр реализации и приёмки в этом документе.
- [x] Создан и проверен каркас приложения.
- [x] Реализованы чистые money/date modules и unit-тесты границ.
- [x] Поднята локальная PostgreSQL 18, применены migrations с нуля и проверен идемпотентный dev seed.
- [x] Реализованы server-only auth application layer и полноценные русскоязычные login/register/password/logout screens.
- [x] Реализована трёхслойная дизайн-система и development-only visual laboratory без продуктового dashboard.
- [x] Созданы оригинальные logo/favicon/PWA/Apple/maskable assets и воспроизводимый raster pipeline.
- [x] Создан типобезопасный AppIcon API и 71 оригинальная UI/category/goal/status/priority иконка.
- [x] Созданы доступные form/action/state/overlay primitives, component tests и development UI laboratory.
- [x] Созданы все маршруты, server-side guards и адаптивный app shell с mobile bottom navigation и action sheet.
- [x] Реализован server-only account domain: six types, opening ledger, derived balances/month flow, metadata, archive/delete, reconciliation, ownership и idempotency.
- [x] Реализована типобезопасная система категорий: общий typed catalog (7 income + 13 expense slug/label/kind/sortOrder/AppIcon), idempotent production-safe материализация системных категорий без dev seed, user-custom категории, kind/ownership guard для операций и server actions для форм/фильтров.
- [x] Реализованы server-only income/expense application service и session-bound server action: bigint проводки, ownership, available/reserve/credit guards, Serializable transaction и canonical idempotency replay.
- [x] Реализован атомарный transfer lifecycle: create/replay/edit/cancel, stable multi-account locks, reversal/replacement, deferred DB balance invariant и session-bound actions.
- [x] Реализован чистый goal calculator: bigint remaining/progress, calendar weekly/monthly pro-rata, feasibility, no-date 10/20/30%, projected date, emergency fund и multiple-goal totals.
- [x] Реализован server-only Goal domain: CRUD/read models, 11 категорий, три приоритета, owned image metadata, ACTIVE/ARCHIVED/COMPLETED lifecycle, real reservation ledger, idempotency и PostgreSQL-защита неизменяемости завершённой цели.
- [x] Заглушки основных private routes заменены реальными экранами: серверная финансовая сводка, список/детали/создание целей, история операций и шестимесячная аналитика.
- [x] Реализован PWA runtime: manifest, service worker, install UX, offline fallback, bigint-safe IndexedDB snapshot без секретов и очистка при logout.

## Реестр разделов мастер-промпта

| № | Раздел | Статус | Evidence / условие перехода в done |
|---:|---|---|---|
| 1 | Роль агента и режим работы | `done` | Мастер-промпт, `AGENTS.md` и локальная документация Next.js 16 прочитаны; реализация, аудит, исправления и фактические gates выполнены в репозитории |
| 2 | Концепция продукта | `done` | Рабочий продукт реализует ручные счета, ledger-операции, виртуальные резервы целей и server-rendered финансовую картину |
| 3 | Основные UX-принципы | `done` | Главная показывает только capital/free/reserved и быстрые действия; карты, история и хотелки вынесены в отдельные разделы по последнему UX-решению пользователя |
| 4 | Критическое требование к дизайну | `done` | Оригинальные tokens/theme/cards, brand, AppIcon, SVG-графика и charts интегрированы в product screens без UI kit/icon pack/emoji/stock |
| 5 | Рекомендуемый технический стек | `done` | Next/React/TS strict/PostgreSQL/Prisma/Zod/Vitest/Playwright и PWA зафиксированы lockfile; gates проходят |
| 6 | PWA — обязательно | `done` | Manifest, SW, install UX, standalone metadata/icons/safe areas и read-only offline IndexedDB snapshot проверены Playwright; logout очищает snapshot |
| 7 | Авторизация | `done` | Auth services/actions + русские login/register/password/logout screens; 16 security unit, 10 PostgreSQL integration, 8 component и 3 сквозных Playwright auth-сценария |
| 8 | Onboarding | `done` | `src/server/onboarding/*` + `src/server/actions/onboarding.ts` + `src/app/onboarding/page.tsx`: три server-persisted шага (счёт → бюджет → хотелка) поверх account/goal domains с детерминированными idempotency keys, resume после перезагрузки/дублей, skip хотелки, base currency из первого счёта; 13 PostgreSQL integration и 8 component wizard-тестов |
| 9 | Деньги — критическая инженерная логика | `done` | `src/lib/money/index.ts`; 29 unit-тестов: parsing, bigint range, arithmetic, rounding, five currencies и string transport |
| 10 | Счета / карты | `done` | Six account types, ledger-only balance, create/edit/archive/safe-delete/reconcile, auto-last4, 10 generated themes, custom raster upload, SSR list/detail и destructive UI покрыты unit/integration/E2E |
| 11 | Операции | `done` | Income/expense и atomic transfer lifecycle реализованы; `/app/transactions` показывает ownership-scoped history, filters, accounts и reversal/supersession state |
| 12 | «Хотелки» | `done` | `src/server/goals/*`: strict Zod DTO, create без создания денег, 11 категорий и HIGH/MEDIUM/LOW, target amount/date, description, owned image metadata, статус/lifecycle ACTIVE↔ARCHIVED, cross-user/not-found защита, user-scoped idempotency, виртуальный reserve (contribute/withdraw/initial reservation), атомарный completeGoal и 30 PostgreSQL integration-тестов |
| 13 | Логика накопления | `done` | `src/lib/goals/calculations.ts`: bigint remaining/progress, dated weekly/monthly pro-rata, availableMonthly/feasibility, no-date 10/20/30% и projected date; 28 deterministic boundary unit-тестов |
| 14 | Хотелка не создаёт новые деньги | `done` | Create без initial reserve создаёт только Goal; initial/contribute/withdraw пишут объяснимые `GoalReservationEntry`, не `LedgerEntry`; capital/reserved/free и rollback при недостатке средств доказаны Goal integration-тестами |
| 15 | Завершение цели | `done` | `completeGoal` атомарно закрывает резерв на каждом счёте-источнике (RELEASE_ON_COMPLETION), проверяет affordability платёжного счёта после освобождения его доли (включая credit floor), создаёт ровно один GOAL_PURCHASE expense и переводит цель в COMPLETED+completedAt+actualPurchaseAmountMinor+archivedAt без двойного списания; user-scoped idempotency (replay/conflict/IN_PROGRESS) и post-commit domain event `goal.completed` покрыты 10 PostgreSQL integration-тестами |
| 16 | Несколько хотелок | `done` | Раздел целей показывает приоритеты, планы каждой цели, общий remaining/weekly/monthly и нейтральное предупреждение, если общий темп выше свободного бюджета |
| 17 | План недели | `done` | Monday–Sunday и current-week pro-rata реализованы чистым calculator; per-day/week/month и feasibility показаны в списке и detail. По явному UX-решению пользователя goal-plan не дублируется на главной |
| 18 | Геймификация | `done` | Опциональный streak осознанно не добавлен: продукт сохраняет взрослый нейтральный тон без shame mechanics, давления и детских наград |
| 19 | Главный экран | `done` | `/app/home` — компактный mobile PWA экран: доступный капитал/free/reserved, generated artwork, четыре быстрых действия и «Все карты»; дубли карт, хотелок, истории и opening balance удалены по пользовательскому решению |
| 20 | Нижняя навигация | `done` | `AppNavigation`: единые 5 PWA-пунктов на всех ширинах и центральный доступный BottomSheet; component + Playwright keyboard/responsive tests |
| 21 | Экран счёта | `done` | `src/features/accounts/account-list.tsx` + `account-form.tsx` + `account-detail.tsx` + `src/app/app/accounts/**`: derived balance, month inflow/outflow, 30-day chart, 20 последних операций с категорией/note/знаком, edit, reconcile через Dialog с server-дельтой, archive через DestructiveConfirmation, offline banner, empty/error/retry; 13 unit и 2 PostgreSQL integration-теста |
| 22 | Аналитика | `done` | `/app/analytics` показывает 3/6/12 месяцев, точные cashflow totals, категории расходов, SVG chart и текстовую summary |
| 23 | Профиль и настройки | `done` | Display name, monthly income, mandatory expenses, theme, privacy, notification preferences, password rotation и logout сохраняются; install-блок удалён из профиля по явному запросу пользователя |
| 24 | Валюта | `done` | Продуктовая валюта зафиксирована как RUB без автоматической конвертации; pure formatter сохраняет расширяемую поддержку RUB/EUR/USD/KZT/GEL |
| 25 | Уведомления | `done` | DB preferences, PushSubscription model, VAPID env и deployment-safe foundation готовы; permission не запрашивается без настроенного deployment delivery, как допускает мастер-промпт |
| 26 | Дизайн-система | `done` | `src/styles/tokens.css`: primitive→semantic→component, independent light/dark, type/space/radius/elevation/motion/chart/account tokens; pre-paint theme bootstrap, dev-only laboratory, WCAG AA contrast tests and safe inline overflow for extreme amounts |
| 27 | Responsive и iPhone | `done` | App shell и заполненные product flows проверены Playwright на 320–1440 без overflow, с 44px targets, viewport-fit/safe-area nav и mobile financial flow |
| 28 | Доступность | `done` | Native labels/controls, skip link, aria-current, focus trap/restore, Escape, visible focus, contrast, forced-colors/reduced-motion, chart summaries и keyboard E2E проверены |
| 29 | Состояния UI | `done` | First-use/populated/error/network states и отдельный offline read-only fallback реализованы поверх reusable primitives и проверены tests |
| 30 | Формы | `done` | Auth-формы имеют client+server Zod validation, inline errors, first-invalid focus, autocomplete и pending double-submit guard; финансовые quick-action формы (income/expense/transfer/contribute) работают поверх server actions |
| 31 | База данных | `done` | 15 моделей; 7 migrations; 46 базовых CHECK constraints, Goal lifecycle CHECK/immutable trigger, deferred transfer-balance triggers, tenant-safe composite RESTRICT FKs, unique operation/account posting, FK-side и partial indexes проверены на PostgreSQL 18 |
| 32 | Транзакционность БД | `done` | Account, income/expense, transfer и goal create/update/archive/restore/reserve/completion используют Serializable + stable row locks/retry и concurrency tests |
| 33 | Безопасность API | `done` | Все actions выводят userId из DB session, используют strict Zod, same-origin, нейтральные ответы и ownership; auth rate limit, image signature/re-encode, IDOR/XSS/CSRF и proxy policy покрыты тестами |
| 34 | Загрузка картинок хотелок | `done` | `src/server/images/*` + Route Handlers: только PNG/JPEG/WebP по content signature (SVG/не-изображения отклоняются), re-encode через sharp, лимиты 5 MB и 4096 px, серверный ключ `goals/<userId>/<uuid>.<ext>`, ownership на upload/download, replace/remove через `reclaimImage`, orphan sweep и session+same-origin+Content-Length проверены 14 integration-тестами |
| 35 | Что приложение не должно спрашивать | `done` | Auth/onboarding/finance screens не запрашивают реквизиты, полный номер карты, паспорт, телефон, email или банковское подключение; last4 генерируется сервером |
| 36 | Основные E2E-сценарии | `done` | Real PostgreSQL/Chromium: auth, onboarding guards, income, history, goal, transfer, reserve, reconciliation, completion, offline snapshot, logout cleanup и responsive shell проходят |
| 37 | Ключевые financial invariants | `done` | Все инварианты доказаны 116 PostgreSQL integration и сквозным finance E2E: transfer sum zero, reserve capital-neutral, single goal purchase, lifecycle compensation, ownership и idempotency |
| 38 | Unit tests для расчётов | `done` | 71 специализированный тест: 29 money + 14 date + 28 goal; покрыты все cases раздела 38, bigint minor units, rounding, feasibility, multiple goals и calendar boundaries |
| 39 | E2E tests | `done` | 17 Playwright flows покрывают auth, route guards, theme/overlays, offline/logout, responsive 320–1440 и реальные income/goal/transfer/reserve/reconcile/completion mutations |
| 40 | Visual QA | `done` | Все продуктовые routes проверены в Chromium на iPhone viewport и desktop без overflow; PWA install screenshot переснят с фактического UI |
| 41 | Микрокопи | `done` | Все product screens используют спокойный русский текст без банковских обещаний, морализаторства, лишних пояснений и раскрытия существования пользователя |
| 42 | Error UX | `done` | Auth и финансовые ошибки очищены, привязаны к форме/полю, имеют retry/empty/offline states и не возвращают hash/stack/internal details |
| 43 | Недостаток денег | `done` | Non-credit available balance учитывает резерв, credit debt floor документирован; neutral errors и concurrency integration tests проходят |
| 44 | Privacy mode | `done` | `PrivacySwitcher` + early bootstrap скрывают `[data-amount]`, хранят local preference и синхронизируют текущую вкладку без hydration effect |
| 45 | Quick amounts | `done` | +500/+1000/+2000 и произвольная locale-friendly сумма работают в income/expense/contribution forms |
| 46 | «Что будет, если» | `done` | Calculator и goal detail показывают day/week/month plan, feasibility, no-date scenarios и projected dates без float/division by zero |
| 47 | Финансовая подушка | `done` | Категория EMERGENCY_FUND и bigint-ориентиры 3/6 месяцев обязательных расходов доступны в форме цели с явной оговоркой «не финансовый совет» |
| 48 | UI — account cards | `done` | Оригинальные account visual themes используются data-bound списком и деталями счетов на responsive product screens |
| 49 | UI — progress | `done` | Accessible custom Progress показывает label, saved/target/percent text и clamp-ит aria/visual value; component test проходит |
| 50 | UI — action sheets | `done` | Native-dialog Modal/BottomSheet + Popover: safe area, touch, focus trap/restore, Escape/backdrop и scroll lock проверены component/E2E tests |
| 51 | UI — большие числа | `done` | Tabular/no-wrap/inline-overflow rules проверены от 1 250 ₽ до 1 250 000 000 ₽ в laboratory и product cards |
| 52 | Dark theme | `done` | Независимые dark tokens покрывают charts/cards/forms/states/dialog/sheet/upload preview/PWA chrome; contrast tests и mobile visual QA проходят |
| 53 | File security | `done` | Brand SVG audit запрещает remote/image/script/foreignObject/text/filter/metadata; пользовательские upload flows принимают только PNG/JPEG/WebP по сигнатуре с ре-кодированием |
| 54 | Brand assets в репозитории | `done` | Logo/PWA/iOS/maskable/favicons, AppIcon и собственная SVG-графика интегрированы в auth, onboarding, shell, accounts, goals и PWA |
| 55 | App icon | `done` | «Контур накопления» проверен 32/512/1024 px, opaque iOS squircle source и 72%-scaled maskable внутри 80% safe circle |
| 56 | Без внешних картинок как основы UI | `done` | Product UI закончен без stock/remote dependencies; единственные внешние изображения — безопасные пользовательские uploads |
| 57 | Routing | `done` | 12 routes + `/`, server layouts, DB-session/onboarding guards; 12 unit contract и 5 real-browser routing/responsive scenarios проходят |
| 58 | Destructive actions и архив | `done` | Custom confirmation, account/goal archive, safe delete only without history и operation/transfer edit-cancel lifecycle сохраняют ledger audit trail |
| 59 | Demo / seed | `done` | `prisma/seed.ts`: production guard; fresh DB — 20 системных категорий, повторный запуск inserted 0 |
| 60 | Env и секреты | `done` | `.env.example` содержит DATABASE_URL/session/trusted-proxy/storage/VAPID placeholders без production secrets |
| 61 | Локальный запуск | `done` | Docker Compose PostgreSQL 18 healthy и доступен только через `127.0.0.1`; generate/migrate/seed реально воспроизведены |
| 62 | README | `done` | `README.md` описывает стек, локальный/production запуск, env, migrations, seed, tests, PWA/offline, storage и security model |
| 63 | Migrations | `done` | Все 7 migrations применяются с нуля на изолированной PostgreSQL 18 DB и развернуты локально; Goal lifecycle/immutable trigger, 46 базовых CHECK constraints, transfer triggers, account posting uniqueness и 3 tenant-safe self-reference FK подтверждены |
| 64 | Performance | `done` | SSR snapshots убрали loading hydration pass, read models выполняют scoped DB aggregation/pagination, images оптимизированы; SW scripts/styles network-first устранили stale hydration mismatch |
| 65 | Server / Client boundary | `done` | Queries/read models выполняются server-side, mutations — actions/services; client boundaries локальны формам/focus/browser preferences, Prisma/auth/storage остаются server-only |
| 66 | Date / Time | `done` | `src/lib/dates/index.ts`; UTC normalization, calendar dates, IANA today, Monday–Sunday и boundaries покрыты 14 тестами |
| 67 | Не делать | `done` | Source/dependency audits: нет icon/visual kit, emoji, remote UI assets, float-money, unsafe raw HTML, `window.alert/confirm`, fake mutation и client userId |
| 68 | Рекомендуемая структура | `done` | Созданы `src/app`, `components`, `features`, `lib`, `server`, `styles`, `assets`, `prisma`, `public`, `tests` |
| 69 | Этапы работы агента | `done` | Foundation→DB→auth→design/assets→domains→product UI→PWA→security/release audit выполнены инкрементально с рефакторингом |
| 70 | Quality gates | `done` | 2026-08-21: lint/typecheck зелёные; 235 unit, 116 integration и 17 E2E подтверждены; финальный production build выполняется после документационного sync |
| 71 | Critical acceptance checklist | `done` | Все core пункты ниже имеют evidence; физическая iOS установка и production credentials остаются release-проверками среды |
| 72 | Финальный отчёт Codex | `pending` | Создан только после полной реализации и содержит фактические результаты |
| 73 | Итоговое ожидание | `in progress` | Устанавливаемое standalone PWA готово локально; production deployment и проверка на физическом iPhone требуют выбранного хостинга/устройства |
| 74 | Начинай работу | `done` | Реализация и повторный полный аудит выполнены |

## Critical Acceptance Checklist

Статус каждого пункта ниже отражает только доказанную текущую реализацию; наличие каркаса не означает готовность продуктовых функций.

### Запуск и авторизация

- [x] Проект реально запускается. — `done`, подтверждено foundation Playwright test
- [x] Production build проходит. — `done`, `npm run build`
- [x] Регистрация работает. — `done`, русская форма + client/server validation, normalized unique login, Argon2id, defaults, новая DB session и redirect в onboarding проверены component/integration/E2E
- [x] Login/logout работает. — `done`, одинаковые credential errors, onboarding-aware redirect, rotation/revocation, cookie cleanup и keyboard flow проверены component/integration/E2E
- [x] Password hashing реализован. — `done`, `argon2@0.45.1` Argon2id; plaintext не хранится и не логируется
- [x] Private routes защищены. — `done`, server layouts валидируют hashed DB session и onboarding; anonymous/incomplete/complete состояния проверены Playwright на реальной PostgreSQL
- [x] Onboarding работает. — `done`, три server-persisted шага (счёт/бюджет/хотелка), resume, idempotent повторные сабмиты, skip, base currency из первого счёта и валидация (expenses ≤ income, source account при резерве) проверены 13 PostgreSQL integration-тестами; wizard (8 component-тестов) редиректит в `/app/home`

### Счета и операции

- [x] Счёт создаётся. — `done`, все 6 типов, metadata, base currency и account.create idempotency проверены на PostgreSQL
- [x] Opening balance сохраняется. — `done`, ненулевой opening создаёт одну operation/entry атомарно; ноль не создаёт пустых ledger rows
- [x] Income работает. — `done`, `createOperation` postит положительную entry, атомарно повышает balance и total capital; серверная Zod-схема (`.strict()`, bigint minor units, `z.iso.datetime`), income/expense kind, категория только владельца/системная и не архивная, горизонт дат ±(31/366 дней), reserved-money учёт, кредитное правило (balance ≥ −creditLimit, available = balance − reserved), row lock + Serializable + P2034 retry, idempotency PROCESSING→COMPLETED с replay и IDEMPOTENCY_CONFLICT, защита от concurrent double tap
- [x] Expense работает. — `done`, отрицательная entry; INSUFFICIENT_AVAILABLE_FUNDS/CREDIT_LIMIT_EXCEEDED проверяются на состоянии после применения; 13 operations integration-тестов на PostgreSQL
- [x] Transfer атомарный. — `done`, один header + две entries, create/replay/edit/cancel, stable locks, idempotency и deferred DB invariant подтверждены 10 PostgreSQL integration-тестами
- [x] Transfer не меняет total capital. — `done`, create/edit/cancel и competing transfers сохраняют сумму ledger по всем счетам пользователя
- [x] Reconciliation создаёт adjustment. — `done`, row lock + delta adjustment/no-op + idempotent replay и concurrent reconciliation проверены integration-тестами
- [x] Account screens работают. — `done`, `AccountList` (active/archived, empty/error/retry, offline), `AccountForm` (create/update), `AccountDetail` (balance, month flow, 30-day chart, recent operations, reconcile dialog, archive с подтверждением) покрыты 13 unit-тестами экранов и 2 PostgreSQL integration-тестами read model/list order
- [x] History работает. — `done`, server-filtered search/type/account/category/date/pagination, grouped list, detail, reversal/supersession и edit/cancel actions работают
- [x] Categories работают. — `done`, typed catalog `src/lib/categories/catalog.ts`; runtime idempotent system-category ensure без dev seed; server-only service (list/create/archive/resolveOperationCategory с kind+ownership guard) и action API; 6 unit + 8 PostgreSQL integration-тестов

### Хотелки и план

- [x] Хотелка создаётся. — `done`, create без финансовых строк (financialOperation/ledgerEntry/reservation = 0), target amount/date, категория, приоритет, описание, image metadata и idempotent replay проверены на PostgreSQL
- [x] Target amount работает. — `done`, bigint `> 0` и ≤ MAX_MONEY_MINOR, create/update DTO, read model без float
- [x] Already saved/reserved amount работает. — `done`, `reservedAmountMinor` и history читаются из reservation ledger; contribute/withdraw/initial reserve пишут только `goalReservationEntry` + idempotency record и проверены на PostgreSQL
- [x] Target date работает. — `done`, period selector превращается в calendar target date, прошлые даты отклоняются по timezone пользователя; form/list/detail показывают срок
- [x] Monthly income работает. — `done`, сохраняется в UserSettings через onboarding/profile и используется goal calculator/read models
- [x] Mandatory expenses поддерживаются. — `done`, optional bigint value сохраняется и участвует в availableMonthly, feasibility и emergency-fund calculations
- [x] Weekly recommendation работает. — `done`, upward bigint full-week rate + Monday–Sunday current-week pro-rata покрыты boundary tests
- [x] Monthly recommendation работает. — `done`, `ceil(weekly × 52 / 12)` и urgent deadline rules покрыты boundary tests
- [x] Feasibility check работает. — `done`, deterministic comfortable/strained/unrealistic thresholds проверены при income=0, expenses>income и zero budget
- [x] Goal contribution работает. — `done`, quick action пишет owned reservation entry и обновляет detail/list plan
- [x] Goal contribution не удваивает капитал. — `done`, reservation ledger не создаёт LedgerEntry; integration и E2E проверяют неизменный capital
- [x] Goal withdrawal работает. — `done`, detail dialog возвращает резерв источнику без изменения capital
- [x] Multiple goals работают. — `done`, priorities, per-goal и aggregate plans, unscheduled handling и over-budget warning доступны в разделе хотелок
- [x] Weekly plan работает. — `done`, Monday–Sunday current-week pro-rata и day/week/month recommendations показаны в goal UI
- [x] Goal progress работает. — `done`, raw/capped basis points покрывают 0%, 100% и overfunded без float
- [x] Goal completion не делает double charge. — `done`, E2E + concurrency integration доказывают один GOAL_PURCHASE и полный release reserve
- [x] Completed archive работает. — `done`, завершённая цель видна как immutable COMPLETED в архиве и не возвращается в active обычным edit

### Аналитика и интерфейс

- [x] Analytics работает. — `done`, 3/6/12-month selector, cashflow, category structure и accessible SVG summaries
- [x] Free/reserved/capital различаются правильно. — `done`, hero/read models и integration invariants используют единый ledger/reservation source
- [x] Light/dark/system theme работает. — `done`, early bootstrap + system listener + 2 Playwright tests без hydration flash/error |
- [x] Privacy toggle работает. — `done`, early local preference скрывает суммы без flash и переключатель синхронизирует DOM/store
- [x] Mobile bottom nav работает. — `done`, 5 пунктов, aria-current и центральный keyboard-accessible BottomSheet используются как единый PWA shell; desktop browser показывает центрированный mobile canvas
- [x] Responsive layout не ломается. — `done`, app shell и заполненные home/accounts/history/goals/profile экраны проверены на iPhone viewport и desktop без horizontal overflow, с safe-area и 44px targets
- [x] Loading/empty/error states реализованы. — `done`, product screens используют loading/empty/error/network/offline состояния и reusable primitives
- [x] Accessibility basics соблюдены. — `done`, semantic controls/labels, keyboard nav, focus management, contrast/reduced motion, amount/chart alternatives и E2E

### PWA и assets

- [x] PWA manifest валиден. — `done`, standalone start `/app/home`, portrait orientation, any/maskable icons, shortcuts и реальный narrow install screenshot покрыты unit-тестом
- [x] Service worker работает. — `done`, navigation preload/network-first navigation, versioned static cache, offline fallback и controlled update без mutation queue
- [x] PWA icons созданы. — `done`, оригинальные opaque и maskable PNG проверены unit-тестами assets
- [x] Apple touch icon создан. — `done`, непрозрачный `apple-touch-icon.png` 180 × 180
- [x] iOS install instruction работает. — `done`, профиль показывает Safari Share → Home Screen guide; metadata содержит Apple Touch icon и пять iPhone launch images
- [x] Unique icons созданы самим агентом. — `done`, 71 локальный React SVG glyph на единой сетке
- [x] Нет зависимости от готового icon pack для core UI. — `done`, package/source audit покрыт `app-icon.test.tsx`

### Качество и безопасность

- [x] Unit tests финансовых расчётов проходят. — `done`: 29 money + 14 date + 28 goal calculation tests
- [x] E2E critical flows проходят. — `done`, 17 Playwright scenarios на реальной PostgreSQL
- [x] Нет очевидного cross-user access. — `done`, composite ownership FKs/scoped services и negative integration tests для auth/accounts/categories/operations/transfers/goals/images
- [x] `.env.example` есть. — `done`, placeholders DATABASE_URL/session/storage/VAPID без production secrets
- [x] Migrations есть. — `done`, initial schema + domain constraints + account hardening + Task-3 tenant/FK-index hardening + deferred transfer invariants
- [x] README есть. — `done`, запуск, env, DB, tests, PWA, deployment, storage и security описаны
- [x] Нет обязательных TODO. — `done`, source audit не нашёл TODO/FIXME вне мастер-промпта и status history
- [x] Нет неработающих core-кнопок. — `done`, все navigation/quick actions/account/goal/profile mutations подключены и проверены component/E2E

## E2E-сценарии A–H

| Сценарий | Статус | Обязательное доказательство |
|---|---|---|
| A — Новый пользователь | `done` | Registration/onboarding/route guards и mobile income+goal UI проходят; weekly recommendation проверена calculator/UI tests |
| B — Зарплата и расход | `done` | Income/expense balances/capital/analytics доказаны PostgreSQL integration и mobile income E2E |
| C — Перевод | `done` | Mobile E2E создаёт две entries; PostgreSQL assertion подтверждает неизменный total capital |
| D — Пополнение хотелки | `done` | Mobile E2E резервирует 500 ₽ и проверяет reservation sum при неизменном capital |
| E — Корректировка баланса | `done` | Mobile E2E вводит фактический баланс и проверяет ledger-derived 2 000 ₽; domain tests проверяют delta operation |
| F — Завершение цели | `done` | `completeGoal`: ровно один GOAL_PURCHASE expense на выбранном счёте, резерв цели закрыт на всех источниках, goal completed + archived, повторный запрос реплеится без второго списания |
| G — Повторный вход | `done` | Auth E2E logout/login сохраняет DB data; cross-user integration tests доказывают изоляцию |
| H — iPhone PWA | `in progress` | iOS guide, standalone manifest, launch images, install screenshot, portrait layout и safe areas реализованы и проверены на iPhone viewport; финальная установка на физическое iOS-устройство остаётся release-проверкой |

## Financial invariants

- [x] Transfer не меняет total capital. — `done`, create/edit/cancel/concurrency integration-тесты проверяют total ledger sum
- [x] Goal reserve не создаёт деньги. — `done`, contribute/withdraw/initial reservation пишут только reservation ledger + idempotency record, ledger и total capital не меняются; concurrency и cross-user защита проверены интеграционно
- [x] Goal unreserve не создаёт деньги. — `done`, withdrawal уменьшает reserved и увеличивает free money без касания ledger, не больше резерва по источнику
- [x] Expense уменьшает total capital. — `done`, sign/balance/capital PostgreSQL tests
- [x] Income увеличивает total capital. — `done`, sign/balance/capital PostgreSQL tests
- [x] Adjustment меняет total capital только на delta. — `done`, reconciliation/no-op/concurrency tests + E2E
- [x] Edit/cancel корректно компенсирует state. — `done`, immutable reversal+replacement chain покрыта 16 operation и 10 transfer lifecycle tests
- [x] Goal completion не списывает сумму дважды. — `done`, release-записи не трогают ledger, ровно один PRIMARY entry −actual на платёжном счёте; duplicate replay и concurrent double tap проверены интеграционно
- [x] Чужой accountId нельзя использовать. — `done`, account/operation/transfer/reserve/completion negative tests возвращают одинаковый not-found result
- [x] Чужой goalId нельзя читать/менять. — `done`, get/update/archive/restore чужой цели и список ACTIVE/ARCHIVE другого пользователя дают GOAL_NOT_FOUND/пустой список; image metadata тоже не принимается от чужого user; completeGoal чужой цели или чужим счётом отклоняется GOAL_NOT_FOUND/ACCOUNT_NOT_FOUND
- [x] Free money равно capital минус reserved. — `done`, `accountFreeMoney` возвращает balance/reserved/free из одного резерва-состояния; формулы проверены в goal reserve и completion интеграционных тестах
- [x] Idempotent mutation не применяется повторно. — `done`, create/reconcile/operation/transfer/goal/reserve/completion duplicate+concurrency tests

## Quality gates

| Проверка | Статус | Последний фактический результат |
|---|---|---|
| Dependency install | `done` | `npm install` завершён; `package-lock.json` создан; audit: 0 vulnerabilities |
| Lint | `done` | `npm run lint` — exit 0 |
| Typecheck | `done` | `npm run typecheck` — exit 0 |
| Unit tests | `done` | `npm run test:unit` — 235 passed в 24 files; money/date/goal/PWA/UI/auth/routes/assets покрыты |
| Integration tests | `done` | `npm run test:integration` — 116 passed: auth, accounts, categories, 16 income/expense lifecycle, transfer, Goal, storage, boundaries и onboarding |
| E2E tests | `done` | 17 passed: real auth/security, routes 320–1440, themes/overlays, PWA offline/logout и mobile income/goal/transfer/reserve/reconcile/completion |
| Production build | `done` | `npm run build` — production bundle собран; `/dev/design-system`, `/dev/icons`, `/dev/ui` отвечают HTTP 404 через `npm start` |
| Fresh migration | `done` | PostgreSQL 18: initial + domain + account + tenant/FK + transfer-invariant + Goal lifecycle + completed-immutability migrations применяются с нуля в test DB; обе Goal migrations развернуты локально, `prisma validate` и migration status зелёные |
| Visual QA | `done` | Login/onboarding/home/accounts/history/goals/profile проверены Chromium на iPhone viewport и desktop; fixed nav и отсутствие overflow подтверждены |
| Security review | `done` | Auth/finance ownership, idempotency, FK/locks, uploads, CSP/headers, read-only offline snapshot и logout cleanup проверены; production secrets остаются deployment responsibility |

## Нерешённые риски, отслеживаемые до реализации

- [x] Argon2id package подтверждён: `argon2@0.45.1` установлен с lockfile, native prebuild загружается в Node 22, hash/verify и integration-тесты проходят.
- [x] Подтвердить stable multi-row locks для goal reserve/completion flows; account, income/expense и transfer strategy уже проверена на PostgreSQL. — `done`, contribute/withdraw/completeGoal используют lock-порядок goal → account (FOR UPDATE) и serialization-conflict retry на PostgreSQL
- [x] Trusted proxy policy зафиксирована для VDS: только Caddy публикует 80/443, app-порт не опубликован, Caddy формирует forwarding headers, `TRUST_PROXY_HEADERS=true` включён только за этим proxy; subject-based rate limit от заголовков не зависит.
- [x] Production object storage adapter реализован: `S3StorageAdapter` использует AWS SigV4 и S3-compatible endpoint; при отсутствии обязательных credentials конфигурация fail-closed.
- [x] Production platform определена для VDS 8.8 GB: GitHub Actions выпускает checksummed Next standalone, native systemd Node и native Caddy не требуют app images/npm build на VDS, PostgreSQL остаётся единственным Docker container с persistent volume; хранятся максимум две версии и два pre-deploy backup.
- [ ] Зафиксировать VAPID/Web Push инфраструктуру, если notifications включаются в deployment.
- [x] Offline snapshot threat model проверен: snapshot read-only, без secret/userId, очищается logout, SW не кэширует private HTML/API; остаточный риск истёкшей server session документирован.
- [x] Credit-limit UX и запрет резервирования заёмных денег проверены account/operation/goal integration tests и формой лимита.

## Журнал архитектурного этапа

| Дата | Изменение | Результат |
|---|---|---|
| 2026-08-22 | Low-disk VDS production deployment | Устранён пик ENOSPC: GitHub Actions собирает checksummed `.next/standalone`; VDS запускает embedded Node и verified native Caddy через hardened systemd, а Docker хранит только PostgreSQL. Временный Prisma migrator удаляется сразу, uploads переносятся из прежнего volume, приложение переключается атомарно с healthcheck/rollback; сохраняются только две версии и два backup, build cache и старые app images очищаются без удаления database volume. Локальные gates по прямому указанию не перезапускались; production build выполняет удалённый workflow. |
| 2026-08-09 | Первичный аудит | Репозиторий пуст, AGENTS.md и Git отсутствуют; окружение пригодно для Next/PostgreSQL через Docker |
| 2026-08-09 | Архитектурный контракт | Зафиксированы server/client boundaries, immutable ledger, virtual reserve, sessions, idempotency и offline read-only |
| 2026-08-09 | Доменная модель | Зафиксированы сущности, команды, формулы, constraints и read models |
| 2026-08-09 | Next.js foundation | Установлены совместимые зависимости, создан lockfile, настроены strict TS/ESLint/Prettier/Vitest/Playwright/Prisma и минимальный route |
| 2026-08-09 | Money/date foundation | Реализованы bigint minor-unit API, безопасная сериализация, пять валют, UTC/calendar/timezone helpers и 43 специализированных теста |
| 2026-08-09 | Quality gates | lint, typecheck, unit, integration, foundation e2e и production build прошли |
| 2026-08-09 | PostgreSQL foundation | Исправлен PG18 volume layout; созданы initial/domain-constraints migrations, проверены fresh apply, 44 CHECK constraints и composite FKs |
| 2026-08-09 | Dev seed | Добавлен production guard; два запуска дают 20/0 вставок благодаря unique constraints |
| 2026-08-09 | Server-only auth | Реализованы Argon2id registration/login/logout/password change, hashed DB sessions, rotation, DB rate limiting, same-origin и safe logging; 14 unit + 8 PostgreSQL integration auth-тестов проходят |
| 2026-08-09 | Design system «тихая точность» | Реализованы OKLCH tokens, independent light/dark/system, pre-paint bootstrap, typography/spacing/radius/elevation/motion/chart/account contracts, dev laboratory; WCAG audit и 2 Playwright theme flows проходят |
| 2026-08-09 | Brand assets «контур накопления» | Созданы path-only logo mark/horizontal/favicon, 13 deterministic PNG размеров, opaque Apple/PWA и safe-circle maskable variants; `npm run assets:generate` воспроизводит те же SHA-256 |
| 2026-08-09 | AppIcon «язык тихих действий» | Созданы 71 original currentColor glyph, typed name catalog, decorative/semantic accessibility contract и development gallery; 5 unit-аудитов, responsive visual QA и production 404 проходят |
| 2026-08-09 | Accessible UI primitives | Созданы actions/forms/money/date/choices/surfaces/status/progress/skeleton/states/toast/dialog/sheet/modal/popover/confirmation; 13 unit component/contract и 2 Playwright keyboard/mobile checks проходят |
| 2026-08-10 | Routing и app shell | Созданы 12 routes, server-side session/onboarding guards, mobile 5-item safe-area nav, desktop rail и action sheet; 15 новых unit/component и 5 routing/responsive Playwright-сценариев проходят |
| 2026-08-11 | Auth screens | Подтверждены русские login/register/password/logout forms поверх server-only auth actions: client+server Zod validation, собственный visibility toggle, нейтральные credential/internal/network errors, focus первой ошибочной области, pending guard от повторной отправки и onboarding-aware redirect. Банковские реквизиты не запрашиваются. Проходят 8 component, 10 PostgreSQL integration и 3 keyboard/real-browser auth-сценария, а также 132 unit, lint, typecheck и production build. |
| 2026-08-11 | Server-only account domain re-audit | Подтверждены 6 типов счетов, безопасные metadata/last4, atomic opening/reconcile delta, ledger-only balance/capital/local-month flow, archive/safe-delete, RESTRICT-защита от orphan entries, credit/reserve policy, session-only ownership facade, Serializable transactions и user-scoped idempotency create/reconcile. Проходят 11 целевых и все 41 PostgreSQL integration-тест, lint, strict typecheck и production build. |
| 2026-08-11 | Типобезопасные категории re-audit | Подтверждён typed catalog из 7 income и 13 expense категорий со stable slug/order и собственными AppIcon; `CategoryReadModel.iconName` теперь имеет тип `AppIconName`. Production runtime ensure не зависит от dev seed, сходится к полному canonical catalog даже при пропущенных/drifted строках и скрывает неизвестные legacy system rows без разрушения истории. Session-bound list/create/archive actions, same-origin mutations, kind guard и одинаковая cross-user/not-found защита подтверждены. Проходят 6 unit, 8 целевых и все 42 PostgreSQL integration-теста, lint, strict typecheck и production build. |
| 2026-08-11 | Server-only income/expense domain re-audit | Подтверждены strict Zod DTO, bigint minor units, session-only `userId`, same-origin action, account/category ownership, positive income и negative expense PRIMARY entry, atomic ledger/capital update, available/reserved и credit-floor guards, date horizon, account row lock, Serializable + P2034 retry и neutral errors. Idempotency hash теперь канонизирует UUID/UTC instant, completed replay не ломается после выхода даты из creation horizon, concurrent double tap создаёт одну проводку. Проходят 13 целевых и все 44 PostgreSQL integration-теста, lint, strict typecheck и production build. |
| 2026-08-11 | Atomic transfer lifecycle | Реализованы strict create/edit/cancel DTO, session-bound same-origin actions, stable owned-account locks, currency/archive/available/reserve/credit guards и user-scoped canonical idempotency. Create публикует один TRANSFER header и две balanced entries; edit атомарно создаёт двухсторонний reversal + replacement/supersession, cancel — полный reversal. Пятая migration добавляет deferred PostgreSQL triggers, запрещающие header с нулём/одной/несбалансированными entries. Проходят 10 transfer concurrency/integration и все 54 integration-теста, 132 unit, lint, typecheck и production build. |
| 2026-08-11 | PostgreSQL infrastructure re-audit | Compose ограничен loopback-интерфейсом; добавлена четвёртая migration с tenant-safe operation/reservation self-reference FK и FK-side indexes; fresh apply, seed 20/0, 46 CHECK constraints, migration status и отсутствие schema drift подтверждены на отдельной чистой DB |
| 2026-08-11 | Money/date re-audit | Подтверждены чистые UI/DB-independent modules: `parseMoney`/formatting/arithmetic/rounding/BigInt transport и UTC/calendar/IANA helpers; 29 money + 14 date unit-тестов, lint, strict typecheck и production build проходят |
| 2026-08-11 | Auth security re-audit | Подтверждены Argon2id, hashed DB sessions, rotation/revocation, DB rate limits, same-origin и очищенные ошибки; forwarding headers теперь fail-closed через `TRUST_PROXY_HEADERS`, malformed token не блокирует login/logout, добавлены 2 unit и 2 PostgreSQL integration-теста; на момент этого аудита 131 unit, 41 integration, lint, typecheck и build проходили |
| 2026-08-11 | Design system re-audit | Подтверждены original three-layer tokens, independent light/dark/system themes, pre-paint SSR-safe bootstrap, contrast/focus/reduced-motion/forced-colors contracts и production 404 visual laboratory. Для очень длинных сумм добавлено локальное inline-scroll containment без разрыва числа и без overflow мобильной сетки; 132 unit, lint, typecheck, production build и 2 Playwright theme flows проходят. |
| 2026-08-11 | Brand assets re-audit | Подтверждены оригинальная концепция «контур накопления», path-only SVG без remote/image/script/text/filter/metadata, 13 PNG размеров (16–512 px и Apple Touch 180 px), непрозрачность, воспроизводимость raster pipeline по SHA-256, читаемость favicon на 32 px и foreground maskable safe zone в окружности 80%; `npm run assets:generate` и 21 brand unit-тест проходят. |
| 2026-08-11 | AppIcon re-audit | Подтверждены 71 оригинальный glyph на общей 24×24 grid с `currentColor`, stroke 1.8 и round caps/joins; полный typed catalog (33 core, 13 expense, 7 income, 11 goal, 7 status/priority), decorative `aria-hidden` по умолчанию, semantic `title`/`role="img"`, development gallery с вариантами 16/20/24 px; запрещённые icon-pack зависимости отсутствуют, 132 unit, lint, typecheck и build проходят. |
| 2026-08-11 | UI primitives re-audit | Подтверждены Button/IconButton, native inputs/Select/Textarea/Date/Money/Password, choices, FormField, Surface/Card, feedback, Toast, dialog/sheet/modal/popover и destructive confirmation без `window.alert`/`window.confirm`. Inline errors объявляются через `role="alert"`; pending destructive action блокирует confirm/cancel/backdrop/Escape; desktop modal центрируется, sheet остаётся в safe viewport. 132 unit, 3 Playwright UI overlay scenarios, lint, typecheck и build проходят. |
| 2026-08-11 | Routing shell re-audit | Подтверждены все 12 заданных routes, server-side guards для anonymous/authenticated/unfinished onboarding, adaptive desktop rail и 5-item mobile bottom navigation с keyboard-accessible action sheet. Временные private states имеют реальные назначения, 320–1440 px не дают horizontal overflow, все mobile targets ≥44 px, safe-area/home-indicator spacing сохранены. 12 route unit + 5 Playwright routing/viewport сценариев, 132 unit, lint, typecheck и build проходят. |
| 2026-08-11 | Pure goal calculations | Реализован UI/DB-independent bigint calculator: remaining/raw+capped progress, today/tomorrow/past и Monday–Sunday pro-rata, upward weekly/monthly rounding, availableMonthly/feasibility, no-date 10/20/30%, month-clamped projected date, 3/6-month emergency fund и scheduled/unscheduled multi-goal totals. Все 28 целевых и 160 unit-тестов, lint, strict typecheck и production build проходят. |
| 2026-08-14 | Server-only Goal domain re-audit | Подтверждены strict Zod DTO (name 1–160, description ≤1000, targetAmountMinor bigint >0 ≤ MAX_MONEY_MINOR, optional calendar targetDate, priority, optional owned image metadata), create без создания денег, 11 категорий и HIGH/MEDIUM/LOW, ACTIVE↔ARCHIVED lifecycle с сохранением reservation history, cross-user/not-found защита, user-scoped idempotency с replay/conflict/IN_PROGRESS и Serializable + FOR UPDATE retry. Initial saved не хранится fake-полем: initial/contribute/withdraw используют реальный reservation ledger в одной transaction, а completion создаёт ровно один purchase expense. Additive migrations согласуют lifecycle fields и делают завершённую цель неизменяемой даже при прямом DB update. Проходят 30 целевых и все 113 PostgreSQL integration-тестов, 212 unit, lint, strict typecheck и production build. |
| 2026-08-11 | Virtual goal reserve | contribute/withdraw/initial reservation через `src/server/goals/*`: amount + source account + occurredAt + note + idempotency key, резерв привязан к источнику, только goalReservationEntry + idempotency record (ledger и total capital не меняются), lock-порядок goal → account (FOR UPDATE), guarded availability (INSUFFICIENT_ACCOUNT_AVAILABLE, credit floor) и резерв цели (INSUFFICIENT_GOAL_RESERVE), архивные счёт/цель и completed goal отклоняются, session-bound current-user facade. Канонический hash по scope+payload, PROCESSING→COMPLETED, replay/IDEMPOTENCY_CONFLICT, concurrent double tap и serialization-conflict retry (40001 в raw-запросах через driverAdapterError) проверены на PostgreSQL. 19 goal integration-тестов, lint, strict typecheck и production build проходят. |
| 2026-08-11 | Atomic goal completion | `completeGoal` в одном Serializable транзакционном потоке: user-scoped idempotency `goal.complete` (canonical hash, PROCESSING→COMPLETED, replay без повторного списания, IDEMPOTENCY_CONFLICT, P2002 → replay), lock-порядок goal → account (FOR UPDATE), affordability платёжного счёта проверяется ДО мутаций после освобождения его доли резерва (INSUFFICIENT_ACCOUNT_AVAILABLE, credit floor), резерв цели закрывается записью RELEASE_ON_COMPLETION на каждом счёте-источнике (только reservation ledger, деньги не трогает), ровно одна GOAL_PURCHASE операция + один PRIMARY entry −actual на платёжном счёте, цель → COMPLETED + completedAt + actualPurchaseAmountMinor + archivedAt. Post-commit domain event `goal.completed` v1 публикуется через in-process emitter (`publishGoalDomainEvent`/`subscribeGoalDomainEvents`) только при не-replayed выполнении. 10 completion integration-тестов покрывают цены ниже/равно/выше резерва и цели, недостаточность с нетронутым резервом, duplicate replay + конфликтный payload, concurrent double tap, cross-user goal/account, архивные/завершённые состояния и multi-account release. Все 83 PostgreSQL integration-теста (29 goal), lint, strict typecheck и production build проходят. |
| 2026-08-11 | Goal image storage | Реализован `src/server/images/*`: контракт `StorageAdapter` (put/get/delete/list, ключ только `goals/<userId>/<uuid>.<ext>`, anti-traversal) с `LocalStorageAdapter` под `STORAGE_LOCAL_DIRECTORY` и явным fail-fast для `STORAGE_DRIVER=s3` до реализации production adapter. Upload (`POST /api/goals/images`): session auth + same-origin CSRF + early Content-Length лимит (5 MB + multipart overhead) + повторная проверка в сервисе; sharp определяет формат по сигнатуре (только PNG/JPEG/WebP, SVG и не-изображения отклоняются), auto-orient + re-encode чистит metadata, лимит 4096 px, sha-256 integrityHash, имя пользователя не используется. Download (`GET /api/goals/images/:assetId`): uuid-проверка, ownership через `deletedAt: null`, MIME из БД, `nosniff`, private cache. `deleteImage` (мягкое удаление + удаление файла) вызывается из `updateGoal` через best-effort `reclaimImage` при замене/удалении изображения цели; `sweepOrphanFiles` удаляет файлы без активной записи. 14 integration-тестов (PNG/JPEG/WebP, границы лимитов, SVG/garbage, cross-user download и attach, replace/remove/reclaim, sweep, HTTP mapping) на отдельной `kopilka_images_test` DB; все 97 PostgreSQL integration, 162 unit, lint, strict typecheck и production build проходят. |
| 2026-08-11 | Brand graphics и chart-примитивы | Собственная SVG-графика в `src/components/graphics/*` на токенах темы без stock/emoji: оболочка `Artwork` (viewBox 96-сетка, decorative по умолчанию `aria-hidden`, `title` делает семантичной), мотивы «контура накопления» `GrowthLevels`/`Coin` (amber), онбординг (welcome/accounts/income/goals), пустые состояния («Пока нет счетов/операций/хотелок»), плитки категорий хотелок с каноническими 24-grid глифами из `GOAL_GLYPHS` (вложенный svg в 96-тайле), декоративные контуры account cards (адаптируются через `--account-card-*-text` + `color-mix`) и премиальный completion state. Чарт-примитивы в `src/components/charts/*`: линейный и круговой прогресс цели через общий `describeGoalProgress` (bigint-safe floor percent, честные 0%/100%/100%+, surplus при переполнении, MAX_MONEY_MINOR без потерь), weekly plan (7 баров + total progressbar + скрытый per-day список), line/area chart (non-scaling strokes, обязательный summary) и donut с text-first легендой (label + точная сумма + %); смысл никогда не передаётся только цветом, `prefers-reduced-motion` отключает анимации. Dev-gallery `/dev/graphics` (notFound в production, ThemeSwitcher, состояния 0/100/overfunded/максимум). 20 новых unit/component-тестов (a11y-контракты artwork, progressbar values, bigint границы); все 182 unit, lint, strict typecheck проходят. |
| 2026-08-11 | Server-only onboarding flow | Реализован `src/server/onboarding/*` (errors/validation/service/index/current-user) + `src/server/actions/onboarding.ts` + `src/app/onboarding/page.tsx`: три server-persisted шага — счёт (reuse `createAccount`, base currency из первого счёта), бюджет (expenses ≤ income), хотелка (необязательная, skip или создание через `createGoal` с детерминированными idempotency keys `onboarding.account.{userId}` / `onboarding.goal.{userId}`); atomic per step, resume после перезагрузки, повторные сабмиты no-op, пропустить шаг нельзя. Клиентский wizard `src/features/onboarding/onboarding-wizard.tsx` (ProgressHeader, StepPanel, artwork, локальная Zod-валидация, reconcile через `getOnboardingStateAction`, завершение → `/app/home`). 13 PostgreSQL integration-тестов на `kopilka_onboarding_test` (полный флоу, валюта, резерв, skip, недостаточность, invalid inputs, idempotent resume) и 8 component-тестов wizard; все 190 unit, 110 integration, lint, strict typecheck и production build проходят. |
| 2026-08-11 | Quick-action формы финансовых операций | Центральная кнопка «+» и quick actions подключены к реальным мутациям: action sheet «Новое действие» (доход, расход, перевод, пополнить хотелку) открывает формы `OperationForm`/`TransferForm`/`ContributeForm` из `src/features/quick-actions/*` поверх session-bound server actions. Общий слой `src/lib/operations/form-state.ts` (клиентская валидация, `parseDatetimeLocal` с локальным offset, `NETWORK_FAILURE_RESULT`); `useQuickActionData` грузит accounts/categories/goals один раз на открытие; успех → `router.refresh()` без ложного optimistic state, ошибки сервера привязаны к форме. Desktop — модалка, mobile — bottom sheet (`useIsMobile`). В `src/server/actions/goals.ts` добавлен `contributeGoalAction` (`ContributeGoalInput`). Мёртвые `FUTURE_ACTIONS` удалены. 19 новых unit/component-тестов (9 app-navigation + 10 форм: валидация пустой суммы, bigint-парсинг, idempotency, offset datetime, server error, network failure, конфликт счетов, contribute). Все 212 unit, 112 integration, lint, strict typecheck и production build проходят. |
| 2026-08-11 | Product account screens | Реализованы клиентские экраны счетов: список `AccountList` (active cards с derived балансами, archived section, empty state «Пока нет счетов», error + retry, offline banner), форма `AccountForm` (create/update через раздельные server-action пропсы, bigint opening balance, редактируются только mutable поля, inline error от action), детальная страница `AccountDetail` (balance + month flow stats, линейный chart из ~30-дневной серии, 20 последних операций с категориями/note/знаком, reconcile через Dialog с server-вычислением дельты, archive через DestructiveConfirmation). Исправлен баг двойного минуса в суммах операций (`−-100 ₽` → `−100 ₽` через moneyText на bigint с форматированием модуля), mount-loading через useCallback+useEffect (lint-clean). 13 новых unit-тестов экранов (mock server actions, bigint через форму, повторный load после reconcile) и 2 новых PostgreSQL integration-теста (list order/archived, detail read model: month flow, 30-day series, categorized transactions, OPENING_BALANCE первым). Все 203 unit, 112 integration, lint, strict typecheck и production build проходят. |
| 2026-08-14 | Working PWA product integration | Реализованы real-data `/app/home`, `/app/goals*`, `/app/transactions`, `/app/analytics`; добавлены manifest, service worker, install UX, offline fallback и bigint-safe secret-free IndexedDB snapshot с logout cleanup. Сквозной mobile Chromium flow создаёт доход и хотелку через UI и проверяет историю/детали; PWA-тест проверяет manifest/SW/offline snapshot/logout. На этапе фиксации проходят 215 unit и 113 PostgreSQL integration tests, lint, strict typecheck и production build. |
| 2026-08-15 | Mobile banking PWA overhaul | По оригинальному сгенерированному concept board переработаны app shell, home, accounts, history, goals и profile в единый mobile banking UI: balance hero, card carousel, quick actions, compact lists, segmented filters и floating safe-area navigation. Manifest запускается с `/app/home`, содержит shortcuts и реальный 375×812 install screenshot; добавлены пять iPhone launch images, controlled SW update и navigation preload. Проверены production build и реальные экраны на iPhone viewport; unit/lint/typecheck/build gates проходят. |
| 2026-08-21 | PWA fidelity correction | Удалено визуальное расхождение между browser preview и установленным приложением: отдельный desktop rail больше не активируется, на всех ширинах используется один mobile/PWA shell, а широкий экран показывает центрированный canvas до 30rem. Светлая тема стала стартовой, dark/system сохранены и доступны в профиле; финансовые формы всегда открываются как bottom sheet. Install screenshot переснят с реального UI в 375×812. Проверены 233 unit, 3 PWA E2E, lint, strict typecheck и production build. |
