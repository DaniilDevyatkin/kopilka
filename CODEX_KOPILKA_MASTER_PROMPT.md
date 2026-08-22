# MASTER PROMPT ДЛЯ CODEX — PWA «КОПИЛКА»

> Этот файл — главное задание для автономного coding-агента. Цель: **спроектировать, разработать, протестировать и довести до рабочего состояния полноценное PWA-приложение «Копилка»**, а не сделать статический прототип, набор мокапов или frontend-демо без реальной бизнес-логики.

---

# 1. РОЛЬ АГЕНТА И РЕЖИМ РАБОТЫ

Ты работаешь одновременно как:

- senior product engineer;
- senior full-stack developer;
- backend/database architect;
- UI/UX designer финтех-продуктов;
- PWA engineer;
- security-minded engineer;
- QA engineer.

Твоя задача — самостоятельно принять все разумные технические и продуктовые решения, необходимые для завершения проекта.

## Главные правила работы

1. Если репозиторий уже содержит код — сначала изучи его, архитектуру, зависимости, тесты и текущие ограничения. Сохрани всё полезное, рефактори только там, где это действительно нужно.
2. Если проект пустой — создай его с нуля.
3. Не задавай пользователю вопросы о мелких технических решениях, которые можно принять самостоятельно.
4. Если есть несколько хороших вариантов реализации — выбери наиболее безопасный, поддерживаемый и подходящий для PWA.
5. Не останавливайся на «каркасе», «первой версии», «MVP-демо» или «макете», если обязательная функциональность ниже ещё не реализована.
6. Не оставляй обязательные TODO, неработающие кнопки, fake API или формы, которые визуально работают, но ничего не сохраняют.
7. После первой рабочей сборки обязательно проведи технический и визуальный QA, исправь найденные проблемы и только потом завершай задачу.

Итог должен быть приложением, которое можно:

- зарегистрировать;
- авторизоваться;
- добавить финансовые счета;
- ввести стартовые балансы;
- фиксировать доходы и расходы;
- переводить деньги между своими счетами;
- вручную корректировать фактический баланс;
- создавать «Хотелки»;
- рассчитывать план накопления;
- пополнять/уменьшать резерв хотелок;
- видеть корректные балансы, прогресс и аналитику;
- выйти и войти снова без потери данных;
- установить как PWA;
- добавить на экран «Домой» на iPhone и запускать в standalone-режиме.

---

# 2. КОНЦЕПЦИЯ ПРОДУКТА

Название:

**Копилка**

«Копилка» — персональный финансовый мини-банк без прямого подключения к банковским API. Все фактические суммы пользователь ведёт вручную.

Пользователь должен уметь:

- видеть общий капитал;
- создавать карты/счета/наличные;
- указывать стартовый баланс;
- записывать доходы;
- записывать расходы;
- делать внутренние переводы;
- понимать, куда уходят деньги;
- создавать финансовые цели — «Хотелки»;
- указывать цену желаемой вещи или цели;
- указывать уже накопленную сумму;
- указывать доход;
- при необходимости указывать обязательные расходы;
- задавать желаемую дату покупки;
- получать расчёт, сколько откладывать в неделю и месяц;
- отслеживать прогресс;
- видеть, реалистична ли цель при текущем бюджете;
- завершать цель и отправлять её в архив.

Главная продуктовая формула:

> **Вот сколько у тебя денег. Вот чего ты хочешь. Вот сколько тебе нужно откладывать, чтобы это получить.**

Приложение не должно ощущаться как бухгалтерская программа.

---

# 3. ОСНОВНЫЕ UX-ПРИНЦИПЫ

После входа пользователь за 3–5 секунд должен понять:

1. сколько денег у него всего;
2. где находятся деньги;
3. сколько заработано и потрачено;
4. сколько зарезервировано на цели;
5. какая хотелка сейчас главная;
6. сколько нужно отложить на этой неделе;
7. идёт ли он по плану.

Основные действия должны занимать максимум 1–3 логических шага.

Интерфейс должен быть:

- mobile-first;
- визуально дорогим;
- современным;
- быстрым;
- понятным одной рукой;
- похожим по уровню UX на хорошие банковские приложения;
- но **не копировать конкретный банк**.

---

# 4. КРИТИЧЕСКОЕ ТРЕБОВАНИЕ К ДИЗАЙНУ

## 4.1. Никакого шаблонного UI

Запрещено делать продукт визуально похожим на:

- стандартную Tailwind dashboard template;
- Bootstrap admin;
- Material UI demo;
- generic SaaS dashboard;
- shadcn demo без глубокой переработки;
- набор одинаковых белых карточек на сером фоне без собственной дизайн-системы.

Можно использовать технические utility/headless-библиотеки, но конечная визуальная система должна быть **оригинальной и цельной**.

## 4.2. Агент сам создаёт всю ключевую графику

По ходу разработки ты обязан самостоятельно создать:

- логотип «Копилка»;
- фирменный знак;
- favicon;
- PWA app icon;
- maskable icon;
- apple-touch-icon;
- иконки нижней навигации;
- иконки дохода/расхода/перевода;
- иконки типов счетов;
- иконки категорий расходов;
- иконки категорий хотелок;
- иконки статусов;
- графические элементы onboarding;
- empty-state illustrations;
- декоративные элементы карточек;
- собственные индикаторы прогресса;
- собственную визуальную систему графиков/аналитики.

### Запрет на готовые иконпаки

Не используй для основных UI-иконок:

- Lucide;
- Heroicons;
- Font Awesome;
- Material Icons;
- Tabler Icons;
- Phosphor;
- Remix Icons;
- Bootstrap Icons;
- любые другие готовые наборы иконок.

Не используй emoji как замену интерфейсной графике.

Все основные иконки должны быть **созданы самим агентом** в виде собственных SVG/React SVG components/SVG symbols.

Требования к icon system:

- единая сетка;
- единая геометрия;
- одинаковый stroke language;
- одинаковая логика скруглений;
- хорошая читаемость на 16/20/24 px;
- `currentColor`;
- отсутствие remote SVG;
- отсутствие чужих trademark elements.

Пример API:

```tsx
<AppIcon name="home" size={24} />
<AppIcon name="wallet" size={24} />
<AppIcon name="target" size={24} />
```

Создай минимум:

