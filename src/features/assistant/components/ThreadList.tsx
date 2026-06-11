import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  Share2,
  Search,
  MessageSquare,
  User,
  BookOpen,
  Brain,
  Settings2,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useAssistantThreads,
  useCreateThread,
  useDeleteThread,
  useUpdateThread,
  type AssistantThread,
} from "../hooks/useAssistantThreads";
import {
  useAssistantFolders,
  useCreateFolder,
  useDeleteFolder,
  useRenameFolder,
  type AssistantFolder,
} from "../hooks/useAssistantFolders";
import { useAssistantHistorySearch } from "../hooks/useAssistantHistorySearch";
import { formatThreadTitle } from "../lib/formatThreadTitle";

type Props = {
  solicitationId: string;
  activeThreadId: string | null;
  onSelect: (id: string, messageId?: string) => void;
  shareBaseUrl?: string;
  onOpenKnowledge?: () => void;
  onOpenMemory?: () => void;
  onOpenPreferences?: () => void;
  pinnedKnowledgeCount?: number;
};

export function ThreadList({
  solicitationId,
  activeThreadId,
  onSelect,
  shareBaseUrl,
  onOpenKnowledge,
  onOpenMemory,
  onOpenPreferences,
  pinnedKnowledgeCount = 0,
}: Props) {
  const { data: threads = [], isLoading } = useAssistantThreads(solicitationId);
  const { data: folders = [] } = useAssistantFolders();
  const create = useCreateThread();
  const del = useDeleteThread();
  const upd = useUpdateThread();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();

  const [q, setQ] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<AssistantFolder | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (t: AssistantThread) => {
    setRenamingId(t.id);
    setRenameValue(t.title || "");
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };
  const commitRename = (t: AssistantThread) => {
    const name = renameValue.trim();
    if (!name || name === t.title) {
      cancelRename();
      return;
    }
    upd.mutate({ id: t.id, patch: { title: name } });
    cancelRename();
  };


  const trimmed = q.trim();
  const searchMode = trimmed.length >= 2;
  const { data: hits = [], isFetching: searching } = useAssistantHistorySearch(solicitationId, trimmed);

  const active = threads.filter((t) => !t.deleted_at);
  const trashed = threads.filter((t) => !!t.deleted_at);
  const filtered = active.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  const grouped = useMemo(() => {
    const pinned = filtered.filter((t) => t.pinned);
    const byFolder = new Map<string, AssistantThread[]>();
    folders.forEach((f) => byFolder.set(f.id, []));
    const unfiled: AssistantThread[] = [];
    for (const t of filtered) {
      if (t.pinned) continue;
      if (t.folder_id && byFolder.has(t.folder_id)) {
        byFolder.get(t.folder_id)!.push(t);
      } else {
        unfiled.push(t);
      }
    }
    // Recency buckets for unfiled
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const recent: AssistantThread[] = [];
    const older: AssistantThread[] = [];
    for (const t of unfiled) {
      const age = now - new Date(t.last_message_at).getTime();
      if (age <= SEVEN_DAYS) recent.push(t);
      else older.push(t);
    }
    return { pinned, byFolder, recent, older };
  }, [filtered, folders]);

  const newChat = async () => {
    const t = await create.mutateAsync({ solicitationId });
    onSelect(t.id);
  };

  const handleShare = (t: AssistantThread) => {
    const base = shareBaseUrl ?? `${window.location.origin}/solicitations/${solicitationId}?tab=assistant&thread=`;
    navigator.clipboard.writeText(`${base}${t.id}`);
    toast({ title: "Link copied", description: "Anyone with solicitation access can open this thread." });
  };

  const moveToFolder = (t: AssistantThread, folderId: string | null) => {
    upd.mutate({ id: t.id, patch: { folder_id: folderId } });
  };
  const togglePin = (t: AssistantThread) =>
    upd.mutate({ id: t.id, patch: { pinned: !t.pinned } });
  const softDelete = (t: AssistantThread) =>
    upd.mutate({ id: t.id, patch: { deleted_at: new Date().toISOString() } });
  const restore = (t: AssistantThread) =>
    upd.mutate({ id: t.id, patch: { deleted_at: null } });

  const submitFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    try {
      if (editingFolder) {
        await renameFolder.mutateAsync({ id: editingFolder.id, name });
      } else {
        await createFolder.mutateAsync({ name });
      }
      setFolderDialogOpen(false);
      setFolderName("");
      setEditingFolder(null);
    } catch (e: any) {
      toast({ title: "Folder error", description: e?.message ?? "Failed", variant: "destructive" });
    }
  };

  const renderRow = (t: AssistantThread, opts?: { inTrash?: boolean }) => {
    const isRenaming = renamingId === t.id;
    return (
      <div
        key={t.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isRenaming) onSelect(t.id);
        }}
        onKeyDown={(e) => {
          if (!isRenaming && e.key === "Enter") onSelect(t.id);
        }}
        className={cn(
          "group px-3 py-2 border-b cursor-pointer hover:bg-muted/50 flex items-start gap-2",
          activeThreadId === t.id && "bg-muted",
        )}
      >
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(t)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename(t);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              className="h-7 text-sm px-2"
            />
          ) : (
            <div className="text-sm font-medium truncate flex items-center gap-1.5">
              {t.pinned && !opts?.inTrash && (
                <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{t.title || "Untitled"}</span>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
          </div>
          {t.tags && t.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {t.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[9px] px-1 rounded bg-muted text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {!isRenaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "p-1 rounded hover:bg-background shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100",
                  activeThreadId === t.id && "opacity-100",
                )}
                title="More"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
              {opts?.inTrash ? (
                <>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      restore(t);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Permanently delete this conversation?"))
                        del.mutate({ id: t.id, solicitationId });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(t);
                    }}
                  >
                    {t.pinned ? (
                      <>
                        <PinOff className="h-3.5 w-3.5 mr-2" /> Unpin
                      </>
                    ) : (
                      <>
                        <Pin className="h-3.5 w-3.5 mr-2" /> Pin to top
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs"
                    onSelect={(e) => {
                      e.preventDefault();
                      startRename(t);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs">
                      <Folder className="h-3.5 w-3.5 mr-2" /> Move to folder
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      <DropdownMenuItem
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToFolder(t, null);
                        }}
                      >
                        Unfiled
                      </DropdownMenuItem>
                      {folders.length > 0 && <DropdownMenuSeparator />}
                      {folders.map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveToFolder(t, f.id);
                          }}
                        >
                          {f.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(t);
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-2" /> Copy share link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      softDelete(t);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Move to Trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };


  const Section = ({
    id,
    label,
    count,
    children,
    actions,
  }: {
    id: string;
    label: string;
    count: number;
    children: React.ReactNode;
    actions?: React.ReactNode;
  }) => {
    const isCollapsed = !!collapsed[id];
    return (
      <div>
        <div className="flex items-center gap-1 px-3 pt-3 pb-1">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed((c) => ({ ...c, [id]: !isCollapsed }))}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {label}
            {count > 0 && <span className="ml-1">· {count}</span>}
          </button>
          {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
        {!isCollapsed && <div>{children}</div>}
      </div>
    );
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

      {/* Quick actions */}
      <div className="px-3 py-2 border-b space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-xs gap-2"
          onClick={onOpenKnowledge}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Knowledge
          {pinnedKnowledgeCount > 0 && (
            <span className="ml-auto text-[10px] px-1.5 rounded bg-muted">
              {pinnedKnowledgeCount}
            </span>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-xs gap-2"
          onClick={onOpenMemory}
        >
          <Brain className="h-3.5 w-3.5" />
          Memory
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-xs gap-2"
          onClick={onOpenPreferences}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Preferences
        </Button>
      </div>

      {/* Folder controls */}
      <div className="px-3 py-2 border-b flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => {
            setEditingFolder(null);
            setFolderName("");
            setFolderDialogOpen(true);
          }}
        >
          <FolderPlus className="h-3.5 w-3.5" /> New folder
        </Button>
        <Button
          variant={showTrash ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs gap-1 ml-auto"
          onClick={() => setShowTrash((s) => !s)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Trash
          {trashed.length > 0 && <span className="text-[10px]">· {trashed.length}</span>}
        </Button>
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
        ) : showTrash ? (
          trashed.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Trash is empty.</div>
          ) : (
            trashed.map((t) => renderRow(t, { inTrash: true }))
          )
        ) : isLoading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No conversations yet.</div>
        ) : (
          <>
            {grouped.pinned.length > 0 && (
              <Section id="pinned" label="Pinned" count={grouped.pinned.length}>
                {grouped.pinned.map((t) => renderRow(t))}
              </Section>
            )}

            {folders.map((f) => {
              const items = grouped.byFolder.get(f.id) ?? [];
              return (
                <Section
                  key={f.id}
                  id={`folder-${f.id}`}
                  label={f.name}
                  count={items.length}
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Folder options"
                        >
                          <Folder className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => {
                            setEditingFolder(f);
                            setFolderName(f.name);
                            setFolderDialogOpen(true);
                          }}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs text-destructive"
                          onClick={() => {
                            if (confirm(`Delete folder "${f.name}"? Conversations will move to Unfiled.`))
                              deleteFolder.mutate({ id: f.id });
                          }}
                        >
                          Delete folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                >
                  {items.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-muted-foreground italic">Empty</div>
                  ) : (
                    items.map((t) => renderRow(t))
                  )}
                </Section>
              );
            })}

            {grouped.recent.length > 0 && (
              <Section id="recent" label="Previous 7 days" count={grouped.recent.length}>
                {grouped.recent.map((t) => renderRow(t))}
              </Section>
            )}
            {grouped.older.length > 0 && (
              <Section id="older" label="Older" count={grouped.older.length}>
                {grouped.older.map((t) => renderRow(t))}
              </Section>
            )}
          </>
        )}
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Rename folder" : "New folder"}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitFolder();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitFolder} disabled={!folderName.trim()}>
              {editingFolder ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
