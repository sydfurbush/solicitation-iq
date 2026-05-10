import { useEffect } from "react";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface Shortcut {
  /** Lowercase key name, e.g. "k", "n", "Escape", "?" */
  key: string;
  /** Require Cmd (mac) or Ctrl (others) */
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  /** When true, allows shortcut even if focus is in input/textarea */
  allowInInput?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const metaPressed = e.metaKey || e.ctrlKey;
        const matches =
          e.key.toLowerCase() === s.key.toLowerCase() &&
          (!s.meta || metaPressed) &&
          (s.shift === undefined || e.shiftKey === s.shift) &&
          (s.alt === undefined || e.altKey === s.alt);
        if (!matches) continue;
        if (!s.allowInInput && isEditable(e.target)) continue;
        s.handler(e);
        break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts]);
}

export default useKeyboardShortcuts;
