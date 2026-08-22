"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  AppIcon,
  GeneratedIcon,
  type GeneratedIconName,
} from "@/components/icons";
import {
  BottomSheet,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  StatusMessage,
} from "@/components/ui";
import { useQuickActionData } from "@/features/quick-actions/action-data";
import { ContributeForm } from "@/features/quick-actions/contribute-form";
import { OperationForm } from "@/features/quick-actions/operation-form";
import { TransferForm } from "@/features/quick-actions/transfer-form";
import { createOperationAction } from "@/server/actions/operations";
import { createTransferAction } from "@/server/actions/transfers";
import { contributeGoalAction } from "@/server/actions/goals";
import styles from "./app-shell.module.css";

interface NavigationItem {
  href: string;
  label: string;
  icon: GeneratedIconName;
}

const MOBILE_ITEMS = [
  { href: "/app/home", label: "Главная", icon: "nav-home" },
  { href: "/app/transactions", label: "История", icon: "nav-history" },
  { href: "/app/goals", label: "Хотелки", icon: "nav-goals" },
  { href: "/app/profile", label: "Профиль", icon: "nav-profile" },
] as const satisfies readonly NavigationItem[];

type QuickActionKind = "INCOME" | "EXPENSE" | "TRANSFER" | "CONTRIBUTE";

function quickActionFromQuery(value: string | null): QuickActionKind | null {
  const action = value?.toUpperCase();
  return action === "INCOME" ||
    action === "EXPENSE" ||
    action === "TRANSFER" ||
    action === "CONTRIBUTE"
    ? action
    : null;
}

const QUICK_ACTIONS: ReadonlyArray<{
  kind: QuickActionKind;
  label: string;
  description: string;
  generatedIcon: GeneratedIconName;
}> = [
  {
    kind: "INCOME",
    label: "Новый доход",
    description: "Поступление на счёт",
    generatedIcon: "quick-income",
  },
  {
    kind: "EXPENSE",
    label: "Новый расход",
    description: "Списание со счёта",
    generatedIcon: "quick-expense",
  },
  {
    kind: "TRANSFER",
    label: "Перевод",
    description: "Между своими счетами",
    generatedIcon: "quick-transfer",
  },
  {
    kind: "CONTRIBUTE",
    label: "Пополнить хотелку",
    description: "Отложить деньги на цель",
    generatedIcon: "quick-goal",
  },
];

