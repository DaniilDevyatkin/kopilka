"use client";

import { useState } from "react";

import { AppIcon } from "@/components/icons";
import { Button, Surface } from "@/components/ui";
import { usePwaRuntime } from "@/features/pwa/pwa-runtime";
import styles from "./pwa.module.css";

export function InstallCard() {
  const { install, installKind } = usePwaRuntime();
  const [dismissed, setDismissed] = useState(false);

  if (
    installKind === "installed" ||
    installKind === "unsupported" ||
    dismissed
  ) {
    return null;
  }

  return (
    <Surface className={styles.installCard} aria-labelledby="install-title">
      <span className={styles.installIcon} aria-hidden="true">
        <AppIcon name="install" size={24} />
      </span>
      <div className={styles.installCopy}>
        <h2 id="install-title">Установить Копилку</h2>
        {installKind === "ios" ? (
          <p>
            В Safari нажмите «Поделиться»{" "}
            <AppIcon name="share" size={16} title="Поделиться" />, затем «На
            экран Домой»{" "}
            <AppIcon name="home-screen" size={16} title="На экран Домой" />.
          </p>
        ) : installKind === "prompt" ? (
          <p>
            Откройте Копилку как отдельное приложение — с собственным окном и
            безопасным offline-просмотром.
          </p>
        ) : (
          <p>
            Откройте меню браузера и выберите установку приложения или
            добавление на главный экран.
          </p>
        )}
      </div>
      <div className={styles.installActions}>
        {installKind === "prompt" ? (
          <Button type="button" onClick={() => void install()}>
            Установить
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDismissed(true)}
        >
          Не сейчас
        </Button>
      </div>
    </Surface>
  );
}
