import { Target, X, AlertTriangle, Sparkles, ListChecks, FileText } from "lucide-react";
import { usePinnedEntities } from "../hooks/usePinnedEntities";
import type { AssistantThread, PinnedEntityKind } from "../hooks/useAssistantThreads";

const ICONS: Record<PinnedEntityKind, React.ComponentType<{ className?: string }>> = {
  risk: AlertTriangle,
  opportunity: Sparkles,
  requirement: ListChecks,
  document: FileText,
};

type Props = { thread: AssistantThread | null };

export function PinnedEntityChips({ thread }: Props) {
  const { entities, remove, isPending } = usePinnedEntities(thread);
  if (!entities.length) return null;
  return (
    <div className="border-b bg-muted/30 px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
      <Target className="h-3 w-3 text-muted-foreground shrink-0" />
      {entities.map((e) => {
        const Icon = ICONS[e.kind];
        return (
          <button
            key={`${e.kind}:${e.id}`}
            type="button"
            disabled={isPending}
            onClick={() => remove(e.kind, e.id)}
            className="inline-flex items-center gap-1 rounded-full bg-background border px-2 py-0.5 text-[11px] hover:bg-destructive/10 hover:border-destructive/40 transition-colors max-w-[220px]"
            title={`Unpin focus: ${e.label}`}
          >
            <Icon className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{e.label}</span>
            <X className="h-3 w-3 shrink-0 opacity-70" />
          </button>
        );
      })}
    </div>
  );
}
