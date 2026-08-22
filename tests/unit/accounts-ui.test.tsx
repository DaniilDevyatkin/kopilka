// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { AccountDetail } from "@/features/accounts/account-detail";
import { AccountForm } from "@/features/accounts/account-form";
import { AccountList } from "@/features/accounts/account-list";
import type { ClientAccount, ClientAccountDetail } from "@/lib/accounts/dto";
import { serializeMoney } from "@/lib/money";
import type {
  AccountCreateFormInput,
  AccountUpdateFormInput,
} from "@/features/accounts/account-form";
import type {
  CreateAccountInput,
  ReconcileAccountInput,
  UpdateAccountInput,
} from "@/server/accounts/service";

const { mockReplace, mockRefresh } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
}));

const actions = vi.hoisted(() => ({
  listAccountsAction: vi.fn(),
  getAccountDetailAction: vi.fn(),
  createAccountAction: vi.fn(),
  updateAccountAction: vi.fn(),
  archiveAccountAction: vi.fn(),
  deleteAccountAction: vi.fn(),
  reconcileAccountAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

vi.mock("@/server/actions/accounts", () => actions);

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

function clientDetail(
  overrides: Partial<ClientAccountDetail> = {},
): ClientAccountDetail {
  return {
    account: clientAccount(),
    timeZone: "Asia/Yekaterinburg",
    month: {
      yearMonth: "2026-08",
      inflowMinor: serializeMoney(2_500_000n),
      outflowMinor: serializeMoney(1_000_000n),
    },
    balanceSeries: [
      { day: "2026-08-01", balanceMinor: serializeMoney(85_000n) },
      { day: "2026-08-15", balanceMinor: serializeMoney(100_000n) },
    ],
    recentTransactions: [
      {
        operationId: "op-1",
        type: "INCOME",
        role: "PRIMARY",
        note: null,
        categoryLabel: "Зарплата",
        categoryIcon: "income",
        occurredAt: "2026-08-10T12:00:00.000Z",
        amountMinor: serializeMoney(2_500_000n),
      },
      {
        operationId: "op-2",
        type: "EXPENSE",
        role: "PRIMARY",
        note: "Магнит",
        categoryLabel: null,
        categoryIcon: null,
        occurredAt: "2026-08-11T12:00:00.000Z",
        amountMinor: serializeMoney(-1_000_000n),
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockReplace.mockReset();
  mockRefresh.mockReset();
  Object.values(actions).forEach((action) => action.mockReset());
});

describe("AccountList", () => {
  it("uses the server snapshot immediately without a hydration loading pass", () => {
    render(<AccountList initialAccounts={[clientAccount()]} />);

    expect(screen.getByRole("link", { name: /Основной счёт/ })).not.toBeNull();
    expect(actions.listAccountsAction).not.toHaveBeenCalled();
  });

  it("renders active and archived accounts and links to the detail page", async () => {
    actions.listAccountsAction.mockResolvedValue({
      ok: true,
      data: [
        clientAccount({ name: "Наличные", type: "CASH", last4: null }),
        clientAccount({
          id: "account-2",
          name: "Старый счёт",
          archivedAt: "2026-08-05T10:00:00.000Z",
          balanceMinor: serializeMoney(7_000n),
        }),
      ],
    });
    render(<AccountList />);

    expect(
      await screen.findByRole("link", { name: /Наличные/ }),
    ).not.toBeNull();
    expect(screen.getByText("Старый счёт")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Добавить/ })).not.toBeNull();
  });

  it("shows an empty state with a create link when there are no accounts", async () => {
    actions.listAccountsAction.mockResolvedValue({ ok: true, data: [] });
    render(<AccountList />);

    expect(
      await screen.findByRole("heading", { name: "Пока нет карт" }),
    ).not.toBeNull();
    expect(
      screen.getAllByRole("link", { name: /Добавить/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows an error state and retries", async () => {
    actions.listAccountsAction
      .mockResolvedValueOnce({
        ok: false,
        code: "INVALID_INPUT",
        message: "Ошибка.",
      })
      .mockResolvedValueOnce({ ok: true, data: [] });
    render(<AccountList />);

    expect(
      await screen.findByText("Не удалось загрузить счета"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("heading", { name: "Пока нет карт" }),
    ).not.toBeNull();
  });
});

describe("AccountForm", () => {
  it("creates an account with a bigint opening balance and redirects", async () => {
    actions.createAccountAction.mockResolvedValue({
      ok: true,
      data: clientAccount(),
    });
    render(
      <AccountForm
        mode="create"
        successPath="/app/accounts"
        submitCreate={actions.createAccountAction}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: "Зарплатная" },
    });
    fireEvent.change(screen.getByLabelText(/Начальный баланс/), {
      target: { value: "25000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать счёт" }));

    await waitFor(() => {
      expect(actions.createAccountAction).toHaveBeenCalledTimes(1);
    });
    const input: CreateAccountInput = vi.mocked(actions.createAccountAction)
      .mock.calls[0]![0];
    expect(input).toMatchObject({
      name: "Зарплатная",
      type: "DEBIT_CARD",
      currency: "RUB",
      visualTheme: "koi-lagoon",
      openingBalanceMinor: 2_500_000n,
    });
    expect(input.idempotencyKey).toBeTypeOf("string");
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/accounts");
    });
  });

  it("blocks create without a name and never calls the action", async () => {
    render(
      <AccountForm
        mode="create"
        successPath="/app/accounts"
        submitCreate={actions.createAccountAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Создать счёт" }));

    expect(await screen.findByText("Укажите название счёта.")).not.toBeNull();
    expect(actions.createAccountAction).not.toHaveBeenCalled();
  });

  it("prefills edit mode and submits only mutable fields", async () => {
    actions.updateAccountAction.mockResolvedValue({
      ok: true,
      data: clientAccount(),
    });
    render(
      <AccountForm
        mode="edit"
        initial={clientAccount()}
        successPath="/app/accounts/account-1"
        submitUpdate={actions.updateAccountAction}
      />,
    );

    expect((screen.getByLabelText(/Название/) as HTMLInputElement).value).toBe(
      "Основной счёт",
    );
    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: "Повседневные" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Сохранить изменения" }),
    );

    await waitFor(() => {
      expect(actions.updateAccountAction).toHaveBeenCalledTimes(1);
    });
    const input: UpdateAccountInput = vi.mocked(actions.updateAccountAction)
      .mock.calls[0]![0];
    expect(input).toMatchObject({
      accountId: "account-1",
      name: "Повседневные",
      visualTheme: "neon-jars",
    });
    expect(input).not.toHaveProperty("openingBalanceMinor");
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/accounts/account-1");
    });
  });

  it("shows a server failure and keeps the form", async () => {
    actions.createAccountAction.mockResolvedValue({
      ok: false,
      code: "INVALID_INPUT",
      message: "Проверьте выделенные поля.",
    });
    render(
      <AccountForm
        mode="create"
        successPath="/app/accounts"
        submitCreate={actions.createAccountAction}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Название/), {
      target: { value: "Зарплатная" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать счёт" }));

    expect(
      await screen.findByText("Проверьте выделенные поля."),
    ).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("AccountDetail", () => {
  it("renders balance, monthly flow, chart and recent transactions", async () => {
    actions.getAccountDetailAction.mockResolvedValue({
      ok: true,
      data: clientDetail(),
    });
    render(<AccountDetail accountId="account-1" />);

    expect(
      await screen.findByRole("heading", { name: "Основной счёт" }),
    ).not.toBeNull();
    expect(screen.getByText(/Зарплата/)).not.toBeNull();
    expect(screen.getByText(/Магнит/)).not.toBeNull();
    expect(screen.getByText("−10 000 ₽")).not.toBeNull();
    expect(screen.getByText("+25 000 ₽")).not.toBeNull();
  });

  it("reconciles the balance through the dialog and reloads", async () => {
    actions.getAccountDetailAction.mockResolvedValue({
      ok: true,
      data: clientDetail(),
    });
    actions.reconcileAccountAction.mockResolvedValue({
      ok: true,
      data: {
        accountId: "account-1",
        previousBalanceMinor: serializeMoney(100_000n),
        actualBalanceMinor: serializeMoney(90_000n),
        deltaMinor: serializeMoney(-10_000n),
        changed: true,
      },
    });
    render(<AccountDetail accountId="account-1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Скорректировать баланс" }),
    );
    fireEvent.change(screen.getByLabelText(/Фактический баланс/), {
      target: { value: "90000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(actions.reconcileAccountAction).toHaveBeenCalledTimes(1);
    });
    const input: ReconcileAccountInput = vi.mocked(
      actions.reconcileAccountAction,
    ).mock.calls[0]![0];
    expect(input).toMatchObject({
      accountId: "account-1",
      actualBalanceMinor: 9_000_000n,
    });
    await waitFor(() => {
      expect(actions.getAccountDetailAction).toHaveBeenCalledTimes(2);
    });
  });

  it("archives with a destructive confirmation and redirects to the list", async () => {
    actions.getAccountDetailAction.mockResolvedValue({
      ok: true,
      data: clientDetail(),
    });
    actions.archiveAccountAction.mockResolvedValue({
      ok: true,
      data: clientAccount({ archivedAt: "2026-08-15T10:00:00.000Z" }),
    });
    render(<AccountDetail accountId="account-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /В архив/ }));
    expect(screen.getByText("Переместить счёт в архив?")).not.toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "В архив" }).at(-1)!);

    await waitFor(() => {
      expect(actions.archiveAccountAction).toHaveBeenCalledWith("account-1");
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/accounts");
    });
  });

  it("shows the offline banner and retries", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(<AccountDetail accountId="account-1" />);

    expect(
      await screen.findByText(/Нет соединения с интернетом/),
    ).not.toBeNull();
    expect(actions.getAccountDetailAction).not.toHaveBeenCalled();
  });
});

describe("form input types stay in sync with the actions", () => {
  it("carries bigint fields into the create action input", () => {
    const input: AccountCreateFormInput = {
      name: "Счёт",
      type: "CASH",
      currency: "RUB",
      visualTheme: "default",
      openingBalanceMinor: 1n,
      idempotencyKey: "key",
    };
    expect(input.openingBalanceMinor).toBe(1n);
  });

  it("carries optional bigint fields into the update action input", () => {
    const input: AccountUpdateFormInput = {
      accountId: "account-1",
      name: "Счёт",
      visualTheme: "default",
      last4: null,
      creditLimitMinor: null,
    };
    expect(input.creditLimitMinor).toBeNull();
  });
});
