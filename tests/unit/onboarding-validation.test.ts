import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { submitBudgetStepInputSchema } from "@/server/onboarding/validation";

const validBudget = {
  monthlyIncomeMinor: 150_000n,
  mandatoryMonthlyExpensesMinor: 60_000n,
  timeZone: "Europe/Moscow",
};

describe("onboarding budget timezone validation", () => {
  it("accepts a real IANA timezone", () => {
    expect(submitBudgetStepInputSchema.safeParse(validBudget).success).toBe(
      true,
    );
  });

  it("rejects a browser placeholder that cannot be used for date math", () => {
    expect(
      submitBudgetStepInputSchema.safeParse({
        ...validBudget,
        timeZone: "Etc/Unknown",
      }).success,
    ).toBe(false);
  });
});
