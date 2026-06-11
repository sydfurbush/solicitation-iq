import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssistantStarters } from "../hooks/useAssistantStarters";
import type { PersonaKey } from "../lib/personas";

type Props = {
  solicitationId: string;
  persona: PersonaKey;
  plainMode: boolean;
  fallback: Array<{ id: string; label: string; prompt: string }>;
  onPick: (prompt: string) => void;
  compact?: boolean;
};

export function StarterCards({ solicitationId, persona, plainMode, fallback, onPick, compact }: Props) {
  const { data, isLoading, isError, refetch, isFetching } = useAssistantStarters({
    solicitationId,
    persona,
    plainMode,
  });

  const starters = (data && data.length > 0)
    ? data
    : (isError ? fallback.slice(0, 4).map((p) => p.prompt) : []);

  return (
    <div className="flex flex-col items-center text-center py-8 px-4 w-full">
      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-base">AI Assistant</h3>
      <p className="text-sm text-muted-foreground max-w-md mt-1">
        Tailored to this solicitation. Ask about risks, requirements, the client's capabilities and lens, incumbents,
        or anything in the analysis.
      </p>

      <div className="mt-5 w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Suggested starters
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={isFetching}
            onClick={() => refetch()}
            title="Regenerate starters"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-md bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : starters.length > 0 ? (
          <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
            {starters.slice(0, 4).map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPick(s)}
                className="text-left text-sm border rounded-md p-3 hover:bg-muted transition"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No suggestions available.</div>
        )}
      </div>
    </div>
  );
}
