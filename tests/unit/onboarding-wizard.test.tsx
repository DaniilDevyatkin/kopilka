// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { serializeMoney } from "@/lib/money";
import { resolveIanaTimeZone } from "@/lib/dates";
import type { OnboardingStateReadModel } from "@/server/onboarding/service";
import type {
  SubmitAccountStepInput,
  SubmitBudgetStepInput,
  SubmitGoalStepInput,
} from "@/server/onboarding/validation";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

const actions = vi.hoisted(() => ({
  getOnboardingStateAction: vi.fn(),
  submitAccountStepAction: vi.fn(),
  submitBudgetStepAction: vi.fn(),
  submitGoalStepAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/server/actions/onboarding", () => actions);

const freshState: OnboardingStateReadModel = {
  currentStep: "ACCOUNT",
  firstAccountCompletedAt: null,
  budgetCompletedAt: null,
  goalStepCompletedAt: null,
  goalStepSkippedAt: null,
  completedAt: null,
  user: { baseCurrency: "RUB", displayName: "Тест" },
  settings: {
    monthlyIncomeMinor: null,
    mandatoryMonthlyExpensesMinor: null,
    timeZone: "Europe/Moscow",
  },
  account: null,
  accounts: [],
  hasGoal: false,
};

const budgetState: OnboardingStateReadModel = {
  ...freshState,
  currentStep: "BUDGET",
  firstAccountCompletedAt: "2026-08-15T10:00:00.000Z",
  account: {
    id: "account-1",
    name: "Моя карта",
    type: "DEBIT_CARD",
    currency: "RUB",
    visualTheme: "default",
    balanceMinor: serializeMoney(10_000_000n),
  },
  accounts: [
    {
      id: "account-1",
      name: "Моя карта",
      type: "DEBIT_CARD",
      currency: "RUB",
      visualTheme: "koi-lagoon",
      balanceMinor: serializeMoney(10_000_000n),
    },
  ],
};

const goalState: OnboardingStateReadModel = {
  ...budgetState,
  currentStep: "GOAL",
  budgetCompletedAt: "2026-08-15T10:01:00.000Z",
  settings: {
    monthlyIncomeMinor: serializeMoney(100_000n),
    mandatoryMonthlyExpensesMinor: serializeMoney(60_000n),
    timeZone: "Europe/Moscow",
  },
};

const completedState: OnboardingStateReadModel = {
  ...goalState,
  currentStep: "COMPLETED",
  goalStepCompletedAt: "2026-08-15T10:02:00.000Z",
  completedAt: "2026-08-15T10:02:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  actions.getOnboardingStateAction.mockResolvedValue({
    ok: true,
    data: freshState,
  });
});

