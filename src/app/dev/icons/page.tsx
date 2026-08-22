import { notFound } from "next/navigation";

import { AppIcon } from "@/components/icons";
import { ThemeSwitcher } from "@/features/theme/theme-switcher";
import { ICON_GROUPS, ICON_LABELS } from "./icon-gallery-data";
import styles from "./icons.module.css";

export default function IconGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className={styles.gallery}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Внутренняя библиотека · 71 знак</p>
          <h1>Язык тихих действий</h1>
          <p className={styles.intro}>
            Одна сетка 24 × 24, округлённый штрих 1,8 и цвет от контекста. Без
            готовых пакетов, emoji и удалённых SVG.
          </p>
        </div>
        <ThemeSwitcher />
        <div
          className={styles.heroSpecimen}
          aria-label="Иконка финансовой цели"
        >
          <AppIcon name="goals" size={24} title="Финансовая цель" />
          <span aria-hidden="true">16</span>
          <AppIcon name="goals" size={16} />
          <span aria-hidden="true">20</span>
          <AppIcon name="goals" size={20} />
          <span aria-hidden="true">24</span>
          <AppIcon name="goals" size={24} />
        </div>
      </header>

      {ICON_GROUPS.map((group, groupIndex) => (
        <section
          className={styles.section}
          key={group.title}
          aria-labelledby={`icon-group-${groupIndex}`}
        >
          <div className={styles.sectionHeading}>
            <span>{String(groupIndex + 1).padStart(2, "0")}</span>
            <div>
              <h2 id={`icon-group-${groupIndex}`}>{group.title}</h2>
              <p>{group.note}</p>
            </div>
          </div>
          <ul className={styles.iconGrid}>
            {group.names.map((name) => (
              <li className={styles.iconCard} key={name}>
                <div className={styles.sample} aria-hidden="true">
                  <AppIcon name={name} size={24} />
                </div>
                <div className={styles.cardCopy}>
                  <strong>{ICON_LABELS[name]}</strong>
                  <code>{name}</code>
                </div>
                <div
                  className={styles.sizes}
                  aria-label={`Размеры иконки «${ICON_LABELS[name]}»`}
                >
                  <AppIcon
                    name={name}
                    size={16}
                    title={`${ICON_LABELS[name]}, 16 пикселей`}
                  />
                  <AppIcon
                    name={name}
                    size={20}
                    title={`${ICON_LABELS[name]}, 20 пикселей`}
                  />
                  <AppIcon
                    name={name}
                    size={24}
                    title={`${ICON_LABELS[name]}, 24 пикселя`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
