import { notFound } from "next/navigation";

import { ThemeSwitcher } from "@/features/theme/theme-switcher";
import { UiPlayground } from "./ui-playground";
import styles from "./ui-playground.module.css";

export default function UiPrimitivesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className={styles.lab}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            Внутренняя лаборатория взаимодействий
          </p>
          <h1>Спокойные инструменты</h1>
          <p>
            Формы, состояния и слои «Копилки» проверяются реальным русским
            содержимым, с клавиатуры и на узком экране.
          </p>
        </div>
        <ThemeSwitcher />
      </header>
      <UiPlayground />
    </main>
  );
}
