"use client";

import { useState } from "react";

import { AppIcon } from "@/components/icons";
import { Button, Dialog, IconButton } from "@/components/ui";
import { usePwaRuntime } from "./pwa-runtime";
import styles from "./pwa.module.css";

export function InstallAffordance() {
  const { install, installKind } = usePwaRuntime();
  const [open, setOpen] = useState(false);
  if (installKind === "installed" || installKind === "unsupported") return null;
  return (
    <>
      <IconButton
        className={styles.installAffordance}
        icon="install"
        label="Установить Копилку"
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Копилка на главном экране"
        description="Открывается на весь экран и сохраняет безопасный снимок финансов для просмотра без сети."
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
        }
      >
        {installKind === "ios" ? (
          <p className={styles.installInstruction}>
            <AppIcon name="share" size={20} />В Safari нажмите «Поделиться»,
            затем «На экран Домой».
          </p>
        ) : installKind === "prompt" ? (
          <Button
            onClick={() =>
              void install().then((accepted) => accepted && setOpen(false))
            }
          >
            Установить приложение
          </Button>
        ) : (
          <p className={styles.installInstruction}>
            <AppIcon name="home-screen" size={20} />
            Откройте меню браузера и выберите «Установить приложение».
          </p>
        )}
      </Dialog>
    </>
  );
}