- home;
- transactions;
- add;
- goals;
- profile;
- eye;
- eye-off;
- income;
- expense;
- transfer;
- card;
- cash;
- savings;
- settings;
- logout;
- edit;
- archive;
- calendar;
- target;
- check;
- warning;
- offline;
- install;
- share;
- home-screen;
- search;
- filter;
- close;
- back;
- chevron;
- categories.

## 4.3. Айдентика

Создай самостоятельную фирменную систему «Копилки»:

- оригинальный знак/монограмму;
- современную спокойную палитру;
- светлую и тёмную тему;
- typography scale;
- spacing system;
- radius system;
- elevation/shadow system;
- animation timings;
- chart styling;
- account card styling.

Не делай продукт детским. Не делай мультяшную розовую свинку центральной метафорой. Можно тонко использовать идею накопления, контейнера, монеты, роста, цели или абстрактной буквы «К».

---

# 5. РЕКОМЕНДУЕМЫЙ ТЕХНИЧЕСКИЙ СТЕК

Если существующий репозиторий не диктует другой стек, используй современные стабильные версии, доступные в окружении.

Предпочтительный вариант:

- Next.js с App Router;
- TypeScript strict mode;
- React;
- Tailwind/CSS как инструмент, но не как готовый дизайн;
- PostgreSQL;
- Prisma ORM или зрелый аналог;
- server-side validation;
- Zod или аналог;
- безопасная session-based auth;
- Argon2id или эквивалентный memory-hard password hash;
- Playwright для e2e;
- Vitest/Jest для unit/integration;
- service worker/PWA layer;
- Docker Compose для локальной БД, если это уместно.

Если выбираешь другой стек — он должен быть не хуже по безопасности, типизации, поддерживаемости и тестируемости.

Не привязывайся к устаревшей версии пакета только потому, что она знакома. Используй текущую стабильную версию, доступную в рабочем окружении.

---

# 6. PWA — ОБЯЗАТЕЛЬНО

Приложение должно быть полноценным PWA.

Реализуй:

- web app manifest;
- `display: standalone`;
- корректные theme/background colors;
- app name;
- short name;
- favicon;
- icon set;
- maskable icon;
- Apple touch icon;
- service worker;
- app-shell caching;
- offline fallback;
- корректное обновление service worker;
- standalone layout;
- safe-area support;
- `env(safe-area-inset-*)`;
- корректный viewport;
- installability detection.

## 6.1. Установка на iPhone

Учти реальное поведение iOS: Safari не даёт универсального программного install prompt как Chromium.

В приложении должна быть кнопка:

**«Установить приложение»**

Логика:

- Chromium/поддерживаемые браузеры: использовать `beforeinstallprompt`, если доступно;
- iPhone/iPad Safari: по нажатию показывать красивый встроенный bottom sheet/guide:
  1. нажмите «Поделиться»;
  2. выберите «На экран “Домой”»;
  3. подтвердите добавление;
- для инструкции использовать **собственные SVG-иконки**, созданные в проекте;
- если приложение уже в standalone — install CTA скрывать;
- если браузер не поддерживает установку — показать корректное объяснение.

## 6.2. Offline

Минимум без сети должны работать:

- оболочка приложения;
- ранее загруженные ключевые страницы;
- последний успешно загруженный snapshot данных;
- понятный offline indicator.

Если реализуется offline mutation queue:

- каждая мутация должна иметь idempotency key/client mutation id;
- двойная отправка не должна создавать двойную финансовую операцию;
- конфликт не должен незаметно портить баланс.

Если безопасная offline-запись слишком рискованна — в offline режиме финансовые изменения можно сделать read-only с понятным сообщением. Нельзя показывать «успешно сохранено», если сервер данные не получил.

---

# 7. АВТОРИЗАЦИЯ

Обязательные функции:

- регистрация по логину и паролю;
- вход;
- выход;
- сохранение безопасной сессии;
- смена пароля;
- защита private routes;
- защита от перебора логина;
- защита от session fixation;
- ownership checks для всех данных.

Поля регистрации:

- login;
- password;
- repeat password;
- display name — желательно;
- base currency — сразу или в onboarding.

Пароль:

- разумная минимальная длина;
- хранить только безопасный hash;
- не логировать;
- не отправлять обратно клиенту;
- не хранить plaintext.

Сессии:

- HttpOnly;
- Secure в production;
- SameSite;
- ограниченный lifetime;
- rotation/renewal при необходимости.

Никогда не доверяй `userId`, переданному клиентом. Владелец определяется по server-side session.

---

# 8. ONBOARDING

После регистрации пользователь не должен попадать на пустой dashboard.

Сделай короткий onboarding.

## Шаг 1 — первый счёт

Поля:

- название;
- тип;
- стартовый баланс;
- визуальное оформление.

Пример:

- «Основная карта»;
- 35 000 ₽.

## Шаг 2 — доход

Поля:

- примерный ежемесячный доход;
- обязательные ежемесячные расходы — необязательно, но объяснить пользу.

## Шаг 3 — первая хотелка

Предложить:

- создать сейчас;
- пропустить.

После onboarding пользователь должен попасть на уже осмысленный dashboard.

Сохраняй состояние onboarding серверно.

---

# 9. ДЕНЬГИ — КРИТИЧЕСКАЯ ИНЖЕНЕРНАЯ ЛОГИКА

Никогда не храни деньги в JS float как источник истины.

Используй:

- integer minor units (копейки) или
- точный Decimal тип БД/ORM.

Предпочтительно minor units integer/bigint.

Создай единый модуль:

- `parseMoney`;
- `formatMoney`;
- `addMoney`;
- `subtractMoney`;
- `compareMoney`;
- `roundMoney`;
- `formatCurrency`.

Учитывай локаль и валюту.

---

# 10. СЧЕТА / КАРТЫ

Пользователь может создавать несколько счетов.

Типы:

- debit card;
- credit card;
- cash;
- savings;
- bank account;
- custom.

Для карты реальный номер не нужен.

Допустимо необязательное `last4` только как визуальная метка.

Поля:

- id;
- userId;
- name;
- type;
- currency;
- visualTheme/color;
- optional last4;
- archived;
- createdAt;
- updatedAt.

## 10.1. Источник истины по балансу

Не делай `balance` единственным источником истины.

Источник истины — ledger/операции.

При создании счёта:

- создаётся `opening_balance` transaction.

