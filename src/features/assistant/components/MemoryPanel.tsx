import { useState } from "react";
import { Loader2, Plus, Trash2, Brain } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAddMemory, useAssistantMemory, useDeleteMemory } from "../hooks/useAssistantMemory";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemoryPanel({ open, onOpenChange }: Props) {
  const { data: memories = [], isLoading } = useAssistantMemory();
  const add = useAddMemory();
  const del = useDeleteMemory();
  const [draft, setDraft] = useState("");

  const submit = async () => {
    const fact = draft.trim();
    if (!fact) return;
    try {
      await add.mutateAsync({ fact, source: "explicit" });
      setDraft("");
    } catch (e: any) {
      toast({ title: "Couldn't save fact", description: e?.message ?? "Try again", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4" /> Assistant Memory
          </SheetTitle>
          <SheetDescription>
            Durable facts the assistant remembers across every conversation.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-end gap-2 mt-4">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Our primary NAICS is 541512"
          />
          <Button size="sm" onClick={submit} disabled={add.isPending || !draft.trim()}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : memories.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No saved facts yet. Add one above, or type <code>/remember &lt;fact&gt;</code> in chat.
            </div>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="border rounded-md p-2 flex items-start gap-2 text-sm">
                <div className="flex-1">
                  <div>{m.fact}</div>
                  <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                    {m.source === "auto" ? "auto-learned" : "explicit"}
                  </Badge>
                </div>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted text-destructive"
                  onClick={() => del.mutate({ id: m.id })}
                  title="Forget"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
