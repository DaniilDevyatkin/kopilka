import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { ThemeSwitcher } from "@/features/theme/theme-switcher";
import styles from "./design-system.module.css";

const semanticColors = [
  ["Фон", "--bg"],
  ["Поверхность", "--surface"],
  ["Приподнятая", "--surface-elevated"],
  ["Акцент", "--accent"],
  ["Рост", "--positive"],
  ["Снижение", "--negative"],
  ["Внимание", "--warning"],
  ["Фокус", "--focus"],
] as const;

const chartValues = [42, 66, 54, 82, 61, 91];

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className={styles.lab}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Внутренняя визуальная лаборатория</p>
          <h1>Тихая точность</h1>
          <p className="long-copy">
            «Копилка» говорит о деньгах спокойно: тёплая бумага вместо
            стерильного белого, минеральный нефрит вместо банковского синего и
            ясная иерархия без декоративного шума.
          </p>
        </div>
        <ThemeSwitcher />
        <div className={styles.growthMark} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>

      <section className={styles.section} aria-labelledby="semantic-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>01</p>
          <div>
            <h2 id="semantic-title">Смысл раньше оттенка</h2>
            <p>
              Цвет закреплён за ролью и меняется независимо для каждой темы.
            </p>
          </div>
        </div>
        <ul className={styles.swatches}>
          {semanticColors.map(([label, token]) => (
            <li key={token}>
              <span
                className={styles.swatch}
                style={{ backgroundColor: `var(${token})` }}
                aria-hidden="true"
              />
              <strong>{label}</strong>
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="type-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>02</p>
          <div>
            <h2 id="type-title">Числа стоят спокойно</h2>
            <p>Табулярные цифры, неразрывная валюта и масштаб без скачков.</p>
          </div>
        </div>
        <div className={styles.typeSpecimen}>
          <div>
            <p className={styles.typeLabel}>Главная сумма</p>
            <p
              className={`${styles.heroAmount} amount`}
              aria-label="Один миллиард двести пятьдесят миллионов рублей"
            >
              1 250 000 000&nbsp;₽
            </p>
          </div>
          <div className={styles.typeScale}>
            <p className={styles.titleSample}>Цель становится ближе</p>
            <p className="long-copy">
              Даже очень длинное русское описание сохраняет размеренный ритм,
              переносится осмысленно и не раздвигает мобильную страницу по
              горизонтали.
            </p>
            <p className={styles.captionSample}>Обновлено сегодня, в 18:40</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="accounts-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>03</p>
          <div>
            <h2 id="accounts-title">Счета — разные по характеру</h2>
            <p>
              Не копии банковских карт, а компактные контейнеры финансового
              контекста.
            </p>
          </div>
        </div>
        <div className={styles.accountGrid}>
          <article className={`${styles.accountCard} ${styles.debit}`}>
            <p>На каждый день</p>
            <strong className="amount">125 000&nbsp;₽</strong>
            <span>Дебетовый · 4821</span>
          </article>
          <article className={`${styles.accountCard} ${styles.savings}`}>
            <p>Спокойный резерв</p>
            <strong className="amount">1 250 000&nbsp;₽</strong>
            <span>Накопительный</span>
          </article>
          <article className={`${styles.accountCard} ${styles.credit}`}>
            <p>Кредитный лимит</p>
            <strong className="amount">48 700&nbsp;₽</strong>
            <span>Доступно · 0904</span>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="states-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>04</p>
          <div>
            <h2 id="states-title">Состояние понятно без цвета</h2>
            <p>Текст, форма и цвет работают вместе.</p>
          </div>
        </div>
        <div className={styles.stateLayout}>
          <div
            className={styles.statuses}
            aria-label="Примеры финансовых статусов"
          >
            <p className={styles.positive}>
              <span aria-hidden="true">+</span> Доход&nbsp;72 000&nbsp;₽
            </p>
            <p className={styles.negative}>
              <span aria-hidden="true">−</span> Расход&nbsp;18 460&nbsp;₽
            </p>
            <p className={styles.warning}>
              <span aria-hidden="true">!</span> План требует внимания
            </p>
          </div>
          <form className={styles.controls}>
            <label htmlFor="design-system-amount">Сумма пополнения</label>
            <input
              id="design-system-amount"
              inputMode="decimal"
              placeholder="0 ₽"
            />
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="button">
                Продолжить
              </button>
              <button className={styles.secondaryButton} type="button">
                Отложить
              </button>
              <button className={styles.secondaryButton} type="button" disabled>
                Недоступно
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="chart-title">
        <div className={styles.sectionHeading}>
          <p className={styles.index}>05</p>
          <div>
            <h2 id="chart-title">Графики продолжают язык</h2>
            <p>Шесть различимых серий и обязательная текстовая альтернатива.</p>
          </div>
        </div>
        <figure className={styles.chart}>
          <div className={styles.bars} aria-hidden="true">
            {chartValues.map((value, index) => (
              <span
                key={value}
                style={
                  {
                    "--bar-size": `${value}%`,
                    "--bar-index": index + 1,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <figcaption>
            За последние шесть месяцев капитал вырос с 420 000 до 910 000
            рублей.
          </figcaption>
        </figure>
      </section>
    </main>
  );
}