Текущий баланс вычисляется из операций/проводок.

Допустим cached balance для производительности, но только если он атомарно синхронизируется и всегда может быть восстановлен из ledger.

## 10.2. Ручная сверка баланса

Нужна функция:

**«Скорректировать текущий баланс»**

Пример:

- приложение: 54 200 ₽;
- фактически в банке: 53 870 ₽.

Пользователь вводит фактический баланс.

Система создаёт:

`-330 ₽ — Корректировка баланса`

Не переписывай историю молча.

---

# 11. ОПЕРАЦИИ

Типы:

1. income;
2. expense;
3. transfer;
4. opening_balance;
5. balance_adjustment;
6. goal_contribution;
7. goal_withdrawal;
8. goal_purchase/goal_completion — если требуется выбранной ledger-моделью.

## 11.1. Доход

Поля:

- amount;
- account;
- category;
- comment;
- date/time.

Категории по умолчанию:

- зарплата;
- подработка;
- подарок;
- продажа;
- возврат;
- бонус;
- другое.

## 11.2. Расход

Поля:

- amount;
- account;
- category;
- comment;
- date/time.

Категории:

- продукты;
- транспорт;
- кафе;
- жильё;
- подписки;
- развлечения;
- одежда;
- здоровье;
- образование;
- техника;
- подарки;
- путешествия;
- другое.

## 11.3. Перевод

Transfer между своими счетами должен быть одной атомарной бизнес-операцией.

Он:

- уменьшает source account;
- увеличивает destination account;
- **не меняет общий капитал**.

Редактирование/удаление перевода должно корректно затрагивать обе связанные проводки.

## 11.4. История

Экран операций:

- группировка по датам;
- поиск;
- фильтр по типу;
- фильтр по счёту;
- фильтр по категории;
- фильтр по диапазону дат;
- детали операции;
- редактирование;
- удаление/отмена.

После любого изменения баланс пересчитывается корректно.

---

# 12. «ХОТЕЛКИ» — КЛЮЧЕВОЙ РАЗДЕЛ

Хотелка = финансовая цель.

Примеры:

- смартфон;
- MacBook;
- автомобиль;
- отпуск;
- ремонт;
- обучение;
- подарок;
- часы;
- финансовая подушка.

Поля:

- id;
- userId;
- name;
- category;
- description;
- optional image;
- targetAmount;
- currentReservedAmount или derived value;
- targetDate optional;
- priority;
- status;
- createdAt;
- completedAt;
- actualPurchaseAmount optional.

Категории хотелок:

- техника;
- путешествие;
- автомобиль;
- жильё;
- образование;
- подарок;
- одежда;
- здоровье;
- хобби;
- финансовая подушка;
- другое.

Для каждой категории создай собственную SVG-иконку.

Пользователь может загрузить изображение хотелки. Если фото нет — показывай премиальный собственный placeholder по категории, а не внешний stock photo.

---

# 13. ЛОГИКА НАКОПЛЕНИЯ

Пусть:

- `T` = target amount;
- `C` = current saved/reserved;
- `R = max(T - C, 0)`;
- `D` = target date;
- `now` = текущая дата пользователя.

Рассчитай:

- remaining amount;
- days remaining;
- weeks remaining;
- weekly recommended contribution;
- approximate monthly contribution.

Не допускай деление на ноль.

Корректно обработай:

- цель сегодня;
- цель завтра;
- срок меньше недели;
- дата в прошлом;
- уже накоплено 100%;
- накоплено больше 100%.

Не округляй вниз так, чтобы итоговая сумма к дате оказалась меньше target.

## 13.1. Доход и обязательные расходы

Пользователь указывает:

- `monthlyIncome`;
- `mandatoryMonthlyExpenses` — optional.

Рассчитай:

`availableMonthly = max(monthlyIncome - mandatoryMonthlyExpenses, 0)`

Сравни recommended monthly saving с availableMonthly.

## 13.2. Реалистичность

Статусы:

- комфортно;
- напряжённо;
- нереалистично.

Тон нейтральный, без морализаторства.

Пример:

> Чтобы успеть к выбранной дате, нужно откладывать около 31 200 ₽ в месяц. После обязательных расходов у вас остаётся примерно 24 000 ₽.

Предложить:

- перенести дату;
- изменить сумму цели;
- изменить темп;
- обновить доход/расходы.

## 13.3. Если дата не задана

Покажи варианты:

- 10% дохода — комфортный;
- 20% — оптимальный;
- 30% — быстрый.

Для каждого рассчитать примерную дату достижения.

Если обязательные расходы оставляют меньше доступных денег — не советовать невозможную сумму без предупреждения.

---

# 14. ВАЖНЕЙШЕЕ ПРАВИЛО: ХОТЕЛКА НЕ СОЗДАЁТ НОВЫЕ ДЕНЬГИ

Хотелка — **виртуальный резерв внутри существующего капитала**, а не второй независимый банковский баланс.

Пример:

Сумма всех счетов = 100 000 ₽.

Зарезервировано в хотелках = 30 000 ₽.

Правильное отображение:

- общий капитал = 100 000 ₽;
- зарезервировано = 30 000 ₽;
- свободно = 70 000 ₽.

Неправильно:

- 100 000 ₽ на счетах + 30 000 ₽ хотелки = 130 000 ₽.

Так делать нельзя.

## 14.1. Пополнение хотелки

Пользователь нажимает «Пополнить».

Поля:

- amount;
- source account;
- date;
- optional comment.

Финансовая модель должна быть такой, чтобы резервирование:

- не создавало новые деньги;
- не уменьшало общий капитал дважды;
- уменьшало доступную/свободную часть средств;
- увеличивало reserve goal.

Если выбранная архитектура использует отдельный реальный savings account, это должно быть явно смоделировано и не приводить к double counting.

## 14.2. Снятие из хотелки

Пользователь может уменьшить резерв.

После снятия:

- progress уменьшается;
- available/free money увеличивается;
- weekly recommendation пересчитывается;
- общий капитал не меняется.

---

# 15. ЗАВЕРШЕНИЕ ЦЕЛИ

Когда накоплено >= 100%:

- показать аккуратное celebration state;
- не использовать детский хаотичный confetti;
- использовать премиальную микроанимацию;
- показать CTA «Отметить покупку».

При покупке:

