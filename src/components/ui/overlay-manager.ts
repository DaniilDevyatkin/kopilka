let scrollLockCount = 0;
let previousOverflow = "";
let previousPaddingInlineEnd = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;

  if (scrollLockCount === 0) {
    previousOverflow = document.body.style.overflow;
    previousPaddingInlineEnd = document.body.style.paddingInlineEnd;
    const documentWidth = document.documentElement.clientWidth;
    const scrollbarWidth =
      documentWidth > 0 ? Math.max(0, window.innerWidth - documentWidth) : 0;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingInlineEnd = `${scrollbarWidth}px`;
    }
    document.body.dataset.scrollLock = "true";
  }
  scrollLockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingInlineEnd = previousPaddingInlineEnd;
      document.body.removeAttribute("data-scroll-lock");
    }
  };
}

export const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}
