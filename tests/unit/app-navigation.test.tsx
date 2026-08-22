// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AppNavigation } from "@/components/layout/app-navigation";
import type { ClientAccount } from "@/lib/accounts/dto";
import { serializeMoney } from "@/lib/money";
import type { CategoryReadModel } from "@/server/categories/service";
import type { GoalReadModel } from "@/server/goals/service";

const { mockRefresh, mockReplace } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockReplace: vi.fn(),
}));

const actions = vi.hoisted(() => ({
  listAccountsAction: vi.fn(),
  listCategoriesAction: vi.fn(),
  listGoalsAction: vi.fn(),
  contributeGoalAction: vi.fn(),
  createOperationAction: vi.fn(),
  createTransferAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/home",
  useRouter: () => ({ refresh: mockRefresh, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/server/actions/accounts", () => ({
  listAccountsAction: actions.listAccountsAction,
}));
vi.mock("@/server/actions/categories", () => ({
  listCategoriesAction: actions.listCategoriesAction,
}));
vi.mock("@/server/actions/goals", () => ({
  listGoalsAction: actions.listGoalsAction,
  contributeGoalAction: actions.contributeGoalAction,
}));
vi.mock("@/server/actions/operations", () => ({
  createOperationAction: actions.createOperationAction,
}));
vi.mock("@/server/actions/transfers", () => ({
  createTransferAction: actions.createTransferAction,
}));

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

function category(
  overrides: Partial<CategoryReadModel> = {},
): CategoryReadModel {
  return {
    id: "category-1",
    kind: "INCOME",
    slug: "salary",
    labelRu: "Зарплата",
    iconName: "income",
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

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  actions.listAccountsAction.mockReset();
  actions.listCategoriesAction.mockReset();
  actions.listGoalsAction.mockReset();
  actions.contributeGoalAction.mockReset();
  actions.createOperationAction.mockReset();
  actions.createTransferAction.mockReset();
  actions.listAccountsAction.mockResolvedValue({
    ok: true,
    data: [clientAccount()],
  });
  actions.listCategoriesAction.mockResolvedValue({
    ok: true,
    data: [category()],
  });
  actions.listGoalsAction.mockResolvedValue({ ok: true, data: [goal()] });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-lock");
});

describe("application navigation", () => {
  it("renders five usable mobile destinations and marks the current page", () => {
    render(<AppNavigation />);

    const mobile = screen.getByRole("navigation", {
      name: "Основная навигация на телефоне",
    });
    expect(mobile.querySelectorAll("a, button")).toHaveLength(5);
    expect(
      within(mobile)
        .getByRole("link", { name: "Главная" })
        .getAttribute("href"),
    ).toBe("/app/home");
    expect(
      within(mobile)
        .getByRole("link", { name: "Главная" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(mobile)
        .getByRole("link", { name: "История" })
        .getAttribute("href"),
    ).toBe("/app/transactions");
    expect(
      within(mobile)
        .getByRole("link", { name: "Хотелки" })
        .getAttribute("href"),
    ).toBe("/app/goals");
    expect(
      within(mobile)
        .getByRole("link", { name: "Профиль" })
        .getAttribute("href"),
    ).toBe("/app/profile");
  });

  it("opens the action sheet, supports a real route and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<AppNavigation />);

    await user.click(screen.getByRole("button", { name: "Добавить" }));
    expect(screen.getByRole("dialog", { name: "Новое действие" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Новая хотелка/u }).getAttribute("href"),
    ).toBe("/app/goals/new");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens a real form from a quick action and refreshes after success", async () => {
    const user = userEvent.setup();
    actions.createOperationAction.mockResolvedValue({
      ok: true,
      data: { operationId: "op-1", replayed: false },
    });
    render(<AppNavigation />);

    await user.click(screen.getByRole("button", { name: "Добавить" }));
    await waitFor(() => {
      expect(actions.listAccountsAction).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByRole("button", { name: /Новый расход/u }));
    expect(
      await screen.findByRole("dialog", { name: "Новый расход" }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Сумма/)).toBeTruthy();

    await user.type(screen.getByTestId("operation-amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Добавить расход" }));

    await waitFor(() => {
      expect(actions.createOperationAction).toHaveBeenCalledTimes(1);
    });
    const input = vi.mocked(actions.createOperationAction).mock.calls[0]![0];
    expect(input).toMatchObject({
      kind: "EXPENSE",
      accountId: "account-1",
      categoryId: "category-1",
      amountMinor: 100_000n,
    });
    expect(input.idempotencyKey).toBeTypeOf("string");
    expect(input.occurredAt).toMatch(/^.+[+-]\d{2}:\d{2}$/u);
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("shows an empty state when there are no accounts", async () => {
    const user = userEvent.setup();
    actions.listAccountsAction.mockResolvedValue({ ok: true, data: [] });
    render(<AppNavigation />);

    await user.click(screen.getByRole("button", { name: "Добавить" }));
    await waitFor(() => {
      expect(actions.listAccountsAction).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByRole("button", { name: /Новый доход/u }));
    expect(await screen.findByText("Сначала добавьте счёт")).not.toBeNull();
  });
});