- указать фактическую стоимость;
- выбрать счёт оплаты;
- создать корректный расход;
- закрыть резерв;
- не списать одну сумму дважды;
- goal status -> completed;
- сохранить completedAt;
- отправить цель в архив.

Если фактическая цена отличается от target — логика не должна ломаться.

---

# 16. НЕСКОЛЬКО ХОТЕЛОК

Пользователь может иметь несколько активных целей.

Для каждой:

- target;
- saved/reserved;
- remaining;
- progress;
- weekly recommendation;
- priority.

Priority:

- high;
- medium;
- low.

На главной и в разделе целей нужен блок:

**План накоплений**

Пример:

- MacBook — 5 000 ₽/нед.;
- Отпуск — 3 000 ₽/нед.;
- Машина — 4 000 ₽/нед.;
- Итого — 12 000 ₽/нед.

Сравни общий план с доступным бюджетом.

Если все цели вместе требуют больше доступных средств:

- показать предупреждение;
- предложить изменить даты/приоритеты;
- ничего автоматически не менять без согласия пользователя.

---

# 17. ПЛАН НЕДЕЛИ

На главной:

- сколько нужно отложить на этой неделе;
- сколько уже зарезервировано/внесено;
- сколько осталось;
- процент выполнения.

Пример:

```text
План недели
8 500 ₽

Внесено
5 000 ₽

Осталось
3 500 ₽
```

Неделя по умолчанию:

**понедельник–воскресенье**.

Если цель создана посреди недели, выбери разумную pro-rata стратегию или начинай полный недельный план со следующего цикла. Важно, чтобы результат был понятным и документированным.

---

# 18. ГЕЙМИФИКАЦИЯ

Можно реализовать ненавязчивый streak:

**«7 недель по плану»**

Не превращай финансовый продукт в игру.

Запрещены:

- shame mechanics;
- агрессивные streak warnings;
- давление;
- детская наградная система.

---

# 19. ГЛАВНЫЙ ЭКРАН

Информационная архитектура должна напоминать хороший online banking dashboard.

Обязательные блоки:

## Header

- приветствие;
- имя;
- profile/avatar monogram;
- settings/notifications shortcut optional.

## Общий капитал

Большая сумма — главный визуальный anchor.

Дополнительно:

- изменение за месяц;
- privacy toggle «глаз».

Privacy mode должен скрывать суммы и запоминаться как UI preference.

## Счета

Mobile-friendly список/карусель.

Карточка:

- название;
- тип;
- баланс;
- custom visual style;
- optional last4.

Не использовать реальные логотипы VISA/Mastercard без необходимости.

## Быстрые действия

- Доход;
- Расход;
- Перевод;
- Пополнить цель.

Все иконки — собственные.

## План недели

- required;
- contributed;
- remaining;
- progress.

## Главная хотелка

- photo/illustration;
- name;
- saved / target;
- progress;
- remaining;
- target date;
- weekly amount.

## Последние операции

Последние 3–5.

## Статистика месяца

- income;
- expense;
- saved/reserved;
- net cashflow.

Страница должна выглядеть цельной, а не как набор разрозненных карточек.

---

# 20. НИЖНЯЯ НАВИГАЦИЯ

Mobile bottom navigation:

1. Главная;
2. Операции;
3. центральная кнопка `+`;
4. Хотелки;
5. Профиль.

Центральная кнопка открывает action sheet:

- новый доход;
- новый расход;
- перевод;
- пополнение хотелки.

На desktop/tablet сделай адаптивную навигацию.

---

# 21. ЭКРАН СЧЁТА

При открытии счёта:

- название;
- баланс;
- month inflow;
- month outflow;
- график динамики;
- recent transactions;
- edit account;
- reconcile balance;
- archive account.

Если есть история операций, предпочтительнее archive, а не destructive delete.

Не создавай orphan transactions.

---

# 22. АНАЛИТИКА

Нужен полноценный аналитический экран.

Показывать:

- общий капитал;
- доходы;
- расходы;
- net cashflow;
- reserved toward goals;
- free money;
- динамику по месяцам;
- категории расходов;
- структуру расходов.

Периоды:

- текущий месяц;
- прошлый месяц;
- 3 месяца;
- 6 месяцев;
- год;
- custom range — если не создаёт лишней сложности.

Графики:

- собственные SVG предпочтительны;
- либо библиотека с глубокой кастомизацией;
- responsive;
- доступная текстовая summary.

---

# 23. ПРОФИЛЬ И НАСТРОЙКИ

Поля/настройки:

- display name;
- login;
- base currency;
- monthly income;
- mandatory monthly expenses;
- theme;
- privacy toggle;
- notifications;
- PWA install status;
- смена пароля;
- logout.

Темы:

- system;
- light;
- dark.

---

# 24. ВАЛЮТА

Первая версия может использовать одну базовую валюту аккаунта.

Минимум RUB.

Архитектура должна позволять расширение.

Допустимые варианты в UI:

- RUB;
- EUR;
- USD;
- KZT;
- GEL;
- другие — если легко.

Не реализуй автоматическую конвертацию курсов без надёжного источника данных.

---

# 25. УВЕДОМЛЕНИЯ

Если возможно без разрушения core scope, реализуй foundation для:

- напоминания о weekly contribution;
- день пополнения;
- близость к цели;
- достижение цели.

Если Web Push требует deployment-specific VAPID/storage setup:

- реализуй архитектуру;
- добавь env variables;
- документируй setup;
- не ломай основной продукт, если push не настроен.

Разрешения спрашивать только осмысленно, не при первом открытии без контекста.

---

# 26. ДИЗАЙН-СИСТЕМА

Создай tokens.

Минимум:

```text
--bg
--surface
--surface-elevated
--text-primary
--text-secondary
--text-muted
--border
--accent
--accent-contrast
--positive
--negative
--warning
--focus
```

Также:

- typography scale;
- spacing scale;
- radii;
- shadows/elevation;
- transitions;
- chart tokens.

## Motion

- micro interactions примерно 120–250ms;
- smooth sheets/modals;
- progress transition;
- reduced-motion support.

Не перегружай анимациями.

---

# 27. RESPONSIVE И IPHONE

Mobile first.

Проверь минимум:

- 320/360 px;
- 375 px;
- 390/393 px;
- 430 px;
- 768 px;
- 1024 px;
- 1440 px.

На iPhone:

