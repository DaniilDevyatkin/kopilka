import { notFound } from "next/navigation";

import {
  CircularProgress,
  DonutChart,
  GoalProgress,
  LineChart,
  WeeklyPlanProgress,
} from "@/components/charts";
import {
  AccountCardArtwork,
  EmptyStateArtwork,
  GoalCategoryArtwork,
  GoalCompletionArtwork,
  OnboardingArtwork,
} from "@/components/graphics";
import { MAX_MONEY_MINOR } from "@/lib/money";
import { ThemeSwitcher } from "@/features/theme/theme-switcher";
import styles from "./graphics.module.css";

const GOAL_NAMES = [
  "goal-tech",
  "goal-travel",
  "goal-car",
  "goal-housing",
  "goal-education",
  "goal-gift",
  "goal-clothes",
  "goal-health",
  "goal-hobby",
  "goal-emergency-fund",
] as const;

const LINE_POINTS = [
  { x: "Янв", value: 4_000_000n },
  { x: "Фев", value: 9_200_000n },
  { x: "Мар", value: 7_100_000n },
  { x: "Апр", value: 14_800_000n },
  { x: "Май", value: 12_900_000n },
  { x: "Июн", value: 20_500_000n },
] as const;

const DONUT_SEGMENTS = [
  { label: "Жильё", value: 180_000_000n },
  { label: "Путешествия", value: 64_000_000n },
  { label: "Техника", value: 41_000_000n },
  { label: "Обучение", value: 21_000_000n },
  { label: "Резерв", value: 94_000_000n },
] as const;

const WEEK_DAYS = [
  { day: "Пн", plannedMinor: 200_000n, contributedMinor: 200_000n },
  { day: "Вт", plannedMinor: 200_000n, contributedMinor: 200_000n },
  { day: "Ср", plannedMinor: 200_000n, contributedMinor: 150_000n },
  { day: "Чт", plannedMinor: 200_000n, contributedMinor: 200_000n },
  { day: "Пт", plannedMinor: 200_000n, contributedMinor: 350_000n },
  { day: "Сб", plannedMinor: 200_000n, contributedMinor: 0n },
  { day: "Вс", plannedMinor: 200_000n, contributedMinor: 0n },
] as const;

