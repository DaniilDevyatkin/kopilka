import type { GlyphMap } from "./glyph-types";
import type { ExpenseIconName, IncomeIconName } from "./icon-names";

export const EXPENSE_GLYPHS = {
  "expense-groceries": (
    <>
      <path d="M5.2 9h13.6l-1.1 11H6.3L5.2 9ZM8 9c0-2.7 1.5-4.5 4-4.5s4 1.8 4 4.5" />
      <path d="M9.2 13.2v2.6M14.8 13.2v2.6" />
    </>
  ),
  "expense-transport": (
    <>
      <path d="M5.2 17.4h13.6l1.1-6.2-2.2-4.5H6.3l-2.2 4.5 1.1 6.2Z" />
      <path d="M4.4 11.8h15.2M7.3 17.4v2.2M16.7 17.4v2.2M7.4 14.2h.1M16.6 14.2h.1" />
    </>
  ),
  "expense-cafe": (
    <>
      <path d="M5 7.2h11.5v7.1A4.7 4.7 0 0 1 11.8 19H9.7A4.7 4.7 0 0 1 5 14.3V7.2Z" />
      <path d="M16.5 9h1.3a2.7 2.7 0 0 1 0 5.4h-1.3M4 21h14M8 3.2v1.5M12.8 3.2v1.5" />
    </>
  ),
  "expense-housing": (
    <>
      <path d="m3.5 11.2 8.5-7 8.5 7M5.5 9.7v10h13v-10M9.2 19.7v-6.4h5.6v6.4" />
      <path d="M16.7 5.8V3.5h2.1v4" />
    </>
  ),
  "expense-subscriptions": (
    <>
      <rect x="3.7" y="5.3" width="16.6" height="13.4" rx="2.5" />
      <path d="M8.5 3.2v4.2M15.5 3.2v4.2M8 12h8M8 15.3h5" />
      <path d="m17.3 14.3 2 2-2 2" />
    </>
  ),
  "expense-entertainment": (
    <>
      <path d="M7.8 9.2H5.9A3.9 3.9 0 0 0 2 13.1v3.2a2.5 2.5 0 0 0 4.5 1.5l2.2-2.9h6.6l2.2 2.9a2.5 2.5 0 0 0 4.5-1.5v-3.2a3.9 3.9 0 0 0-3.9-3.9h-1.9" />
      <path d="M8 13H5.2M6.6 11.6v2.8M17.5 11.8h.1M19.2 14h.1M9.2 9.2V6.5h5.6v2.7" />
    </>
  ),
  "expense-clothes": (
    <>
      <path d="m8.1 4.5-5 3.1 2.1 4 2.2-1.1v9h9.2v-9l2.2 1.1 2.1-4-5-3.1a4.7 4.7 0 0 1-7.8 0Z" />
    </>
  ),
  "expense-health": (
    <>
      <path d="M12 20S4.2 15.6 4.2 9.7A4.4 4.4 0 0 1 12 6.9a4.4 4.4 0 0 1 7.8 2.8C19.8 15.6 12 20 12 20Z" />
      <path d="M12 9.2v6M9 12.2h6" />
    </>
  ),
  "expense-education": (
    <>
      <path d="m2.8 9.2 9.2-4.8 9.2 4.8L12 14 2.8 9.2Z" />
      <path d="M6.2 11v5.2c3.4 2.1 8.2 2.1 11.6 0V11M21.2 9.2v6" />
    </>
  ),
  "expense-tech": (
    <>
      <rect x="4" y="5.2" width="16" height="11.2" rx="2" />
      <path d="M9 20h6M12 16.4V20M8.3 9.2h3.2v3.2H8.3zM14.5 9.2h2" />
    </>
  ),
  "expense-gifts": (
    <>
      <path d="M4.2 10h15.6v10H4.2zM3.2 6.2h17.6V10H3.2zM12 6.2V20" />
      <path d="M11.9 6.2H8.6a2.1 2.1 0 1 1 2.1-2.1l1.2 2.1ZM12.1 6.2h3.3a2.1 2.1 0 1 0-2.1-2.1l-1.2 2.1Z" />
    </>
  ),
  "expense-travel": (
    <>
      <path d="m3.1 13.2 7.1-2.2 4.1-6.8a2 2 0 0 1 3.2-.4l.7.7a2 2 0 0 1-.4 3.2L11 11.8l-2.2 7.1-1.7-1.7.8-4.2-3.2 1.8-1.6-1.6Z" />
      <path d="m14.5 10.2 3.8 3.8" />
    </>
  ),
  "expense-other": (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
} satisfies GlyphMap<ExpenseIconName>;

export const INCOME_GLYPHS = {
  "income-salary": (
    <>
      <rect x="3.2" y="7" width="17.6" height="12.4" rx="2.3" />
      <path d="M8 7V4.6h8V7M3.2 11.5h17.6M9.5 14.8h5" />
    </>
  ),
  "income-side-job": (
    <>
      <path d="M4.2 8.2h15.6v11H4.2zM8.2 8.2V5h7.6v3.2M4.2 12.2c4.8 2 10.8 2 15.6 0" />
      <path d="M10.5 12.8h3v2.1h-3z" />
    </>
  ),
  "income-gift": (
    <>
      <path d="M4 9.3h16v10.4H4zM3 5.8h18v3.5H3zM12 5.8v13.9" />
      <path d="M11.9 5.8H8.8a2 2 0 1 1 2-2l1.1 2ZM12.1 5.8h3.1a2 2 0 1 0-2-2l-1.1 2Z" />
    </>
  ),
  "income-sale": (
    <>
      <path d="m4.2 5.2 7.4-1.1 8.2 8.2-7.5 7.5-8.2-8.2.1-6.4Z" />
      <circle cx="8.1" cy="8.1" r="1.2" />
      <path d="M12 9.5c.8-.7 2.1-.6 2.8.1.8.8.8 2 0 2.8l-2.6 2.6" />
    </>
  ),
  "income-refund": (
    <>
      <path d="M7.2 8.1H4V4.9M4.3 7.8A8.2 8.2 0 1 1 4 15" />
      <path d="M14.5 9.3H11a1.8 1.8 0 0 0 0 3.6h2a1.8 1.8 0 0 1 0 3.6H9.5M12 7.3v11.2" />
    </>
  ),
  "income-bonus": (
    <>
      <path d="m12 3.2 2.4 5 5.5.8-4 3.8.9 5.5-4.8-2.6-4.8 2.6.9-5.5-4-3.8 5.5-.8 2.4-5Z" />
    </>
  ),
  "income-other": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4v9.2M7.4 12h9.2" />
    </>
  ),
} satisfies GlyphMap<IncomeIconName>;
