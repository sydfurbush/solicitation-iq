import { useEffect, useState } from "react";
import { Lightbulb, Pin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePinnedKnowledge } from "../hooks/usePinnedKnowledge";
import { toast } from "@/hooks/use-toast";

export type KnowledgeSuggestion = {
  document_id: string;
  title: string;
  why: string;
};

type Props = {
  suggestions: KnowledgeSuggestion[];
  pinnedIds: string[];
  threadId: string;
  solicitationId: string;
  messageKey: string;
};

export function SuggestedKnowledgeBanner({
  suggestions,
  pinnedIds,
  threadId,
  solicitationId,
  messageKey,
}: Props) {
  const { pin, isPending } = usePinnedKnowledge(threadId, solicitationId);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  // Reset dismissal each time a new assistant message brings suggestions.
  useEffect(() => {
    setDismissedKey(null);
  }, [messageKey]);

  const visible = suggestions.filter((s) => !pinnedIds.includes(s.document_id));
  if (!visible.length || dismissedKey === messageKey) return null;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Lightbulb className="h-4 w-4 text-primary" />
        Suggested knowledge to pin
        <button
          type="button"
          aria-label="Dismiss suggestions"
          onClick={() => setDismissedKey(messageKey)}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {visible.slice(0, 3).map((s) => (
          <li key={s.document_id} className="flex items-start gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{s.title}</div>
              {s.why && <div className="text-muted-foreground line-clamp-2">{s.why}</div>}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1 shrink-0"
              disabled={isPending}
              onClick={async () => {
                try {
                  await pin(pinnedIds, s.document_id);
                  toast({ title: "Pinned", description: s.title });
                } catch (e: any) {
                  toast({
                    title: "Couldn't pin",
                    description: e?.message ?? "Try again",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Pin className="h-3 w-3" /> Pin
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
