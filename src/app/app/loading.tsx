import { Skeleton } from "@/components/ui";
import styles from "@/features/system/system-state.module.css";

export default function PrivateAppLoading() {
  return (
    <main className={styles.container} aria-label="Загрузка экрана">
      <Skeleton variant="card" lines={3} />
    </main>
  );
}
