import Link from "next/link";

import { EmptyState } from "@/components/ui";
import styles from "@/features/system/system-state.module.css";

export default function NotFound() {
  return (
    <main className={styles.fullPage}>
      <EmptyState
        icon="search"
        title="Такой страницы нет"
        description="Возможно, ссылка устарела."
        action={
          <Link className={styles.linkButton} href="/">
            На главную
          </Link>
        }
      />
    </main>
  );
}
