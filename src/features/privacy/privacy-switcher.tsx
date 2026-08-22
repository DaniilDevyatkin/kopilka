"use client";

import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui";
import { PRIVACY_STORAGE_KEY } from "@/features/privacy/privacy";

export function PrivacySwitcher() {
  const hidden = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("kopilka-privacy-change", onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("kopilka-privacy-change", onStoreChange);
      };
    },
    () => window.localStorage.getItem(PRIVACY_STORAGE_KEY) === "true",
    () => false,
  );

  function update(next: boolean) {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, String(next));
    document.documentElement.dataset.privacy = next ? "hidden" : "visible";
    window.dispatchEvent(new Event("kopilka-privacy-change"));
  }

  return (
    <Switch
      checked={hidden}
      onChange={(event) => update(event.target.checked)}
      label="Скрывать суммы"
      description="Суммы размываются на всех финансовых экранах этого устройства."
    />
  );
}
