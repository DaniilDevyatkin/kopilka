import { CORE_GLYPHS } from "./core-glyphs";
import { EXPENSE_GLYPHS, INCOME_GLYPHS } from "./finance-category-glyphs";
import type { GlyphMap } from "./glyph-types";
import { GOAL_GLYPHS, STATUS_GLYPHS } from "./goal-status-glyphs";
import type { AppIconName } from "./icon-names";

export const ICON_GLYPHS = {
  ...CORE_GLYPHS,
  ...EXPENSE_GLYPHS,
  ...INCOME_GLYPHS,
  ...GOAL_GLYPHS,
  ...STATUS_GLYPHS,
} satisfies GlyphMap<AppIconName>;
