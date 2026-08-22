import type { GlyphMap } from "./glyph-types";
import type { GoalIconName, StatusIconName } from "./icon-names";

export const GOAL_GLYPHS = {
  "goal-tech": (
    <>
      <rect x="4.2" y="3" width="15.6" height="18" rx="3" />
      <path d="M9.5 6h5M8 10h8v6H8zM10 18.5h4" />
    </>
  ),
  "goal-travel": (
    <>
      <path d="M12 21c4-4.4 6-8 6-11a6 6 0 1 0-12 0c0 3 2 6.6 6 11Z" />
      <path d="m8.6 11.3 2.3-.7 1.4-2.2a.8.8 0 0 1 1.3-.2l.2.2a.8.8 0 0 1-.1 1.3l-2.3 1.4-.7 2.3-.6-.6.2-1.4-1.1.5-.6-.6Z" />
    </>
  ),
  "goal-car": (
    <>
      <path d="M4.4 17.5h15.2l1-6-2.4-4.3H5.8l-2.4 4.3 1 6Z" />
      <path d="M3.8 12.2h16.4M6.8 17.5v2M17.2 17.5v2M7.2 14.7h.1M16.8 14.7h.1M9.2 4.2h5.6" />
    </>
  ),
  "goal-housing": (
    <>
      <path d="m3.3 11.5 8.7-7.1 8.7 7.1M5.5 9.8v10h13v-10M9.3 19.8v-6h5.4v6" />
      <path d="M12 7.5h.1" />
    </>
  ),
  "goal-education": (
    <>
      <path d="m2.8 8.8 9.2-4.6 9.2 4.6-9.2 4.6-9.2-4.6Z" />
      <path d="M6.2 11v5.3c3.3 2.3 8.3 2.3 11.6 0V11M21.2 8.8v7.5" />
      <path d="M19.8 18h2.8" />
    </>
  ),
  "goal-gift": (
    <>
      <path d="M4 9h16v11H4zM3 5.5h18V9H3zM12 5.5V20" />
      <path d="M11.9 5.5H8.7a2 2 0 1 1 2-2l1.2 2ZM12.1 5.5h3.2a2 2 0 1 0-2-2l-1.2 2Z" />
      <path d="m16.5 12.3.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2.7-1.4Z" />
    </>
  ),
  "goal-clothes": (
    <>
      <path d="m8.1 4.2-5 3.1 2.1 4 2.2-1.1v9.3h9.2v-9.3l2.2 1.1 2.1-4-5-3.1a4.7 4.7 0 0 1-7.8 0Z" />
      <path d="M12 8.5v8" />
    </>
  ),
  "goal-health": (
    <>
      <path d="M12 20.5S4 16 4 9.8A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.8c0 6.2-8 10.7-8 10.7Z" />
      <path d="m6.8 12h2.3l1-2.2 2.2 5 1.1-2.8h3.8" />
    </>
  ),
  "goal-hobby": (
    <>
      <path d="M12 4.2c-4.9 0-8.8 3.4-8.8 7.8 0 4.2 3.3 7.3 7.3 7.3h1.2a1.5 1.5 0 0 0 1.1-2.5 1.5 1.5 0 0 1 1.1-2.5h2c3 0 4.9-2.3 4.9-4.7 0-3.2-3.9-5.4-8.8-5.4Z" />
      <circle cx="7.2" cy="10.5" r="1" />
      <circle cx="10.2" cy="7.8" r="1" />
      <circle cx="14" cy="7.7" r="1" />
      <circle cx="16.8" cy="10.2" r="1" />
    </>
  ),
  "goal-emergency-fund": (
    <>
      <path d="M5 10h14v10H5zM4 10l8-5 8 5M8.2 13.2h7.6M8.2 16.8h7.6" />
      <path d="M12 5V2.8M9.2 2.8h5.6" />
    </>
  ),
  "goal-other": (
    <>
      <path d="M12 3.2 14.6 9l6.2.6-4.6 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.2 9.6 9.4 9 12 3.2Z" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
} satisfies GlyphMap<GoalIconName>;

export const STATUS_GLYPHS = {
  "status-active": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2v5.2l3.5 2.1" />
    </>
  ),
  "status-completed": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m7.8 12.2 2.8 2.9 5.8-6.1" />
    </>
  ),
  "status-archived": (
    <>
      <path d="M4.2 8.2h15.6v11.2H4.2zM3.2 4.5h17.6v3.7H3.2zM9.2 12h5.6" />
      <path d="m15.8 15.2 1.2 1.2 2.2-2.4" />
    </>
  ),
  "status-cancelled": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
    </>
  ),
  "priority-high": (
    <>
      <path d="m5 15 7-7 7 7M5 20l7-7 7 7" />
      <path d="M12 4v4" />
    </>
  ),
  "priority-medium": (
    <>
      <path d="M5 9.5h14M5 14.5h14" />
      <circle cx="12" cy="12" r="8.5" />
    </>
  ),
  "priority-low": (
    <>
      <path d="m5 9 7 7 7-7M5 4l7 7 7-7" />
      <path d="M12 16v4" />
    </>
  ),
} satisfies GlyphMap<StatusIconName>;