- bottom nav не конфликтует с home indicator;
- bottom sheet учитывает safe area;
- inputs не прячутся под клавиатурой;
- нет horizontal scroll;
- tap targets нормального размера;
- standalone PWA выглядит как приложение, а не обрезанная веб-страница.

---

# 28. ДОСТУПНОСТЬ

Минимум WCAG AA там, где разумно.

Обязательно:

- semantic HTML;
- labels;
- keyboard navigation;
- visible focus;
- aria-label для icon-only buttons;
- хороший contrast;
- ошибки не только цветом;
- reduced motion;
- screen-reader-friendly amounts;
- графики имеют текстовую альтернативу.

---

# 29. СОСТОЯНИЯ UI

Для каждого важного экрана реализуй:

- loading;
- skeleton;
- empty;
- error;
- offline;
- first-use;
- populated;
- success;
- destructive confirmation.

Не оставляй голые `Loading...`.

Примеры empty state:

**Нет счетов**

> Добавьте первый счёт — и Копилка начнёт считать общий баланс.

CTA: **Добавить счёт**

**Нет хотелок**

> Есть вещь или поездка, на которую хочется накопить? Создайте цель, а мы рассчитаем темп.

CTA: **Создать хотелку**

**Нет операций**

> Пока здесь тихо. Добавьте доход или расход.

---

# 30. ФОРМЫ

Для всех форм:

- client validation для UX;
- server validation для безопасности;
- inline errors;
- защита от double submit;
- idempotency для финансовых мутаций;
- sensible defaults;
- mobile-friendly keyboard;
- locale-friendly money input.

Кнопка submit должна блокироваться во время pending.

Double tap на iPhone не должен создавать двойную операцию.

---

# 31. БАЗА ДАННЫХ

Спроектируй нормализованную схему.

Минимальные сущности:

- User;
- Session;
- Account;
- Transaction/LedgerEntry;
- TransferGroup или связанная сущность;
- Category;
- Goal;
- GoalContribution/GoalLedger;
- UserSettings;
- OnboardingState;
- NotificationPreference optional.

Примерная идея:

```text
User
- id
- login
- passwordHash
- displayName
- baseCurrency
- monthlyIncomeMinor
- mandatoryExpensesMinor
- createdAt
- updatedAt

Account
- id
- userId
- name
- type
- currency
- last4
- visualTheme
- archivedAt
- createdAt
- updatedAt

Transaction
- id
- userId
- accountId
- type
- amountMinor
- categoryId
- groupId
- goalId
- note
- occurredAt
- createdAt
- updatedAt

Goal
- id
- userId
- name
- category
- description
- targetAmountMinor
- targetDate
- priority
- status
- imageUrl
- completedAt
- createdAt
- updatedAt
```

Фактическую модель выбери самостоятельно, но она обязана обеспечивать:

- atomic transfer;
- отсутствие double counting;
- reconstructable history;
- корректный balance;
- безопасное редактирование/удаление;
- indexes и constraints.

---

# 32. ТРАНЗАКЦИОННОСТЬ БД

Используй DB transaction для:

- transfer;
- goal contribution;
- goal withdrawal;
- goal completion;
- edit/delete операций, влияющих на balance;
- reconciliation.

При параллельных запросах не должно быть очевидных race conditions.

Критические мутации должны иметь idempotency protection.

---

# 33. БЕЗОПАСНОСТЬ API

Каждый endpoint/server action:

1. проверяет session;
2. берёт userId из session;
3. проверяет ownership;
4. валидирует input;
5. не возвращает лишние поля;
6. не раскрывает password hash;
7. не показывает stack trace пользователю.

Rate limiting минимум для:

- login;
- registration;
- password change.

Защита от:

- SQL injection;
- XSS;
- CSRF в соответствии с архитектурой;
- open redirect;
- IDOR;
- file upload abuse.

---

# 34. ЗАГРУЗКА КАРТИНОК ХОТЕЛОК

Если реализуешь upload:

- ограничить MIME;
- ограничить размер;
- server-side проверка;
- безопасное имя;
- не доверять расширению;
- не разрешать исполняемые файлы;
- не отображать пользовательский SVG inline без sanitizer.

Предпочтительно разрешить:

- PNG;
- JPG/JPEG;
- WebP.

Если нет object storage, сделай storage abstraction и безопасный dev adapter.

---

# 35. ЧЕГО ПРИЛОЖЕНИЕ НЕ ДОЛЖНО СПРАШИВАТЬ

Это не банковский агрегатор.

Не просить:

- полный номер карты;
- CVV/CVC;
- PIN;
- логин интернет-банка;
- пароль интернет-банка.

Можно кратко пояснить:

> Копилка не подключается к банку. Вы сами ведёте суммы и операции.

---

# 36. ОСНОВНЫЕ END-TO-END СЦЕНАРИИ

## Scenario A — Новый пользователь

1. Открывает приложение.
2. Создаёт аккаунт.
3. Проходит onboarding.
4. Добавляет счёт 50 000 ₽.
5. Указывает доход 90 000 ₽.
6. Создаёт хотелку «MacBook» 160 000 ₽.
7. Указывает уже накоплено 20 000 ₽.
8. Указывает дату.
9. Попадает на dashboard.
10. Видит корректный weekly recommendation.

## Scenario B — Зарплата и расход

1. +90 000 ₽ доход.
2. Баланс увеличился.
3. -3 500 ₽ расход.
4. Баланс уменьшился.
5. Total capital обновился.
6. Analytics обновилась.

## Scenario C — Перевод

1. A = 100 000 ₽.
2. B = 20 000 ₽.
3. Transfer 10 000 ₽ A -> B.
4. A = 90 000 ₽.
5. B = 30 000 ₽.
6. Total capital не изменился.

## Scenario D — Пополнение хотелки

1. Target = 160 000 ₽.
2. Reserved = 20 000 ₽.
3. Contribution = 5 000 ₽.
4. Reserved = 25 000 ₽.
5. Remaining = 135 000 ₽.
6. Weekly plan пересчитан.
7. Total capital не увеличился.

## Scenario E — Корректировка баланса

1. App показывает 54 200 ₽.
2. Фактически 53 870 ₽.
3. User вводит 53 870 ₽.
4. Создаётся adjustment -330 ₽.
5. History остаётся объяснимой.

## Scenario F — Завершение цели

