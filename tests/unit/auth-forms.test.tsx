// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { ProfileSecurity } from "@/components/auth/profile-security";
import { RegisterForm } from "@/components/auth/register-form";
import type { AuthAction, LogoutAction } from "@/features/auth/auth-form-types";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  refresh.mockReset();
});

function deferredResult() {
  let resolve!: (value: Awaited<ReturnType<AuthAction>>) => void;
  const promise = new Promise<Awaited<ReturnType<AuthAction>>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("LoginForm", () => {
  it("labels password-manager friendly fields and toggles password visibility", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AuthAction>();
    render(<LoginForm action={action} />);

    const login = screen.getByRole("textbox", { name: /^Логин/u });
    const password = screen.getByLabelText(/^Пароль/u);
    expect(login.getAttribute("autocomplete")).toBe("username");
    expect(login.getAttribute("spellcheck")).toBe("false");
    expect(password.getAttribute("autocomplete")).toBe("current-password");

    await user.type(password, "секретный пароль");
    await user.click(screen.getByRole("button", { name: "Показать пароль" }));
    expect(password.getAttribute("type")).toBe("text");
    expect((password as HTMLInputElement).value).toBe("секретный пароль");
  });

  it("validates on submit, shows an inline instruction and focuses the first field", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AuthAction>();
    render(<LoginForm action={action} />);

    await user.click(screen.getByRole("button", { name: "Войти" }));

    const login = screen.getByRole("textbox", { name: /^Логин/u });
    await waitFor(() => expect(document.activeElement).toBe(login));
    expect(login.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByText("Введите логин: от 3 до 64 символов."),
    ).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("shows a neutral credential error returned by the server", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AuthAction>().mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Неверный логин или пароль.",
    });
    render(<LoginForm action={action} />);

    await user.type(
      screen.getByRole("textbox", { name: /^Логин/u }),
      "alex.user",
    );
    await user.type(screen.getByLabelText(/^Пароль/u), "неверный пароль");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Неверный логин или пароль.",
    );
    expect(screen.queryByText(/существ/u)).toBeNull();
  });

  it("blocks a repeated submit while the request is pending", async () => {
    const user = userEvent.setup();
    const deferred = deferredResult();
    const action = vi.fn<AuthAction>().mockReturnValue(deferred.promise);
    render(<LoginForm action={action} />);

    await user.type(
      screen.getByRole("textbox", { name: /^Логин/u }),
      "alex.user",
    );
    await user.type(screen.getByLabelText(/^Пароль/u), "правильный пароль");
    const submit = screen.getByRole("button", { name: "Войти" });
    await user.click(submit);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    await user.click(submit);
    expect(action).toHaveBeenCalledOnce();

    deferred.resolve({ ok: true, nextPath: "/app/home" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/home"));
  });

  it("offers recovery after a network failure without exposing internals", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn<AuthAction>()
      .mockRejectedValue(new TypeError("Failed to fetch server action"));
    render(<LoginForm action={action} />);

    await user.type(
      screen.getByRole("textbox", { name: /^Логин/u }),
      "alex.user",
    );
    await user.type(screen.getByLabelText(/^Пароль/u), "правильный пароль");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
    );
    expect(screen.queryByText(/Failed to fetch/u)).toBeNull();
  });
});

describe("RegisterForm", () => {
  it("renders the complete registration contract without banking fields", () => {
    render(<RegisterForm action={vi.fn<AuthAction>()} />);

    expect(screen.getByRole("region", { name: "Регистрация" })).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("textbox", { name: /^Логин/u })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: /^Имя/u }).getAttribute("required"),
    ).not.toBeNull();
    expect(screen.getByLabelText(/^Пароль/u)).toBeTruthy();
    expect(screen.getByLabelText(/^Повторите пароль/u)).toBeTruthy();
    expect(screen.queryByText(/валюту выберете/u)).toBeNull();
    expect(screen.queryByText(/номер карты|CVV|PIN/iu)).toBeNull();
  });

  it("requires a display name before calling the server", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AuthAction>();
    render(<RegisterForm action={action} />);

    await user.type(
      screen.getByRole("textbox", { name: /^Логин/u }),
      "new.user",
    );
    await user.type(
      screen.getByLabelText(/^Пароль/u),
      "достаточно длинный пароль",
    );
    await user.type(
      screen.getByLabelText(/^Повторите пароль/u),
      "достаточно длинный пароль",
    );
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));

    expect(await screen.findByText("Введите имя.")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: /^Имя/u }),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("does not call the server when repeated password differs", async () => {
    const user = userEvent.setup();
    const action = vi.fn<AuthAction>();
    render(<RegisterForm action={action} />);

    await user.type(
      screen.getByRole("textbox", { name: /^Логин/u }),
      "new.user",
    );
    await user.type(screen.getByRole("textbox", { name: /^Имя/u }), "Мария");
    await user.type(
      screen.getByLabelText(/^Пароль/u),
      "достаточно длинный пароль",
    );
    await user.type(
      screen.getByLabelText(/^Повторите пароль/u),
      "другой длинный пароль",
    );
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));

    expect(await screen.findByText("Пароли не совпадают.")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByLabelText(/^Повторите пароль/u),
    );
    expect(action).not.toHaveBeenCalled();
  });
});

describe("ProfileSecurity", () => {
  it("changes the password, reports success and supports a separate logout flow", async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn<AuthAction>().mockResolvedValue({
      ok: true,
      nextPath: "/app/profile",
    });
    const logout = vi.fn<LogoutAction>().mockResolvedValue({
      ok: true,
      nextPath: "/login",
    });
    render(
      <ProfileSecurity
        changePasswordAction={changePassword}
        logoutAction={logout}
      />,
    );

    await user.type(
      screen.getByLabelText(/^Текущий пароль/u),
      "старый надёжный пароль",
    );
    await user.type(
      screen.getByLabelText(/^Новый пароль/u),
      "новый надёжный пароль",
    );
    await user.type(
      screen.getByLabelText(/^Повторите новый пароль/u),
      "новый надёжный пароль",
    );
    await user.click(screen.getByRole("button", { name: "Изменить пароль" }));
    expect((await screen.findByRole("status")).textContent).toContain(
      "Пароль изменён. Остальные сессии завершены.",
    );

    await user.click(screen.getByRole("button", { name: "Выйти из аккаунта" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(logout).toHaveBeenCalledOnce();
  });
});
