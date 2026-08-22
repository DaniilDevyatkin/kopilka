export const CORE_ICON_NAMES = [
  "home",
  "transactions",
  "add",
  "goals",
  "profile",
  "eye",
  "eye-off",
  "income",
  "expense",
  "transfer",
  "card",
  "cash",
  "savings",
  "bank-account",
  "custom-account",
  "settings",
  "logout",
  "edit",
  "archive",
  "calendar",
  "target",
  "check",
  "warning",
  "offline",
  "install",
  "share",
  "home-screen",
  "search",
  "filter",
  "close",
  "back",
  "chevron",
  "categories",
] as const;

export const EXPENSE_ICON_NAMES = [
  "expense-groceries",
  "expense-transport",
  "expense-cafe",
  "expense-housing",
  "expense-subscriptions",
  "expense-entertainment",
  "expense-clothes",
  "expense-health",
  "expense-education",
  "expense-tech",
  "expense-gifts",
  "expense-travel",
  "expense-other",
] as const;

export const INCOME_ICON_NAMES = [
  "income-salary",
  "income-side-job",
  "income-gift",
  "income-sale",
  "income-refund",
  "income-bonus",
  "income-other",
] as const;

export const GOAL_ICON_NAMES = [
  "goal-tech",
  "goal-travel",
  "goal-car",
  "goal-housing",
  "goal-education",
  "goal-gift",
  "goal-clothes",
  "goal-health",
  "goal-hobby",
  "goal-emergency-fund",
  "goal-other",
] as const;

export const STATUS_ICON_NAMES = [
  "status-active",
  "status-completed",
  "status-archived",
  "status-cancelled",
  "priority-high",
  "priority-medium",
  "priority-low",
] as const;

export const APP_ICON_NAMES = [
  ...CORE_ICON_NAMES,
  ...EXPENSE_ICON_NAMES,
  ...INCOME_ICON_NAMES,
  ...GOAL_ICON_NAMES,
  ...STATUS_ICON_NAMES,
] as const;

export type CoreIconName = (typeof CORE_ICON_NAMES)[number];
export type ExpenseIconName = (typeof EXPENSE_ICON_NAMES)[number];
export type IncomeIconName = (typeof INCOME_ICON_NAMES)[number];
export type GoalIconName = (typeof GOAL_ICON_NAMES)[number];
export type StatusIconName = (typeof STATUS_ICON_NAMES)[number];
export type AppIconName = (typeof APP_ICON_NAMES)[number];
