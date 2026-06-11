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
            placeholder="Search titles & messages"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {searchMode ? (
          searching && hits.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Searching…</div>
          ) : hits.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No matching messages.</div>
          ) : (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {hits.length} message{hits.length === 1 ? "" : "s"}
              </div>
              {hits.map((h) => (
                <div
                  key={h.message_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(h.thread_id, h.message_id)}
                  onKeyDown={(e) => (e.key === "Enter" ? onSelect(h.thread_id, h.message_id) : null)}
                  className={cn(
                    "px-3 py-2 border-b cursor-pointer hover:bg-muted/50",
                    activeThreadId === h.thread_id && "bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {h.role === "user" ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <MessageSquare className="h-3 w-3" />
                    )}
                    <span className="truncate">{h.thread_title || "Untitled"}</span>
                    <span className="ml-auto shrink-0">
                      {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="mt-1 text-xs line-clamp-2">{h.snippet}</div>
                </div>
              ))}
            </>
          )
        ) : isLoading ? (

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
