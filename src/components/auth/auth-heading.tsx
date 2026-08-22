import { AppIcon, type AppIconName } from "@/components/icons";
import styles from "./auth.module.css";

export function AuthHeading({
  eyebrow,
  title,
  description,
  icon,
  titleId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: AppIconName;
  titleId?: string;
}) {
  return (
    <header className={icon ? styles.heading : styles.headingPlain}>
      {icon ? (
        <span className={styles.headingIcon} aria-hidden="true">
          <AppIcon name={icon} size={24} />
        </span>
      ) : null}
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </div>
    </header>
  );
}
