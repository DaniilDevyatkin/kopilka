import { describe, expect, it } from "vitest";

import {
  GOAL_CATEGORIES,
  GOAL_CATEGORY_VALUES,
  GOAL_PRIORITIES,
} from "@/lib/goals/catalog";

describe("goal domain catalog", () => {
  it("defines the complete stable category catalog with own AppIcon names", () => {
    expect(GOAL_CATEGORIES).toEqual([
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
    ]);
    expect(GOAL_CATEGORY_VALUES).toHaveLength(11);
  });

  it("defines high, medium and low priorities in business order", () => {
    expect(GOAL_PRIORITIES).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });
});
