"use client";

import { useEffect } from "react";

import { Button, ErrorState } from "@/components/ui";
import styles from "@/features/system/system-state.module.css";

export default function PrivateAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("private_app_render_failed", { digest: error.digest });
  }, [error]);
  return (
    <main className={styles.container}>
      <ErrorState
        title="Экран временно недоступен"
        description="Ваши данные не потеряны. Повторите загрузку или вернитесь позже."
        action={<Button onClick={reset}>Повторить</Button>}
      />
    </main>
  );
}
