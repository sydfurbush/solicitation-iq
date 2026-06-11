import { X, BookOpen } from "lucide-react";
import { useClientKnowledge } from "@/features/clients/hooks/useClientKnowledge";
import { usePinnedKnowledge } from "../hooks/usePinnedKnowledge";

type Props = {
  clientId: string | undefined;
  threadId: string;
  solicitationId: string;
  pinnedIds: string[];
};

export function PinnedKnowledgeChips({ clientId, threadId, solicitationId, pinnedIds }: Props) {
  const { data: docs = [] } = useClientKnowledge(clientId);
  const { unpin, isPending } = usePinnedKnowledge(threadId, solicitationId);

  if (!pinnedIds.length) return null;
  const pinnedDocs = pinnedIds
    .map((id) => docs.find((d) => d.id === id))
    .filter(Boolean) as { id: string; title: string }[];

  if (!pinnedDocs.length) return null;

  return (
    <div className="border-b bg-muted/30 px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
      <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
      {pinnedDocs.map((d) => (
        <button
          key={d.id}
          type="button"
          disabled={isPending}
          onClick={() => unpin(pinnedIds, d.id).catch(() => {})}
          className="inline-flex items-center gap-1 rounded-full bg-background border px-2 py-0.5 text-[11px] hover:bg-destructive/10 hover:border-destructive/40 transition-colors max-w-[200px]"
          title={`Unpin "${d.title}"`}
        >
          <span className="truncate">{d.title}</span>
          <X className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      ))}
    </div>
  );
}
