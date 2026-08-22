import type { GoalIconName } from "@/components/icons/icon-names";

export const GOAL_CATEGORY_VALUES = [
  "TECH",
  "TRAVEL",
  "CAR",
  "HOUSING",
  "EDUCATION",
  "GIFT",
  "CLOTHES",
  "HEALTH",
  "HOBBY",
  "EMERGENCY_FUND",
  "OTHER",
] as const;

export type GoalCategoryValue = (typeof GOAL_CATEGORY_VALUES)[number];

export const GOAL_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type GoalPriorityValue = (typeof GOAL_PRIORITIES)[number];

export interface GoalCategoryEntry {
  value: GoalCategoryValue;
  slug: string;
  labelRu: string;
  iconName: GoalIconName;
}

export const GOAL_CATEGORIES = [
  {
    value: "TECH",
    slug: "tech",
    labelRu: "Техника",
    iconName: "goal-tech",
  },
  {
    value: "TRAVEL",
    slug: "travel",
    labelRu: "Путешествие",
    iconName: "goal-travel",
  },
  {
    value: "CAR",
    slug: "car",
    labelRu: "Автомобиль",
    iconName: "goal-car",
  },
  {
    value: "HOUSING",
    slug: "housing",
    labelRu: "Жильё",
    iconName: "goal-housing",
  },
  {
    value: "EDUCATION",
    slug: "education",
    labelRu: "Образование",
    iconName: "goal-education",
  },
  {
    value: "GIFT",
    slug: "gift",
    labelRu: "Подарок",
    iconName: "goal-gift",
  },
  {
    value: "CLOTHES",
    slug: "clothes",
    labelRu: "Одежда",
    iconName: "goal-clothes",
  },
  {
    value: "HEALTH",
    slug: "health",
    labelRu: "Здоровье",
    iconName: "goal-health",
  },
  {
    value: "HOBBY",
    slug: "hobby",
    labelRu: "Хобби",
    iconName: "goal-hobby",
  },
  {
    value: "EMERGENCY_FUND",
    slug: "emergency-fund",
    labelRu: "Финансовая подушка",
    iconName: "goal-emergency-fund",
  },
  {
    value: "OTHER",
    slug: "other",
    labelRu: "Другое",
    iconName: "goal-other",
  },
] as const satisfies readonly GoalCategoryEntry[];