1. Goal достиг 100%.
2. User нажимает «Отметить покупку».
3. Указывает фактическую цену.
4. Выбирает счёт.
5. Expense отражается один раз.
6. Reserve закрывается.
7. Goal completed.
8. Архив показывает цель.

## Scenario G — Повторный вход

1. User logout.
2. Login снова.
3. Данные сохранены.
4. Другой аккаунт их не видит.

## Scenario H — iPhone PWA

1. Открывает в Safari.
2. Нажимает «Установить приложение».
3. Получает инструкцию.
4. Добавляет на экран «Домой».
5. Запускает через иконку.
6. Открывается standalone.
7. Safe areas корректны.

---

# 37. КЛЮЧЕВЫЕ FINANCIAL INVARIANTS

Добавь тесты/проверки:

1. transfer не меняет total capital;
2. goal reserve не создаёт деньги;
3. goal unreserve не создаёт деньги;
4. expense уменьшает total capital;
5. income увеличивает total capital;
6. adjustment меняет total capital только на delta;
7. delete/edit операции корректно пересчитывает state;
8. goal completion не списывает одну сумму дважды;
9. user не может проводить операцию по чужому accountId;
10. user не может читать/изменять чужой goalId;
11. free money = capital - reserved, если не используется более сложная модель;
12. одна и та же idempotent mutation не применяется повторно.

---

# 38. UNIT TESTS ДЛЯ РАСЧЁТОВ

Создай чистый finance/goal calculation module без UI-зависимостей.

Покрой тестами:

- remaining amount;
- 0 progress;
- 100% progress;
- overfunded goal;
- deadline today;
- deadline tomorrow;
- 1 week;
- 17 weeks;
- date in past;
- income = 0;
- expenses > income;
- available budget = 0;
- multiple goals;
- money rounding;
- minor units;
- weekly/monthly conversion;
- no-date 10/20/30% scenario;
- boundary dates;
- month/year transition.

Формулы должны быть детерминированными.

---

# 39. E2E TESTS

Playwright минимум:

1. registration;
2. onboarding;
3. create account;
4. add income;
5. add expense;
6. create second account;
7. transfer;
8. create goal;
9. contribute to goal;
10. verify dashboard;
11. reconcile account;
12. logout/login;
13. dark theme;
14. mobile viewport;
15. ownership protection на критическом flow, где возможно.

Если доступно — добавь screenshot tests основных страниц.

---

# 40. VISUAL QA

После реализации обязательно открой приложение как дизайнер.

Проверь:

- login;
- register;
- onboarding;
- home;
- account detail;
- operations;
- goal list;
- goal detail;
- analytics;
- profile;
- install PWA sheet;
- dark theme;
- empty states;
- error states;
- small iPhone viewport;
- desktop.

Ищи и исправляй:

- случайные большие пустоты;
- несогласованные отступы;
- плохую иерархию;
- overflow;
- сломанные карточки;
- слабый contrast;
- разные размеры иконок;
- плохую работу длинных русских текстов;
- проблемы с большими суммами;
- bottom nav поверх контента;
- safe-area defects.

---

# 41. МИКРОКОПИ

Язык по умолчанию:

**русский**

Стиль текста:

- короткий;
- взрослый;
- спокойный;
- дружелюбный;
- без канцелярита;
- без инфантильности;
- без давления.

Хорошо:

- «На этой неделе осталось отложить 3 500 ₽»
- «Цель идёт по плану»
- «До покупки — около 12 недель»

Плохо:

- «Вы не выполнили финансовый норматив»
- «УРААА! ТЫ СУПЕР!!!»
- «Совершить транзакционную операцию»

---

# 42. ERROR UX

Не показывай пользователю raw технические ошибки.

Нельзя:

- Prisma error;
- SQL error;
- stack trace;
- `undefined`;
- `[object Object]`.

Показывай понятные сообщения.

Примеры:

- «Не удалось сохранить операцию. Проверьте соединение и попробуйте ещё раз.»
- «Недостаточно доступных средств на выбранном счёте.»
- «Дата цели должна быть позже сегодняшней.»

Для dev logging оставь подробности.

---

# 43. НЕДОСТАТОК ДЕНЕГ

Определи и реализуй бизнес-правило.

Для debit/cash:

- по умолчанию запрещать расход/перевод выше доступного баланса;
- либо явно поддержать настройку `allowNegativeBalance`.

Для credit account отрицательный баланс допустим, если модель это поддерживает.

Ошибку не скрывать.

---

# 44. PRIVACY MODE

На главной у общего баланса должна быть кнопка-глаз.

Скрытый вид:

`•••••• ₽`

или эквивалент.

Состояние допустимо хранить локально как UI preference.

---

# 45. QUICK AMOUNTS

При пополнении хотелки:

- +500;
- +1000;
- +2000;
- своя сумма.

Адаптируй под валюту и не делай quick amounts единственным способом ввода.

---

# 46. «ЧТО БУДЕТ, ЕСЛИ»

Желательная, но ценная функция на goal detail.

Пользователь меняет:

**«Если откладывать X ₽ в месяц»**

Приложение показывает:

**«Цель будет достигнута примерно 18 апреля 2027»**

И одновременно:

**«Чтобы успеть к выбранной дате — Y ₽ в неделю»**

Реализуй, если это не ставит под угрозу основные обязательные функции.

---

# 47. ФИНАНСОВАЯ ПОДУШКА

Поддержи специальный тип хотелки:

**Финансовая подушка**

Если известны обязательные расходы, можно показать ориентиры:

- 3 месяца;
- 6 месяцев.

Формулировать как ориентир, а не персональный финансовый совет.

---

# 48. UI — ACCOUNT CARDS

Карточки счетов могут использовать:

- subtle gradients;
- абстрактную фирменную геометрию;
- баланс;
- название;
- тип;
- last4 optional.

Не копировать реальные карты банка 1:1.

---

# 49. UI — PROGRESS

Goal progress — один из главных эмоциональных элементов.

Можно использовать:

- custom circular SVG progress;
- linear progress;
- dynamic fill;
- комбинированную визуализацию.

Обязательно текстом показать saved / target и процент.

---

# 50. UI — ACTION SHEETS

На mobile:

- bottom sheet;
- большие touch targets;
- safe area;
- нормальная высота;
- закрытие по кнопке/жесту, если реализовано безопасно.

На desktop — modal/popover по контексту.

