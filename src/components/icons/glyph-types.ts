import type { ReactNode } from "react";

export type GlyphMap<Name extends string> = Readonly<Record<Name, ReactNode>>;
