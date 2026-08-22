// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import {
  AccountCardArtwork,
  EmptyStateArtwork,
  GoalCategoryArtwork,
  GoalCompletionArtwork,
  OnboardingArtwork,
} from "@/components/graphics";

afterEach(() => {
  cleanup();
});

describe("artwork accessibility contract", () => {
  it("renders decorative artwork hidden from assistive technology", () => {
    render(<AccountCardArtwork kind="debit" />);

    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.hasAttribute("role")).toBe(false);
    expect(svg?.querySelector("title")).toBeNull();
  });

  it("names artwork when a title is provided", () => {
    render(<OnboardingArtwork variant="income" title="Доход по плану" />);

    const svg = document.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Доход по плану");
    expect(svg?.hasAttribute("aria-hidden")).toBe(false);
    expect(svg?.querySelector("title")?.textContent).toBe("Доход по плану");
  });

  it("defaults empty-state titles to their copy", () => {
    render(<EmptyStateArtwork variant="goals" />);
    const svg = document.querySelector("svg");
    expect(svg?.querySelector("title")?.textContent).toBe("Пока нет хотелок");
  });
});

describe("artwork variants", () => {
  it("renders every onboarding variant", () => {
    const variants = ["welcome", "accounts", "income", "goals"] as const;
    for (const variant of variants) {
      const { unmount } = render(<OnboardingArtwork variant={variant} />);
      expect(document.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("renders the goal glyph inside a category tile", () => {
    render(<GoalCategoryArtwork name="goal-car" />);

    const svg = document.querySelector("svg");
    const nested = svg?.querySelector("svg");
    expect(nested?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(nested?.querySelectorAll("path,circle,rect,line")).not.toHaveLength(
      0,
    );
  });

  it("adapts the account card contour to its kind", () => {
    const kinds = ["debit", "savings", "credit"] as const;
    for (const kind of kinds) {
      const { unmount } = render(<AccountCardArtwork kind={kind} />);
      const svg = document.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 120 80");
      unmount();
    }
  });

  it("renders the completion state", () => {
    render(<GoalCompletionArtwork />);
    expect(document.querySelector("svg")).not.toBeNull();
  });
});