Не используй `window.confirm()` как основной destructive UX.

---

# 51. UI — БОЛЬШИЕ ЧИСЛА

Проверь:

- 1 250 ₽;
- 125 000 ₽;
- 12 500 000 ₽;
- 1 250 000 000 ₽, если поддерживается.

Не допускай некрасивого переноса символа валюты.

Используй tabular numerals, если доступно.

---

# 52. DARK THEME

Проверить отдельно:

- charts;
- cards;
- borders;
- inputs;
- action sheets;
- dialogs;
- positive/negative colors;
- disabled states;
- focus states;
- uploaded images;
- PWA theme colors.

Не делать тёмную тему простым invert.

---

# 53. FILE SECURITY

User-generated text:

- goal name;
- account name;
- comments.

Не вставлять через unsafe raw HTML.

Upload filename не доверять.

SVG upload пользователя не отображать inline без sanitizer.

---

# 54. BRAND ASSETS — СОЗДАТЬ ФИЗИЧЕСКИ В РЕПОЗИТОРИИ

Сгенерируй собственными средствами разработки:

- `logo-mark.svg`;
- `logo-horizontal.svg`;
- `favicon.svg`;
- `icon-192.png`;
- `icon-512.png`;
- maskable icon;
- apple-touch-icon;
- navigation SVGs;
- category SVGs;
- empty state SVGs;
- onboarding SVGs.

PNG-иконки PWA можно программно отрендерить из собственного SVG.

Все assets:

- оригинальные;
- оптимизированные;
- без remote dependencies;
- без чужих логотипов.

---

# 55. APP ICON

Создай узнаваемый оригинальный знак.

Требования:

- читается в 32 px;
- хорошо смотрится в iOS squircle;
- безопасно работает как maskable;
- нет мелкого текста;
- не копирует банк/кошелёк известного бренда.

Возможные направления:

- абстрактная буква «К»;
- монета + накопительный контейнер;
- уровни роста;
- цель + монета.

Выбери сильнейшую концепцию самостоятельно.

---

# 56. НЕЛЬЗЯ ИСПОЛЬЗОВАТЬ ВНЕШНИЕ КАРТИНКИ КАК ОСНОВУ UI

Основное приложение должно быть визуально законченным без Unsplash/Pexels и подобных сервисов.

Фото хотелки загружает пользователь.

Placeholder и иллюстрации — собственные.

---

# 57. ROUTING

Логическая структура может быть такой:

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
/app/settings
```

Фактический routing можешь улучшить.

Private routes защищать server-side.

Если logged-in пользователь открывает `/login` — redirect в приложение.

Если onboarding не завершён — redirect в onboarding.

---

# 58. DESTRUCTIVE ACTIONS И АРХИВ

Для удаления:

- transaction;
- goal;
- account;

используй собственный confirm dialog.

Для account и completed goal предпочтительнее archive.

Архивированные сущности:

- не мешают обычной навигации;
- не уничтожают историческую объяснимость;
- прошлые операции остаются доступны в аналитике.

---

# 59. DEMO / SEED

Можно сделать dev-only seed:

- accounts;
- operations;
- goals.

Но:

- production не создаёт demo data автоматически;
- dev credentials не использовать как production secret;
- seed логика отделена.

---

# 60. ENV И СЕКРЕТЫ

Создай `.env.example`.

Документируй:

- DATABASE_URL;
- session/auth secret;
- optional VAPID vars;
- optional storage config.

Никаких реальных production secrets в репозитории.

---

# 61. ЛОКАЛЬНЫЙ ЗАПУСК

Если уместно, добавь `docker-compose.yml` для PostgreSQL.

Желательный UX запуска:

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

Адаптируй под фактический package manager и stack.

---

# 62. README

Создай/обнови README.

Он должен содержать:

- что такое «Копилка»;
- stack;
- requirements;
- setup;
- env;
- DB;
- migrations;
- dev;
- build;
- tests;
- PWA install;
- особенности iOS;
- ledger model;
- goal reserve model;
- deployment notes;
- backup considerations.

README не заменяет реализацию.

---

# 63. MIGRATIONS

Создай реальные migrations.

Проверь:

- fresh database;
- apply migration;
- seed;
- startup.

---

# 64. PERFORMANCE

Следи за:

- bundle size;
- лишними client components;
- image optimization;
- N+1 queries;
- unnecessary polling;
- giant dependencies;
- hydration overhead.

Dashboard должен ощущаться быстрым.

Skeleton не должен вызывать сильный layout shift.

---

# 65. SERVER / CLIENT BOUNDARY

Не отправляй секреты на клиент.

Не загружай весь ledger без необходимости.

Агрегации делай эффективно.

Выбери последовательную архитектуру server actions/API и придерживайся её.

---

# 66. DATE / TIME

Храни transaction timestamps в UTC.

Отображай локально.

Goal target date воспринимать как календарную дату пользователя и не ломать из-за UTC offset.

Weekly boundaries должны быть предсказуемыми.

Вынеси date logic в отдельные helpers.

---

# 67. НЕ ДЕЛАТЬ

Запрещено:

- статический Figma-like mock вместо приложения;
- localStorage-only database для аккаунтов;
- plaintext password;
- hardcoded single user;
- fake API;
- hardcoded production demo transactions;
- несохраняющиеся формы;
- баланс только на клиенте;
- float как источник истины для денег;
- отсутствие ownership checks;
- копирование Т-Банка/Revolut/Monzo/Сбера 1:1;
- готовые icon packs;
- emoji вместо UI icon system;
- обязательные TODO;
- мёртвые кнопки;
- horizontal overflow на мобильном;
- `window.alert`/`window.confirm` как основной UX;
- двойной учёт денег в хотелках.

---

# 68. РЕКОМЕНДУЕМАЯ СТРУКТУРА РЕПОЗИТОРИЯ

Пример:

```text
src/
  app/
  components/
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
    goals/
    validation/
    pwa/
  server/
  styles/
  assets/
    icons/
    brand/
    illustrations/
prisma/
public/
  icons/
  pwa/
