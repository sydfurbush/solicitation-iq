import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "⌘ K / Ctrl K", description: "Open global search" },
  { keys: "⌘ N / Ctrl N", description: "Create new solicitation" },
  { keys: "⌘ U / Ctrl U", description: "Upload documents (in solicitation)" },
  { keys: "Esc", description: "Close modals and panels" },
  { keys: "?", description: "Show this shortcuts help" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between border-b last:border-0 py-2"
            >
              <span className="text-sm">{s.description}</span>
              <kbd className="text-xs bg-muted px-2 py-1 rounded font-mono">{s.keys}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsHelp;
