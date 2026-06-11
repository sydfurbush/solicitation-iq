import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { SLASH_COMMANDS, type SlashCommand } from "../lib/personas";

type Props = {
  /** Current textarea value. Popover opens when it starts with "/". */
  value: string;
  /** Element to anchor the popover to (usually the textarea). */
  anchor: React.ReactNode;
  /** Called when the user picks a command. Replaces the value with `${cmd} ` so they can type the rest. */
  onPick: (cmd: SlashCommand) => void;
};

export function SlashCommandPopover({ value, anchor, onPick }: Props) {
  const trimmed = value.trimStart();
  const open = trimmed.startsWith("/") && !trimmed.includes("\n");
  const query = trimmed.split(/\s/, 1)[0]?.toLowerCase() ?? "";

  const filtered = useMemo(
    () => SLASH_COMMANDS.filter((c) => c.cmd.toLowerCase().startsWith(query)),
    [query],
  );

  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open || filtered.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Tab" || (e.key === "Enter" && trimmed.split(/\s/).length === 1)) {
        const cmd = filtered[active];
        if (cmd) {
          e.preventDefault();
          e.stopPropagation();
          onPick(cmd);
        }
      } else if (e.key === "Escape") {
        // Allow textarea to keep focus; do nothing — typing a space dismisses popover naturally.
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, filtered, active, onPick, trimmed]);

  return (
    <Popover open={open && filtered.length > 0}>
      <PopoverAnchor asChild>{anchor as any}</PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-[320px] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
          Slash commands
        </div>
        {filtered.map((c, i) => (
          <button
            key={c.cmd}
            type="button"
            onClick={() => onPick(c)}
            onMouseEnter={() => setActive(i)}
            className={`w-full text-left rounded-sm px-2 py-1.5 text-xs ${
              i === active ? "bg-muted" : ""
            }`}
          >
            <div className="font-mono text-[11px]">{c.cmd}</div>
            <div className="text-muted-foreground text-[11px]">{c.description}</div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