export default function GraphicsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className={styles.lab}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Внутренняя галерея</p>
          <h1>Собственная графика и графики</h1>
          <p className="long-copy">
            Никаких стоков, эмодзи и внешних иконок: локальный вектор на токенах
            темы. У каждого графика есть текстовая альтернатива, и смысл никогда
            не передаётся только цветом.
          </p>
        </div>
        <ThemeSwitcher />
      </header>

      <section className={styles.section} aria-labelledby="artwork-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>01</p>
          <div>
            <h2 id="artwork-title">Графика онбординга</h2>
            <p>Четыре шага на языке «контура накопления».</p>
          </div>
        </div>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <OnboardingArtwork variant="welcome" />
            <span>Знакомство</span>
          </div>
          <div className={styles.tile}>
            <OnboardingArtwork variant="accounts" />
            <span>Первый счёт</span>
          </div>
          <div className={styles.tile}>
            <OnboardingArtwork variant="income" />
            <span>Доход</span>
          </div>
          <div className={styles.tile}>
            <OnboardingArtwork variant="goals" />
            <span>Первая хотелка</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="empty-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>02</p>
          <div>
            <h2 id="empty-title">Пустые состояния</h2>
            <p>Картинка молчит — текст рядом говорит.</p>
          </div>
        </div>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <EmptyStateArtwork variant="accounts" />
            <span>Нет счетов</span>
          </div>
          <div className={styles.tile}>
            <EmptyStateArtwork variant="transactions" />
            <span>Нет операций</span>
          </div>
          <div className={styles.tile}>
            <EmptyStateArtwork variant="goals" />
            <span>Нет хотелок</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="category-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>03</p>
          <div>
            <h2 id="category-title">Категории хотелок</h2>
            <p>Канонические глифы из каталога иконок, увеличенные в плитке.</p>
          </div>
        </div>
        <div className={styles.tiles}>
          {GOAL_NAMES.map((name) => (
            <div className={styles.tile} key={name}>
              <GoalCategoryArtwork name={name} size={72} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="cards-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>04</p>
          <div>
            <h2 id="cards-title">Декор карточек счетов</h2>
            <p>Контур подстраивается под цвет каждой карточки.</p>
          </div>
        </div>
        <div className={styles.accountGrid}>
          <article className={`${styles.accountCard} ${styles.debit}`}>
            <AccountCardArtwork kind="debit" />
            <p>На каждый день</p>
            <strong className="amount">125 000&nbsp;₽</strong>
            <span>Дебетовый · 4821</span>
          </article>
          <article className={`${styles.accountCard} ${styles.savings}`}>
            <AccountCardArtwork kind="savings" />
            <p>Спокойный резерв</p>
            <strong className="amount">1 250 000&nbsp;₽</strong>
            <span>Накопительный</span>
          </article>
          <article className={`${styles.accountCard} ${styles.credit}`}>
            <AccountCardArtwork kind="credit" />
            <p>Кредитный лимит</p>
            <strong className="amount">48 700&nbsp;₽</strong>
            <span>Доступно · 0904</span>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="completion-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>05</p>
          <div>
            <h2 id="completion-title">Достижение цели</h2>
            <p>Премиальный финал: кольцо закрыто, монета на месте.</p>
          </div>
        </div>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <GoalCompletionArtwork />
            <span>Цель достигнута</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="progress-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>06</p>
          <div>
            <h2 id="progress-title">Линейный прогресс</h2>
            <p>0 %, 100 % и переполнение — честные значения, не цвет.</p>
          </div>
        </div>
        <div className={styles.stack}>
          <GoalProgress
            label="Начали"
            savedMinor={0n}
            targetMinor={50_000_000n}
            currency="RUB"
          />
          <GoalProgress
            label="Идём"
            savedMinor={27_500_000n}
            targetMinor={50_000_000n}
            currency="RUB"
          />
          <GoalProgress
            label="Готово"
            savedMinor={50_000_000n}
            targetMinor={50_000_000n}
            currency="RUB"
          />
          <GoalProgress
            label="Сверх цели"
            savedMinor={64_000_000n}
            targetMinor={50_000_000n}
            currency="RUB"
          />
          <GoalProgress
            label="Очень большая сумма"
            savedMinor={MAX_MONEY_MINOR}
            targetMinor={MAX_MONEY_MINOR}
            currency="RUB"
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="circular-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>07</p>
          <div>
            <h2 id="circular-title">Круговой прогресс</h2>
            <p>Дуга до цели; переполнение меняет формулировку на «100%+».</p>
          </div>
        </div>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <CircularProgress
              label="Начали"
              savedMinor={0n}
              targetMinor={50_000_000n}
              currency="RUB"
            />
            <span>0 %</span>
          </div>
          <div className={styles.tile}>
            <CircularProgress
              label="Половина"
              savedMinor={25_000_000n}
              targetMinor={50_000_000n}
              currency="RUB"
            />
            <span>50 %</span>
          </div>
          <div className={styles.tile}>
            <CircularProgress
              label="Готово"
              savedMinor={50_000_000n}
              targetMinor={50_000_000n}
              currency="RUB"
            />
            <span>100 %</span>
          </div>
          <div className={styles.tile}>
            <CircularProgress
              label="Сверх цели"
              savedMinor={61_000_000n}
              targetMinor={50_000_000n}
              currency="RUB"
            />
            <span>100 %+</span>
          </div>
          <div className={styles.tile}>
            <CircularProgress
              label="Максимум"
              savedMinor={MAX_MONEY_MINOR}
              targetMinor={MAX_MONEY_MINOR}
              currency="RUB"
            />
            <span>Максимум bigint</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="week-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>08</p>
          <div>
            <h2 id="week-title">План недели</h2>
            <p>Семь баров плюс итог; числа доступны построчно.</p>
          </div>
        </div>
        <div className={styles.stack}>
          <WeeklyPlanProgress
            days={WEEK_DAYS}
            plannedTotalMinor={1_400_000n}
            contributedTotalMinor={1_100_000n}
            currency="RUB"
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="line-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>09</p>
          <div>
            <h2 id="line-title">Динамика</h2>
            <p>Линия и площадь на сетке, подпись обязательна.</p>
          </div>
        </div>
        <div className={styles.stack}>
          <LineChart
            points={LINE_POINTS}
            xLabels={LINE_POINTS.map((point) => point.x)}
            summary="За полгода капитал вырос со 40 000 до 205 000 рублей."
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="donut-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>10</p>
          <div>
            <h2 id="donut-title">Разбивка по категориям</h2>
            <p>Сегменты различаются по палитре и всегда названы текстом.</p>
          </div>
        </div>
        <div className={styles.stack}>
          <DonutChart
            segments={DONUT_SEGMENTS}
            currency="RUB"
            summary="Распределение хотелок: жильё — 1 800 000, путешествия — 640 000, техника — 410 000, обучение — 210 000, резерв — 940 000 рублей."
          />
        </div>
      </section>
    </main>
  );
}
