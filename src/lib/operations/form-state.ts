export interface MutationFieldErrors {
  amountMinor?: string;
  accountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  categoryId?: string;
  goalId?: string;
  occurredAt?: string;
}

export interface MutationFormState {
  attempt: number;
  result?: {
    ok: boolean;
    code: string;
    message: string;
    fieldErrors?: MutationFieldErrors;
  };
}

export const INITIAL_MUTATION_STATE: MutationFormState = { attempt: 0 };

export const NETWORK_FAILURE_RESULT = {
  ok: false,
  code: "INVALID_INPUT",
  message:
    "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
};

export function toFormResult<T>(
  result: { ok: true; data: T } | { ok: false; code: string; message: string },
): { ok: boolean; code: string; message: string } {
  return result.ok
    ? { ok: true, code: "", message: "" }
    : { ok: false, code: result.code, message: result.message };
}

export function toDatetimeLocal(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function datetimeLocalNow(): string {
  return toDatetimeLocal(new Date());
}

/** Converts a `<input type="datetime-local">` value into an ISO string with the local UTC offset, or null when invalid. */
export function parseDatetimeLocal(value: string): string | null {
  if (value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDatetimeLocal(date)}${sign}${pad(Math.floor(abs / 60))}:${pad(
    abs % 60,
  )}`;
}
