import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { PwaRuntime } from "@/features/pwa/pwa-runtime";
import { AppNavigation } from "./app-navigation";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PwaRuntime>
      <div className={styles.appShell}>
        <a className={styles.skipLink} href="#main-content">
          Перейти к содержимому
        </a>
        <header className={styles.mobileHeader}>
          <Link
            className={styles.mobileBrand}
            href="/app/home"
            aria-label="Копилка, на главную"
          >
            <Image
              src="/logo-macbookus.png"
              alt=""
              width={512}
              height={512}
              priority
            />
            <span>Копилка</span>
          </Link>
        </header>
        <AppNavigation />
        <main id="main-content" className={styles.mainContent} tabIndex={-1}>
          {children}
        </main>
      </div>
    </PwaRuntime>
  );
}
