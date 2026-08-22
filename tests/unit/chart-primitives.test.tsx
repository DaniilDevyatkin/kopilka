// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  CircularProgress,
  DonutChart,
  GoalProgress,
  LineChart,
  WeeklyPlanProgress,
} from "@/components/charts";
import { describeGoalProgress } from "@/components/charts";
import { MAX_MONEY_MINOR } from "@/lib/money";

afterEach(() => {
  cleanup();
});

describe("describeGoalProgress", () => {
  it("handles an empty goal", () => {
    const meta = describeGoalProgress({
      savedMinor: 0n,
      targetMinor: 50_000_000n,
      currency: "RUB",
    });

    expect(meta.percentText).toBe("0%");
    expect(meta.isFunded).toBe(false);
    expect(meta.isOverfunded).toBe(false);
    expect(meta.surplusText).toBeNull();
    expect(meta.cappedPercent).toBe(0);
    expect(meta.valueText).toMatch(/0\s?₽/);
  });

  it("reports an exact 100% funded goal", () => {
    const meta = describeGoalProgress({
      savedMinor: 50_000_000n,
      targetMinor: 50_000_000n,
      currency: "RUB",
    });

    expect(meta.percentText).toBe("100%");
    expect(meta.isFunded).toBe(true);
    expect(meta.isOverfunded).toBe(false);
    expect(meta.cappedPercent).toBe(100);
  });

  it("caps the fill but reports the surplus for an overfunded goal", () => {
    const meta = describeGoalProgress({
      savedMinor: 64_000_000n,
      targetMinor: 50_000_000n,
      currency: "RUB",
    });

    expect(meta.percentText).toBe("100%+");
    expect(meta.isOverfunded).toBe(true);
    expect(meta.cappedPercent).toBe(100);
    expect(meta.surplusText).toMatch(/140\s?000/);
    expect(meta.valueText).toContain("сверх цели");
  });

  it("keeps bigint precision at the maximum money value", () => {
    const meta = describeGoalProgress({
      savedMinor: MAX_MONEY_MINOR,
      targetMinor: MAX_MONEY_MINOR,
      currency: "RUB",
    });

    expect(meta.percentText).toBe("100%");
    expect(meta.cappedPercent).toBe(100);
    expect(meta.savedText).toMatch(/92\s?233\s?720\s?368\s?547\s?758/);
  });

  it("floors the percent like the calculator", () => {
    const meta = describeGoalProgress({
      savedMinor: 12_500_000n,
      targetMinor: 40_000_000n,
      currency: "EUR",
      locale: "de-DE",
    });

    expect(meta.percentText).toBe("31%");
  });
});

describe("GoalProgress", () => {
  it("exposes honest progressbar values", () => {
    render(
      <GoalProgress
        label="Путешествия"
        savedMinor={27_500_000n}
        targetMinor={50_000_000n}
        currency="RUB"
      />,
    );

    const bar = screen.getByRole("progressbar", { name: "Путешествия" });
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("50000000");
    expect(bar.getAttribute("aria-valuenow")).toBe("27500000");
    expect(bar.getAttribute("aria-valuetext")).toMatch(/275\s?000/);
    expect(bar.getAttribute("aria-valuetext")).toContain("55%");
  });

  it("announces the surplus of an overfunded goal in text", () => {
    render(
      <GoalProgress
        label="Резерв"
        savedMinor={64_000_000n}
        targetMinor={50_000_000n}
        currency="RUB"
      />,
    );

    expect(
      screen.getByRole("progressbar").getAttribute("aria-valuetext"),
    ).toContain("сверх цели");
    expect(screen.getByText(/140\s?000/)).toBeTruthy();
  });

  it("renders an empty goal without overflow", () => {
    render(
      <GoalProgress
        label="Начали"
        savedMinor={0n}
        targetMinor={50_000_000n}
        currency="RUB"
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
  });
});

describe("CircularProgress", () => {
  it("reports the percent in text inside the ring", () => {
    render(
      <CircularProgress
        label="Ремонт"
        savedMinor={250_000n}
        targetMinor={500_000n}
        currency="RUB"
      />,
    );

    const ring = screen.getByRole("progressbar", { name: "Ремонт" });
    expect(ring.getAttribute("aria-valuetext")).toContain("50%");
    expect(ring.textContent).toContain("50%");
  });

  it("reads 100%+ for an overfunded goal", () => {
    render(
      <CircularProgress
        label="Ремонт"
        savedMinor={610_000n}
        targetMinor={500_000n}
        currency="RUB"
      />,
    );

    const ring = screen.getByRole("progressbar", { name: "Ремонт" });
    expect(ring.textContent).toContain("100%+");
    expect(ring.getAttribute("aria-valuetext")).toContain("сверх цели");
  });
});

describe("WeeklyPlanProgress", () => {
  const days = [
    { day: "Пн", plannedMinor: 2_000n, contributedMinor: 2_000n },
    { day: "Вт", plannedMinor: 2_000n, contributedMinor: 1_000n },
  ] as const;

  it("carries a total progressbar and per-day text numbers", () => {
    render(
      <WeeklyPlanProgress
        days={days}
        plannedTotalMinor={4_000n}
        contributedTotalMinor={3_000n}
        currency="RUB"
      />,
    );

    const bar = screen.getByRole("progressbar", { name: "План недели" });
    expect(bar.getAttribute("aria-valuenow")).toBe("3000");
    expect(bar.getAttribute("aria-valuetext")).toContain("75%");
    expect(screen.getByText("Пн")).toBeTruthy();
    expect(screen.getByText("Вт")).toBeTruthy();
  });
});

describe("LineChart", () => {
  it("requires and renders the text alternative", () => {
    render(
      <LineChart
        points={[
          { x: "Янв", value: 40_000n },
          { x: "Фев", value: 92_000n },
        ]}
        summary="Капитал вырос со 40 000 до 92 000 рублей."
      />,
    );

    const caption = document.querySelector("figcaption");
    expect(caption?.textContent).toContain("92 000");
    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});

describe("DonutChart", () => {
  const segments = [
    { label: "Жильё", value: 1_800_000n },
    { label: "Техника", value: 200_000n },
  ] as const;

  it("labels every segment in the legend with its exact amount", () => {
    render(
      <DonutChart
        segments={segments}
        currency="RUB"
        summary="Жильё 1 800 000, техника 200 000 рублей."
      />,
    );

    expect(screen.getByText("Жильё")).toBeTruthy();
    expect(screen.getByText("Техника")).toBeTruthy();
    expect(screen.getByText(/1 800 000/)).toBeTruthy();
    expect(screen.getByText(/200 000/)).toBeTruthy();
    expect(document.querySelector("figcaption")?.textContent).toContain(
      "1 800 000",
    );
  });
});