tests/
```

Не обязано быть 1:1, но разделение ответственности должно быть понятным.

---

# 69. ЭТАПЫ РАБОТЫ АГЕНТА

Работай последовательно, но не прекращай после отдельного этапа.

## Этап 1 — аудит

- inspect repo;
- определить stack;
- проверить текущий build/tests;
- понять ограничения.

## Этап 2 — foundation

- DB schema;
- migrations;
- auth;
- validation;
- money utilities;
- finance invariants.

## Этап 3 — design system

- brand concept;
- tokens;
- logo;
- unique icon system;
- light/dark;
- layout;
- auth screens;
- onboarding.

## Этап 4 — счета и операции

- accounts;
- opening balance;
- income;
- expense;
- transfer;
- reconciliation;
- history;
- categories.

## Этап 5 — хотелки

- create/edit/archive;
- target;
- target date;
- income/expenses relation;
- weekly plan;
- contributions;
- withdrawals;
- priority;
- completion;
- archive.

## Этап 6 — dashboard и analytics

- total capital;
- free/reserved money;
- weekly plan;
- recent operations;
- account cards;
- analytics;
- profile.

## Этап 7 — PWA

- manifest;
- service worker;
- icons;
- iOS install UX;
- offline behavior;
- standalone polish.

## Этап 8 — QA

- responsive;
- accessibility;
- dark mode;
- visual QA;
- error states;
- security review.

## Этап 9 — tests/build/docs

- unit;
- integration;
- e2e;
- lint;
- typecheck;
- production build;
- README.

---

# 70. QUALITY GATES

Перед завершением обязательно выполнить то, что соответствует выбранному stack:

```bash
lint
typecheck
unit tests
integration tests
e2e tests
production build
```

Все должны пройти.

Если конкретную проверку невозможно выполнить из-за ограничения окружения — сначала попытайся решить проблему, затем честно укажи ограничение в финальном отчёте.

Не оставляй TypeScript errors.

Не оставляй ESLint errors.

Не оставляй broken routes.

---

# 71. CRITICAL ACCEPTANCE CHECKLIST

Работа считается завершённой только если:

- [ ] проект реально запускается;
- [ ] production build проходит;
- [ ] регистрация работает;
- [ ] login/logout работает;
- [ ] password hashing реализован;
- [ ] private routes защищены;
- [ ] onboarding работает;
- [ ] счёт создаётся;
- [ ] opening balance сохраняется;
- [ ] income работает;
- [ ] expense работает;
- [ ] transfer атомарный;
- [ ] transfer не меняет total capital;
- [ ] reconciliation создаёт adjustment;
- [ ] history работает;
- [ ] categories работают;
- [ ] хотелка создаётся;
- [ ] target amount работает;
- [ ] already saved/reserved amount работает;
- [ ] target date работает;
- [ ] monthly income работает;
- [ ] mandatory expenses поддерживаются;
- [ ] weekly recommendation работает;
- [ ] monthly recommendation работает;
- [ ] feasibility check работает;
- [ ] goal contribution работает;
- [ ] goal contribution не удваивает капитал;
- [ ] goal withdrawal работает;
- [ ] multiple goals работают;
- [ ] weekly plan работает;
- [ ] goal progress работает;
- [ ] goal completion не делает double charge;
- [ ] completed archive работает;
- [ ] analytics работает;
- [ ] free/reserved/capital различаются правильно;
- [ ] light/dark/system theme работает;
- [ ] privacy toggle работает;
- [ ] mobile bottom nav работает;
- [ ] responsive layout не ломается;
- [ ] PWA manifest валиден;
- [ ] service worker работает;
- [ ] PWA icons созданы;
- [ ] Apple touch icon создан;
- [ ] iOS install instruction работает;
- [ ] unique icons созданы самим агентом;
- [ ] нет зависимости от готового icon pack для core UI;
- [ ] loading/empty/error states реализованы;
- [ ] accessibility basics соблюдены;
- [ ] unit tests финансовых расчётов проходят;
- [ ] e2e critical flows проходят;
- [ ] нет очевидного cross-user access;
- [ ] `.env.example` есть;
- [ ] migrations есть;
- [ ] README есть;
- [ ] нет обязательных TODO;
- [ ] нет неработающих core-кнопок.

---

# 72. ФИНАЛЬНЫЙ ОТЧЁТ CODEX

После завершения дай конкретный отчёт.

## Реализовано

Список фактически работающих функций.

## Архитектура

- stack;
- DB;
- auth;
- ledger model;
- goal reserve model;
- PWA layer.

## Дизайн

- фирменная концепция;
- где лежат SVG icons;
- где лежит app icon;
- theme system;
- какие уникальные assets созданы.

## Как запустить

Точные команды.

## Проверки

Указать реальный результат:

- lint;
- typecheck;
- unit;
- integration;
- e2e;
- build.

## Что требует внешней инфраструктуры

Только если реально требуется:

- production DB;
- push/VAPID;
- object storage;
- deployment secrets.

Не переносить незавершённую core-функцию в «future improvements» только чтобы объявить проект завершённым.

---

# 73. ИТОГОВОЕ ОЖИДАНИЕ

Мне нужен не эксперимент и не красивый frontend-макет.

Мне нужно ощущение, что после работы агента я получил **реальное PWA-приложение «Копилка»**, которое можно открыть на iPhone, добавить на экран «Домой» и использовать как персональный финансовый инструмент.

Главное визуальное ощущение:

> **спокойный, премиальный, современный финтех**

Главная продуктовая ценность:

> **«Я понимаю, сколько у меня денег, куда они уходят и сколько мне нужно откладывать, чтобы купить то, чего я хочу».**

Главное инженерное требование:

> **финансовая логика должна быть корректной, объяснимой, тестируемой и не допускать двойного учёта денег.**

Главное дизайн-требование:

> **Создай собственный визуальный язык «Копилки». Все ключевые иконки, логотип, PWA-иконки, empty states, onboarding-графика и основные UI-графические элементы должны быть уникальными и созданы самим агентом в репозитории по ходу разработки. Не заменяй эту работу готовыми иконпаками или шаблонным UI.**

---

# 74. НАЧИНАЙ РАБОТУ

1. Изучи текущий репозиторий.
2. Составь внутренний план реализации.
3. Приступай к коду.
4. Регулярно запускай проект и тесты.
5. Самостоятельно исправляй ошибки.
6. Не останавливайся после первой компилируемой версии.
7. Проведи визуальный и технический QA.
8. Продолжай до выполнения acceptance criteria.
9. В конце предоставь отчёт только по фактически выполненной работе.

**Не ограничивайся описанием. Реализуй приложение полностью.**
