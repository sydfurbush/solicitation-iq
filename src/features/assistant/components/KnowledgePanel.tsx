import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2, Pin, PinOff, FileText, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClientKnowledge, type KnowledgeDoc } from "@/features/clients/hooks/useClientKnowledge";
import { usePinnedKnowledge } from "../hooks/usePinnedKnowledge";
import { toast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | undefined;
  threadId: string;
  solicitationId: string;
  pinnedIds: string[];
};

export function KnowledgePanel({ open, onOpenChange, clientId, threadId, solicitationId, pinnedIds }: Props) {
  const { data: docs = [], isLoading } = useClientKnowledge(clientId);
  const { pin, unpin, clear, isPending } = usePinnedKnowledge(threadId, solicitationId);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const hay = [d.title ?? "", ...(d.tags ?? []), d.source_type ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [docs, query]);

  const toggle = async (d: KnowledgeDoc) => {
    try {
      if (pinnedIds.includes(d.id)) {
        await unpin(pinnedIds, d.id);
      } else {
        if (d.status !== "ready") {
          toast({
            title: "Document not ready",
            description: "Pin it once processing is complete for best results.",
          });
        }
        await pin(pinnedIds, d.id);
      }
    } catch (e: any) {
      toast({ title: "Couldn't update pins", description: e?.message ?? "Try again", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Knowledge
          </SheetTitle>
          <SheetDescription>
            Pin client knowledge documents so the assistant can cite them in this thread.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="Search title or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
          {pinnedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={isPending}
              onClick={() => clear().catch(() => {})}
            >
              Clear ({pinnedIds.length})
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 mt-3 -mx-6">
          <div className="px-6 space-y-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !clientId ? (
              <EmptyHint message="This solicitation has no client linked." />
            ) : filtered.length === 0 ? (
              <EmptyHint
                message={
                  docs.length === 0
                    ? "No knowledge documents yet."
                    : "No documents match your search."
                }
                clientId={clientId}
                showAddLink={docs.length === 0}
              />
            ) : (
              filtered.map((d) => {
                const isPinned = pinnedIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggle(d)}
                    disabled={isPending}
                    className={`w-full text-left rounded-md border p-3 transition-colors hover:bg-muted/50 ${
                      isPinned ? "border-primary/60 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm truncate">{d.title}</div>
                          <StatusBadge status={d.status} />
                        </div>
                        {d.tags && d.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {d.tags.slice(0, 5).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-muted-foreground">
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === "ready") return null;
  const tone =
    status === "error"
      ? "destructive"
      : "outline";
  return (
    <Badge variant={tone as any} className="text-[10px] font-normal capitalize">
      {status}
    </Badge>
  );
}

function EmptyHint({
  message,
  clientId,
  showAddLink,
}: {
  message: string;
  clientId?: string;
  showAddLink?: boolean;
}) {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground space-y-3">
      <AlertCircle className="h-5 w-5 mx-auto opacity-60" />
      <div>{message}</div>
      {showAddLink && clientId && (
        <Link
          to={`/clients/${clientId}?tab=knowledge`}
          className="inline-block text-primary hover:underline text-xs"
        >
          Open Knowledge tab →
        </Link>
      )}
    </div>
  );
}
