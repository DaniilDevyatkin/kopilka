// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import {
  AppDialog,
  Button,
  Checkbox,
  DestructiveConfirmation,
  FormField,
  IconButton,
  MoneyInput,
  PasswordInput,
  Popover,
  Progress,
  StatusMessage,
  Switch,
  Toast,
} from "@/components/ui";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-lock");
});

describe("form and action primitives", () => {
  it("keeps the button label, blocks activation and announces pending state", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button pending onClick={onClick}>
        Сохранить
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Сохранить" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(true);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("gives icon-only actions a name while keeping AppIcon decorative", () => {
    render(<IconButton label="Закрыть" icon="close" />);

    const button = screen.getByRole("button", { name: "Закрыть" });
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("connects a visible label, hint and inline error to its control", () => {
    render(
      <FormField
        label="Комментарий"
        hint="Необязательно"
        error="Не больше 200 символов"
      >
        <input />
      </FormField>,
    );

    const input = screen.getByRole("textbox", { name: "Комментарий" });
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy.split(" ")).toHaveLength(2);
    const errorId = describedBy.split(" ").at(-1) ?? "";
    expect(document.getElementById(errorId)?.textContent).toContain(
      "Не больше 200 символов",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Не больше 200 символов",
    );
  });

  it("toggles password visibility without changing the entered value", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Пароль" defaultValue="secret-value" />);

    const input = screen.getByLabelText("Пароль");
    expect(input.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Показать пароль" }));
    expect(input.getAttribute("type")).toBe("text");
    expect((input as HTMLInputElement).value).toBe("secret-value");
    expect(screen.getByRole("button", { name: "Скрыть пароль" })).toBeTruthy();
  });

  it("parses comma money input to bigint-safe string and formats it on blur", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MoneyInput
        aria-label="Сумма"
        currency="RUB"
        locale="ru-RU"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByLabelText("Сумма");
    await user.type(input, "1 250,50");
    expect(onValueChange).toHaveBeenLastCalledWith("125050");
    await user.tab();
    expect((input as HTMLInputElement).value).toMatch(
      /1[\s\u00a0\u202f]250,50[\s\u00a0\u202f]₽/u,
    );
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });

  it("uses native labeled checkboxes for checkbox and switch states", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Checkbox label="Учитывать в капитале" />
        <Switch label="Тёмная тема" />
      </>,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "Учитывать в капитале",
    });
    const switchControl = screen.getByRole("switch", { name: "Тёмная тема" });
    await user.click(checkbox);
    await user.click(switchControl);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    expect((switchControl as HTMLInputElement).checked).toBe(true);
  });

  it("exposes progress value and a textual saved-to-target explanation", () => {
    render(
      <Progress
        value={35}
        max={100}
        label="Накоплено"
        valueText="35 000 из 100 000 ₽"
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Накоплено" });
    expect(progress.getAttribute("aria-valuenow")).toBe("35");
    expect(progress.getAttribute("aria-valuetext")).toBe("35 000 из 100 000 ₽");
    expect(screen.getByText("35 000 из 100 000 ₽")).toBeTruthy();
  });
});

describe("overlay and feedback primitives", () => {
  it("traps focus, closes with Escape, unlocks scroll and restores the trigger", async () => {
    const user = userEvent.setup();
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Открыть диалог</button>
          <AppDialog open={open} onOpenChange={setOpen} title="Новая цель">
            <input aria-label="Название" />
            <button>Сохранить</button>
          </AppDialog>
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Открыть диалог" });
    await user.click(trigger);
    const input = await screen.findByRole("textbox", { name: "Название" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(document.body.getAttribute("data-scroll-lock")).toBe("true");

    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.body.hasAttribute("data-scroll-lock")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("opens a non-modal popover and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger="Фильтры" title="Фильтры операций">
        <button>Сбросить</button>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Фильтры" });
    await user.click(trigger);
    const reset = await screen.findByRole("button", { name: "Сбросить" });
    await waitFor(() => expect(document.activeElement).toBe(reset));
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Фильтры операций" }),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("locks destructive confirmation while its action is pending", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DestructiveConfirmation
        open
        title="Архивировать счёт?"
        description="История операций сохранится."
        confirmLabel="Архивировать"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        pending
      />,
    );

    const cancel = screen.getByRole("button", { name: "Отмена" });
    const confirm = screen.getByRole("button", { name: "Архивировать" });
    expect(cancel.hasAttribute("disabled")).toBe(true);
    expect(confirm.hasAttribute("disabled")).toBe(true);
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("uses polite status by default and assertive semantics for errors", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <StatusMessage>Изменения сохранены</StatusMessage>
        <Toast tone="negative" onDismiss={onDismiss}>
          Не удалось сохранить
        </Toast>
      </>,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Изменения сохранены",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Не удалось сохранить",
    );
    await user.click(screen.getByRole("button", { name: "Закрыть сообщение" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
