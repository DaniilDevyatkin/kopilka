import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from "@/features/theme/theme";

export const EARLY_THEME_SCRIPT = `(()=>{try{const k=${JSON.stringify(THEME_STORAGE_KEY)};const v=localStorage.getItem(k);const p=v==='light'||v==='dark'||v==='system'?v:${JSON.stringify(DEFAULT_THEME_PREFERENCE)};const d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);const t=d?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.dataset.themePreference=p;document.documentElement.style.colorScheme=t}catch{}})()`;