describe("OnboardingWizard", () => {
  it("renders the account step for a fresh user", () => {
    render(<OnboardingWizard initial={freshState} />);

    expect(
      screen.getByRole("heading", { name: "Создание первого счета" }),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Продолжить" })).not.toBeNull();
    expect(screen.queryByLabelText(/Тип счёта/u)).toBeNull();
    expect(screen.queryByLabelText(/Валюта/u)).toBeNull();
    expect(screen.queryByLabelText(/Последние 4 цифры/u)).toBeNull();
  });

  it("submits the account step and advances to the budget step", async () => {
    actions.submitAccountStepAction.mockResolvedValue({
      ok: true,
      data: budgetState,
    });
    render(<OnboardingWizard initial={freshState} />);

    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: "Моя карта" },
    });
    fireEvent.change(screen.getByLabelText(/Стартовый баланс/), {
      target: { value: "100000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    await waitFor(() => {
      expect(actions.submitAccountStepAction).toHaveBeenCalledTimes(1);
    });
    const input: SubmitAccountStepInput = vi.mocked(
      actions.submitAccountStepAction,
    ).mock.calls[0]![0];
    expect(input).toMatchObject({
      name: "Моя карта",
      visualTheme: "koi-lagoon",
      openingBalanceMinor: 10_000_000n,
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Бюджет" })).not.toBeNull();
    });
  });

  it("blocks submission without a name or balance", async () => {
    render(<OnboardingWizard initial={freshState} />);

    fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(await screen.findByText("Укажите название счёта.")).not.toBeNull();
    expect(actions.submitAccountStepAction).not.toHaveBeenCalled();
  });

  it("rejects a budget where expenses exceed income locally", async () => {
    render(<OnboardingWizard initial={budgetState} />);

    fireEvent.change(screen.getByLabelText(/Доход в месяц/), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/Обязательные расходы/), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(
      await screen.findByText("Обязательные расходы не могут превышать доход."),
    ).not.toBeNull();
    expect(actions.submitBudgetStepAction).not.toHaveBeenCalled();
  });

  it("submits the budget step with parsed amounts", async () => {
    actions.submitBudgetStepAction.mockResolvedValue({
      ok: true,
      data: goalState,
    });
    render(<OnboardingWizard initial={budgetState} />);

    fireEvent.change(screen.getByLabelText(/Доход в месяц/), {
      target: { value: "150000" },
    });
    fireEvent.change(screen.getByLabelText(/Обязательные расходы/), {
      target: { value: "60000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    await waitFor(() => {
      expect(actions.submitBudgetStepAction).toHaveBeenCalledTimes(1);
    });
    const input: SubmitBudgetStepInput = vi.mocked(
      actions.submitBudgetStepAction,
    ).mock.calls[0]![0];
    expect(input).toMatchObject({
      monthlyIncomeMinor: 15_000_000n,
      mandatoryMonthlyExpensesMinor: 6_000_000n,
    });
    expect(input.timeZone).toBe(
      resolveIanaTimeZone(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        "Europe/Moscow",
      ),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Первая хотелка" }),
      ).not.toBeNull();
    });
  });

  it("keeps the budget step focused on financial inputs", () => {
    render(<OnboardingWizard initial={budgetState} />);

    expect(screen.getByRole("heading", { name: "Бюджет" })).not.toBeNull();
    expect(screen.queryByText("Шаг 2 из 3")).toBeNull();
    expect(screen.queryByLabelText(/Часовой пояс/u)).toBeNull();
    expect(screen.queryByText("Зачем это нужно")).toBeNull();
  });

  it("skips the goal step and redirects to the app home", async () => {
    actions.submitGoalStepAction.mockResolvedValue({
      ok: true,
      data: completedState,
    });
    render(<OnboardingWizard initial={goalState} />);

    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));

    await waitFor(() => {
      expect(actions.submitGoalStepAction).toHaveBeenCalledTimes(1);
    });
    const input: SubmitGoalStepInput = vi.mocked(actions.submitGoalStepAction)
      .mock.calls[0]![0];
    expect(input).toEqual({ skip: true });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/app/home");
    });
  });

  it("offers fixed goal periods without reserve controls", () => {
    render(<OnboardingWizard initial={goalState} />);

    expect(screen.queryByText("Шаг 3 из 3")).toBeNull();
    expect(screen.queryByText("Отложить часть суммы сейчас")).toBeNull();
    expect(screen.queryByLabelText("Срок")).toBeNull();

    const period = screen.getByLabelText(/Срок накопления/u);
    expect((period as HTMLSelectElement).value).toBe("MONTH");
    expect(screen.getByRole("option", { name: "Неделя" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Месяц" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Год" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Больше года" })).not.toBeNull();
  });

  it("submits the selected period as a target date without a reservation", async () => {
    actions.submitGoalStepAction.mockResolvedValue({
      ok: true,
      data: completedState,
    });
    render(<OnboardingWizard initial={goalState} />);

    fireEvent.change(screen.getByLabelText(/Название хотелки/u), {
      target: { value: "Ноутбук" },
    });
    fireEvent.change(screen.getByLabelText(/Сумма цели/u), {
      target: { value: "150000" },
    });
    fireEvent.change(screen.getByLabelText(/Срок накопления/u), {
      target: { value: "WEEK" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    await waitFor(() => {
      expect(actions.submitGoalStepAction).toHaveBeenCalledTimes(1);
    });
    const input: SubmitGoalStepInput = vi.mocked(actions.submitGoalStepAction)
      .mock.calls[0]![0];
    expect(input).toMatchObject({
      skip: false,
      goal: {
        name: "Ноутбук",
        targetAmountMinor: 15_000_000n,
        alreadySavedMinor: 0n,
      },
    });
    if (!input.skip) {
      expect(input.goal.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(input.goal).not.toHaveProperty("sourceAccountId");
    }
  });

  it("recovers from an invalid persisted timezone when creating a goal", async () => {
    actions.submitGoalStepAction.mockResolvedValue({
      ok: true,
      data: completedState,
    });
    render(
      <OnboardingWizard
        initial={{
          ...goalState,
          settings: { ...goalState.settings, timeZone: "Etc/Unknown" },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Название хотелки/u), {
      target: { value: "Ноутбук" },
    });
    fireEvent.change(screen.getByLabelText(/Сумма цели/u), {
      target: { value: "150000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    await waitFor(() => {
      expect(actions.submitGoalStepAction).toHaveBeenCalledTimes(1);
    });
    const input: SubmitGoalStepInput = vi.mocked(actions.submitGoalStepAction)
      .mock.calls[0]![0];
    expect(input).toMatchObject({
      skip: false,
      goal: { alreadySavedMinor: 0n },
    });
    if (!input.skip) {
      expect(input.goal.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    }
  });

  it("shows the completed screen with a working app link", async () => {
    render(<OnboardingWizard initial={completedState} />);

    expect(
      screen.getByRole("heading", { name: "Копилка готова" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Перейти к Копилке" }));
    expect(mockPush).toHaveBeenCalledWith("/app/home");
  });

  it("shows a server error and keeps the step", async () => {
    actions.submitAccountStepAction.mockResolvedValue({
      ok: false,
      code: "INVALID_INPUT",
      message: "Проверьте данные шага.",
    });
    render(<OnboardingWizard initial={freshState} />);

    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: "Моя карта" },
    });
    fireEvent.change(screen.getByLabelText(/Стартовый баланс/), {
      target: { value: "100000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(await screen.findByRole("alert", { name: "" })).not.toBeNull();
    expect(screen.getByText("Проверьте данные шага.")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Создание первого счета" }),
    ).not.toBeNull();
  });
});
