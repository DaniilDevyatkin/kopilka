"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  resolveThemePreference,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/features/theme/theme";

const LABELS: Record<ThemePreference, string> = {
  light: "Светлая",
  dark: "Тёмная",
  system: "Системная",
};
const DESCRIPTIONS: Record<ThemePreference, string> = {
  light: "Воздух и мягкое золото",
  dark: "Глубокий нефрит",
  system: "Как на устройстве",
};
const THEME_CHANGE_EVENT = "kopilka-theme-change";

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(preference: ThemePreference): void {
  const resolved = resolveThemePreference(preference, systemPrefersDark());
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

function getThemeSnapshot(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
}

function getServerThemeSnapshot(): ThemePreference {
  return DEFAULT_THEME_PREFERENCE;
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const handlePreferenceChange = () => {
    applyTheme(getThemeSnapshot());
    onStoreChange();
  };
  const handleSystemChange = () => {
    const preference = getThemeSnapshot();
    if (preference === "system") applyTheme(preference);
    onStoreChange();
  };

  window.addEventListener("storage", handlePreferenceChange);
  window.addEventListener(THEME_CHANGE_EVENT, handlePreferenceChange);
  media?.addEventListener("change", handleSystemChange);
  return () => {
    window.removeEventListener("storage", handlePreferenceChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handlePreferenceChange);
    media?.removeEventListener("change", handleSystemChange);
  };
}

export function ThemeSwitcher() {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  function chooseTheme(nextPreference: ThemePreference): void {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    applyTheme(nextPreference);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <fieldset className="theme-switcher">
      <legend className="visually-hidden">Цветовая тема</legend>
      {THEME_PREFERENCES.map((option) => (
        <button
          className="theme-switcher__option"
          type="button"
          aria-pressed={preference === option}
          key={option}
          onClick={() => chooseTheme(option)}
        >
          <span
            className={`theme-switcher__preview theme-switcher__preview--${option}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <span className="theme-switcher__copy">
            <strong>{LABELS[option]}</strong>
            <small>{DESCRIPTIONS[option]}</small>
          </span>
          <span className="theme-switcher__check" aria-hidden="true">
            ✓
          </span>
        </button>
      ))}
    </fieldset>
  );
}
