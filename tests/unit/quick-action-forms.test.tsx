// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContributeForm } from "@/features/quick-actions/contribute-form";
import { OperationForm } from "@/features/quick-actions/operation-form";
import { TransferForm } from "@/features/quick-actions/transfer-form";
import type { ClientAccount } from "@/lib/accounts/dto";
import { serializeMoney } from "@/lib/money";
import type { CategoryReadModel } from "@/server/categories/service";
import type { GoalReadModel } from "@/server/goals/service";

const { onSuccess } = vi.hoisted(() => ({ onSuccess: vi.fn() }));

const submit = vi.hoisted(() => vi.fn());

beforeEach(() => {
  onSuccess.mockReset();
  submit.mockReset();
});

afterEach(() => {
  cleanup();
});

function clientAccount(overrides: Partial<ClientAccount> = {}): ClientAccount {
  return {
    id: "account-1",
    name: "Основной счёт",
    type: "DEBIT_CARD",
    currency: "RUB",
    visualTheme: "graphite",
    last4: "4821",
    creditLimitMinor: null,
    archivedAt: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    balanceMinor: serializeMoney(100_000n),
    reservedMinor: serializeMoney(0n),
    availableMinor: serializeMoney(100_000n),
    spendingCapacityMinor: serializeMoney(100_000n),
    ...overrides,
  };
}

function secondAccount(): ClientAccount {
  return clientAccount({
    id: "account-2",
    name: "Накопительный",
    currency: "RUB",
  });
}

function category(
  overrides: Partial<CategoryReadModel> = {},
): CategoryReadModel {
  return {
    id: "category-1",
    kind: "EXPENSE",
    slug: "food",
    labelRu: "Продукты",
    iconName: "cash",
    sortOrder: 1,
    system: true,
    archivedAt: null,
    ...overrides,
  };
}

function goal(overrides: Partial<GoalReadModel> = {}): GoalReadModel {
  const now = new Date();
  return {
    id: "goal-1",
    name: "Поездка в Грузию",
    category: "TRAVEL",
    description: null,
    targetAmountMinor: 100_000_00n,
    reservedAmountMinor: 0n,
    targetDate: null,
    priority: "MEDIUM",
    status: "ACTIVE",
    image: null,
    actualPurchaseAmountMinor: null,
    completedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("OperationForm", () => {
  it("validates an empty amount and never calls the action", async () => {
    const user = userEvent.setup();
    render(
      <OperationForm
        kind="EXPENSE"
        accounts={[clientAccount()]}
        categories={[category()]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Добавить расход" }));

    expect(await screen.findByText("Введите сумму.")).not.toBeNull();
    expect(submit).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("submits parsed bigint amount, comment and offset datetime", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      ok: true,
      data: { operationId: "op-1", replayed: false },
    });
    render(
      <OperationForm
        kind="EXPENSE"
        accounts={[clientAccount()]}
        categories={[category()]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.type(screen.getByTestId("operation-amount"), "1500");
    await user.type(screen.getByLabelText(/Комментарий/), "Обед");
    await user.click(screen.getByRole("button", { name: "Добавить расход" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const input = vi.mocked(submit).mock.calls[0]![0];
    expect(input).toMatchObject({
      kind: "EXPENSE",
      amountMinor: 150_000n,
      accountId: "account-1",
      categoryId: "category-1",
      comment: "Обед",
    });
    expect(input.idempotencyKey).toBeTypeOf("string");
    expect(input.occurredAt).toMatch(/^.+[+-]\d{2}:\d{2}$/u);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("shows the server error message", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      ok: false,
      code: "INSUFFICIENT_AVAILABLE_FUNDS",
      message: "На счёте недостаточно средств.",
    });
    render(
      <OperationForm
        kind="EXPENSE"
        accounts={[clientAccount()]}
        categories={[category()]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.type(screen.getByTestId("operation-amount"), "999999");
    await user.click(screen.getByRole("button", { name: "Добавить расход" }));

    expect(
      await screen.findByText("На счёте недостаточно средств."),
    ).not.toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("surfaces a network failure without closing the form", async () => {
    const user = userEvent.setup();
    submit.mockRejectedValue(new Error("network down"));
    render(
      <OperationForm
        kind="INCOME"
        accounts={[clientAccount()]}
        categories={[category({ kind: "INCOME", labelRu: "Зарплата" })]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.type(screen.getByTestId("operation-amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Добавить доход" }));

    expect(
      await screen.findByText(/Не удалось связаться с сервером/u),
    ).not.toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("TransferForm", () => {
  it("clears a conflicting destination when the source changes", async () => {
    const user = userEvent.setup();
    render(
      <TransferForm
        accounts={[clientAccount(), secondAccount()]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/Со счёта/), "account-2");
    await user.type(screen.getByTestId("transfer-amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Перевести" }));

    expect(await screen.findByText("Выберите счёт зачисления.")).not.toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits a transfer between two accounts", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      ok: true,
      data: { transferId: "transfer-1", replayed: false },
    });
    render(
      <TransferForm
        accounts={[clientAccount(), secondAccount()]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.type(screen.getByTestId("transfer-amount"), "2000");
    await user.click(screen.getByRole("button", { name: "Перевести" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const input = vi.mocked(submit).mock.calls[0]![0];
    expect(input).toMatchObject({
      amountMinor: 200_000n,
      sourceAccountId: "account-1",
      destinationAccountId: "account-2",
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});

describe("ContributeForm", () => {
  it("submits a goal contribution", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      ok: true,
      data: {
        goal: goal(),
        entryId: "entry-1",
        replayed: false,
      },
    });
    render(
      <ContributeForm
        goals={[goal()]}
        accounts={[clientAccount()]}
        submit={submit}
        onSuccess={onSuccess}
        onCancel={() => undefined}
      />,
    );

    await user.type(screen.getByTestId("contribute-amount"), "5000");
    await user.click(screen.getByRole("button", { name: "Пополнить хотелку" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const input = vi.mocked(submit).mock.calls[0]![0];
    expect(input).toMatchObject({
      goalId: "goal-1",
      sourceAccountId: "account-1",
      amountMinor: 500_000n,
    });
    expect(input.idempotencyKey).toBeTypeOf("string");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
