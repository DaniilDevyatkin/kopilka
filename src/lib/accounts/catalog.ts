import type { AccountType } from "@/generated/prisma/client";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  DEBIT_CARD: "Дебетовая карта",
  CREDIT_CARD: "Кредитная карта",
  CASH: "Наличные",
  SAVINGS: "Накопительный счёт",
  BANK_ACCOUNT: "Счёт в банке",
  CUSTOM: "Другое",
};

export const ACCOUNT_TYPE_OPTIONS = (
  Object.entries(ACCOUNT_TYPE_LABELS) as Array<[AccountType, string]>
).map(([value, label]) => ({ value, label }));

export const CARD_THEMES = [
  {
    value: "koi-lagoon",
    label: "Карпы кои",
    src: "/card-themes/koi-lagoon.webp",
  },
  { value: "robo-cat", label: "Робокот", src: "/card-themes/robo-cat.webp" },
  {
    value: "origami-whale",
    label: "Кит-оригами",
    src: "/card-themes/origami-whale.webp",
  },
  {
    value: "disco-avocado",
    label: "Диско-авокадо",
    src: "/card-themes/disco-avocado.webp",
  },
  {
    value: "cloud-raccoon",
    label: "Енот в облаках",
    src: "/card-themes/cloud-raccoon.webp",
  },
  {
    value: "ramen-planet",
    label: "Рамэн-планета",
    src: "/card-themes/ramen-planet.webp",
  },
  {
    value: "gummy-treasure",
    label: "Мармеладный клад",
    src: "/card-themes/gummy-treasure.webp",
  },
  {
    value: "neon-jars",
    label: "Неоновый город",
    src: "/card-themes/neon-jars.webp",
  },
  {
    value: "capybara-voyage",
    label: "Капибара в пути",
    src: "/card-themes/capybara-voyage.webp",
  },
  {
    value: "bonsai-bank",
    label: "Бонсай-копилка",
    src: "/card-themes/bonsai-bank.webp",
  },
] as const;

export const VISUAL_THEMES = CARD_THEMES.map((theme) => theme.value);
export type VisualTheme = (typeof CARD_THEMES)[number]["value"];

const LEGACY_THEME_FALLBACK: Record<string, VisualTheme> = {
  default: "koi-lagoon",
  sunset: "disco-avocado",
  forest: "bonsai-bank",
  ocean: "origami-whale",
  graphite: "neon-jars",
};

export function cardThemeImage(theme: string): string {
  const normalized = normalizeCardTheme(theme);
  return (
    CARD_THEMES.find((entry) => entry.value === normalized)?.src ??
    CARD_THEMES[0].src
  );
}

export function normalizeCardTheme(theme: string): VisualTheme {
  const normalized = LEGACY_THEME_FALLBACK[theme] ?? theme;
  return CARD_THEMES.some((entry) => entry.value === normalized)
    ? (normalized as VisualTheme)
    : CARD_THEMES[0].value;
}

export type AccountKind = "debit" | "savings" | "credit";

export function accountKindForType(type: AccountType): AccountKind {
  switch (type) {
    case "CREDIT_CARD":
      return "credit";
    case "SAVINGS":
      return "savings";
    default:
      return "debit";
  }
}

export function isCardType(type: AccountType): boolean {
  return type === "DEBIT_CARD" || type === "CREDIT_CARD";
}

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type];
}