const FORM_DESCRIPTIONS: Record<QuickActionKind, string> = {
  INCOME: "Укажите, сколько и куда поступило.",
  EXPENSE: "Укажите, сколько и откуда списали.",
  TRANSFER: "Деньги перемещаются между вашими счетами.",
  CONTRIBUTE: "Сумма резервируется под цель со счёта списания.",
};

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const current = isCurrentPath(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={styles.navigationLink}
      aria-current={current ? "page" : undefined}
    >
      <GeneratedIcon
        name={item.icon}
        size={26}
        className={styles.generatedNavIcon}
      />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const actionsOpen = actionSheetOpen || searchParams.get("action") === "new";
  const [selectedForm, setSelectedForm] = useState<QuickActionKind | null>(
    null,
  );
  const activeForm =
    selectedForm ?? quickActionFromQuery(searchParams.get("action"));
  const data = useQuickActionData(actionsOpen || activeForm !== null);

  function closeActiveForm() {
    setSelectedForm(null);
    if (searchParams.has("action")) {
      router.replace(pathname, { scroll: false });
    }
  }

  function handleActionSheetOpenChange(open: boolean) {
    setActionSheetOpen(open);
    if (!open && searchParams.get("action") === "new") {
      router.replace(pathname, { scroll: false });
    }
  }

  function handleSuccess() {
    router.refresh();
    closeActiveForm();
  }

  const activeAccounts = data.accounts.filter(
    (account) => account.archivedAt === null,
  );

  function renderForm() {
    if (data.loading) {
      return <StatusMessage>Загружаем данные…</StatusMessage>;
    }
    if (data.error !== null) {
      return (
        <ErrorState
          title="Не удалось загрузить данные"
          description={data.error}
          action={
            <Button variant="secondary" onClick={data.reload}>
              Попробовать снова
            </Button>
          }
        />
      );
    }
    if (activeForm === "INCOME" || activeForm === "EXPENSE") {
      if (activeAccounts.length === 0) {
        return (
          <EmptyState
            title="Сначала добавьте счёт"
            description="Доходы и расходы записываются на счёт."
            action={
              <Link
                className={styles.dialogActionLink}
                href="/app/accounts/new"
              >
                Добавить счёт
              </Link>
            }
          />
        );
      }
      return (
        <OperationForm
          kind={activeForm}
          accounts={activeAccounts}
          categories={data.categoriesByKind[activeForm]}
          submit={(input) => createOperationAction(input)}
          onSuccess={handleSuccess}
          onCancel={closeActiveForm}
        />
      );
    }
    if (activeForm === "TRANSFER") {
      if (activeAccounts.length < 2) {
        return (
          <EmptyState
            title="Нужно минимум два счёта"
            description="Перевод перемещает деньги между счетами."
            action={
              <Link
                className={styles.dialogActionLink}
                href="/app/accounts/new"
              >
                Добавить счёт
              </Link>
            }
          />
        );
      }
      return (
        <TransferForm
          accounts={activeAccounts}
          submit={(input) => createTransferAction(input)}
          onSuccess={handleSuccess}
          onCancel={closeActiveForm}
        />
      );
    }
    if (data.goals.length === 0) {
      return (
        <EmptyState
          title="Нет активных хотелок"
          description="Создайте хотелку, чтобы откладывать на неё деньги."
          action={
            <Link className={styles.dialogActionLink} href="/app/goals/new">
              Новая хотелка
            </Link>
          }
        />
      );
    }
    if (activeAccounts.length === 0) {
      return (
        <EmptyState
          title="Сначала добавьте счёт"
          description="Пополнение хотелки списывается со счёта."
          action={
            <Link className={styles.dialogActionLink} href="/app/accounts/new">
              Добавить счёт
            </Link>
          }
        />
      );
    }
    return (
      <ContributeForm
        goals={data.goals}
        accounts={activeAccounts}
        submit={(input) => contributeGoalAction(input)}
        onSuccess={handleSuccess}
        onCancel={closeActiveForm}
      />
    );
  }

  return (
    <>
      <nav
        className={styles.mobileNavigation}
        aria-label="Основная навигация на телефоне"
      >
        <NavigationLink item={MOBILE_ITEMS[0]} pathname={pathname} />
        <NavigationLink item={MOBILE_ITEMS[1]} pathname={pathname} />
        <button
          type="button"
          className={styles.addAction}
          aria-label="Добавить"
          aria-haspopup="dialog"
          aria-expanded={actionsOpen}
          onClick={() => setActionSheetOpen(true)}
        >
          <span className={styles.addActionIcon}>
            <GeneratedIcon name="nav-add" size={34} />
          </span>
          <span>Добавить</span>
        </button>
        <NavigationLink item={MOBILE_ITEMS[2]} pathname={pathname} />
        <NavigationLink item={MOBILE_ITEMS[3]} pathname={pathname} />
      </nav>

      <BottomSheet
        open={actionsOpen}
        onOpenChange={handleActionSheetOpenChange}
        title="Новое действие"
        description="Что добавляем?"
      >
        <Link
          href="/app/goals/new"
          className={styles.sheetLink}
          onClick={() => setActionSheetOpen(false)}
        >
          <GeneratedIcon name="quick-goal" size={38} />
          <span>
            <strong>Новая хотелка</strong>
            <small>Создать цель с нуля</small>
          </span>
          <AppIcon name="chevron" size={20} />
        </Link>
        <ul className={styles.quickActions} aria-label="Финансовые действия">
          {QUICK_ACTIONS.map((action) => (
            <li key={action.kind}>
              <button
                type="button"
                className={styles.sheetAction}
                onClick={() => {
                  setActionSheetOpen(false);
                  setSelectedForm(action.kind);
                }}
              >
                <GeneratedIcon name={action.generatedIcon} size={40} />
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <Dialog
        open={activeForm !== null}
        onOpenChange={(open) => {
          if (!open) closeActiveForm();
        }}
        title={
          activeForm
            ? (QUICK_ACTIONS.find((a) => a.kind === activeForm)?.label ?? "")
            : ""
        }
        description={activeForm ? FORM_DESCRIPTIONS[activeForm] : undefined}
        variant="sheet"
      >
        {activeForm !== null ? renderForm() : null}
      </Dialog>
    </>
  );
}
