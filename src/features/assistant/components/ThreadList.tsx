import { useState } from "react";
import { Pin, PinOff, Plus, Trash2, Share2, Search, MessageSquare, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useAssistantThreads,
  useCreateThread,
  useDeleteThread,
  useUpdateThread,
  type AssistantThread,
} from "../hooks/useAssistantThreads";
import { useAssistantHistorySearch } from "../hooks/useAssistantHistorySearch";

type Props = {
  solicitationId: string;
  activeThreadId: string | null;
  onSelect: (id: string, messageId?: string) => void;
  shareBaseUrl?: string;
};

export function ThreadList({ solicitationId, activeThreadId, onSelect, shareBaseUrl }: Props) {
  const { data: threads = [], isLoading } = useAssistantThreads(solicitationId);
  const create = useCreateThread();
  const del = useDeleteThread();
  const upd = useUpdateThread();
  const [q, setQ] = useState("");
  const trimmed = q.trim();
  const searchMode = trimmed.length >= 2;
  const { data: hits = [], isFetching: searching } = useAssistantHistorySearch(solicitationId, trimmed);

  const filtered = threads.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  const newChat = async () => {
    const t = await create.mutateAsync({ solicitationId });
    onSelect(t.id);
  };

  const handleShare = (t: AssistantThread) => {
    const base = shareBaseUrl ?? `${window.location.origin}/solicitations/${solicitationId}?tab=assistant&thread=`;
    navigator.clipboard.writeText(`${base}${t.id}`);
    toast({ title: "Link copied", description: "Anyone with solicitation access can open this thread." });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b space-y-2">
        <Button size="sm" className="w-full" onClick={newChat} disabled={create.isPending}>
          <Plus className="h-4 w-4 mr-1.5" /> New chat
        </Button>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No conversations yet.</div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => (e.key === "Enter" ? onSelect(t.id) : null)}
              className={cn(
                "group px-3 py-2 border-b cursor-pointer hover:bg-muted/50 flex items-start gap-2",
                activeThreadId === t.id && "bg-muted",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title || "Untitled"}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-background"
                  title={t.pinned ? "Unpin" : "Pin"}
                  onClick={(e) => {
                    e.stopPropagation();
                    upd.mutate({ id: t.id, patch: { pinned: !t.pinned } });
                  }}
                >
                  {t.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-background"
                  title="Share link"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(t);
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-background text-destructive"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this conversation?")) del.mutate({ id: t.id, solicitationId });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
