import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./app-shell.module.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.authShell}>
      <Link href="/" className={styles.authBrand} aria-label="Копилка — начало">
        <Image
          src="/logo-macbookus.png"
          alt=""
          width={512}
          height={512}
          priority
        />
      </Link>
      <div className={styles.authContent}>{children}</div>
    </main>
  );
}
