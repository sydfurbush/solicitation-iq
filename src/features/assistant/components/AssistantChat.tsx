import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { BookOpen, Brain, ChevronDown, ChevronUp, Loader2, Mic, Send, Settings2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  useAssistantMessages,
  useAssistantPresets,
  useAssistantThreads,
  useSendAssistantMessage,
  useUpdateThread,
  type AssistantMessage,
  type SlashPayload,
} from "../hooks/useAssistantThreads";
import { useAssistantTranscribe, MicrophoneError } from "../hooks/useAssistantTranscribe";
import { parseSlashCommand, type PersonaKey } from "../lib/personas";
import { PersonaSelector } from "./PersonaSelector";

import { SlashCommandPopover } from "./SlashCommandPopover";
import { StarterCards } from "./StarterCards";
import { MemoryPanel } from "./MemoryPanel";
import { PreferencesPanel } from "./PreferencesPanel";
import { KnowledgePanel } from "./KnowledgePanel";
import { PinnedKnowledgeChips } from "./PinnedKnowledgeChips";

import { SuggestedKnowledgeBanner, type KnowledgeSuggestion } from "./SuggestedKnowledgeBanner";
import { PhotoAttachmentButton } from "./PhotoAttachmentButton";
import { AttachmentChips } from "./AttachmentChips";
import { MessageAttachments } from "./MessageAttachments";
import { ExportThreadButton } from "./ExportThreadButton";
import { PinnedEntityChips } from "./PinnedEntityChips";
import { PinEntityPopover } from "./PinEntityPopover";
import { AssistantAnalyticsButton } from "./AssistantAnalyticsButton";
import { InlineActionButtons } from "./InlineActionButtons";
import { uploadAssistantPhoto, useInvalidateAttachments } from "../hooks/useAssistantAttachments";
import { cn } from "@/lib/utils";

type Props = {
  solicitationId: string;
  threadId: string;
  compact?: boolean;
  memoryOpen?: boolean;
  onMemoryOpenChange?: (v: boolean) => void;
  prefsOpen?: boolean;
  onPrefsOpenChange?: (v: boolean) => void;
  knowledgeOpen?: boolean;
  onKnowledgeOpenChange?: (v: boolean) => void;
};

export function AssistantChat({
  solicitationId,
  threadId,
  compact,
  memoryOpen: memoryOpenProp,
  onMemoryOpenChange,
  prefsOpen: prefsOpenProp,
  onPrefsOpenChange,
  knowledgeOpen: knowledgeOpenProp,
  onKnowledgeOpenChange,
}: Props) {
  const { data: messages = [], isLoading } = useAssistantMessages(threadId);
  const { data: presets = [] } = useAssistantPresets();
  const { data: threads = [] } = useAssistantThreads(solicitationId);
  const thread = useMemo(() => threads.find((t) => t.id === threadId) ?? null, [threads, threadId]);

  const send = useSendAssistantMessage();
  const updateThread = useUpdateThread();
  const invalidateAttachments = useInvalidateAttachments();
  const [input, setInput] = useState("");
  const [memoryOpenInternal, setMemoryOpenInternal] = useState(false);
  const [prefsOpenInternal, setPrefsOpenInternal] = useState(false);
  const [knowledgeOpenInternal, setKnowledgeOpenInternal] = useState(false);
  const memoryOpen = memoryOpenProp ?? memoryOpenInternal;
  const setMemoryOpen = onMemoryOpenChange ?? setMemoryOpenInternal;
  const prefsOpen = prefsOpenProp ?? prefsOpenInternal;
  const setPrefsOpen = onPrefsOpenChange ?? setPrefsOpenInternal;
  const knowledgeOpen = knowledgeOpenProp ?? knowledgeOpenInternal;
  const setKnowledgeOpen = onKnowledgeOpenChange ?? setKnowledgeOpenInternal;
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persona: PersonaKey = (thread?.persona as PersonaKey) ?? "capture_manager";
  const plainMode = !!thread?.plain_mode;
  const pinnedKnowledgeIds = useMemo(
    () => (thread?.pinned_knowledge_ids ?? []) as string[],
    [thread?.pinned_knowledge_ids],
  );

  // Resolve the solicitation's client_id once for the Knowledge panel.
  const { data: clientId } = useQuery({
    queryKey: ["solicitation_client_id", solicitationId],
    enabled: !!solicitationId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("client_id")
        .eq("id", solicitationId)
        .maybeSingle();
      if (error) throw error;
      return (data?.client_id as string | null) ?? null;
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, send.isPending]);


  useEffect(() => {
    taRef.current?.focus();
  }, [threadId]);

  const [searchParams, setSearchParams] = useSearchParams();
  const jumpMsgId = searchParams.get("msg");
  useEffect(() => {
    if (!jumpMsgId || isLoading) return;
    const el = document.getElementById(`assistant-msg-${jumpMsgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-md");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "rounded-md");
      const next = new URLSearchParams(searchParams);
      next.delete("msg");
      setSearchParams(next, { replace: true });
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpMsgId, isLoading, messages.length]);


  const sending = send.isPending;
  const transcribe = useAssistantTranscribe();

  const handleMic = async () => {
    if (transcribe.state === "recording") {
      transcribe.stop();
      return;
    }
    if (transcribe.state !== "idle") return;
    try {
      const text = await transcribe.start();
      if (text) {
        setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text));
        taRef.current?.focus();
      }
    } catch (e: any) {
      if (e instanceof MicrophoneError) {
        const titleByKind: Record<string, string> = {
          denied: "Microphone access blocked",
          no_device: "No microphone found",
          in_use: "Microphone is busy",
          unsupported: "Voice input not supported",
          unknown: "Microphone error",
        };
        toast({
          title: titleByKind[e.kind] ?? "Microphone error",
          description: e.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Voice input failed",
        description: e?.message ?? "Could not transcribe audio",
        variant: "destructive",
      });
    }
  };

  const submit = async (text?: string) => {
    const msg = (text ?? input).trim();
    if ((!msg && pendingPhotos.length === 0) || sending || uploading) return;
    const parsed = parseSlashCommand(msg);
    const slash: SlashPayload | null = parsed
      ? { handler: parsed.cmd.handler, rest: parsed.rest }
      : null;

    // Upload any staged photos first; collect attachment IDs.
    let attachmentIds: string[] = [];
    const photosToUpload = pendingPhotos;
    if (photosToUpload.length > 0) {
      setUploading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u.user?.id;
        if (!userId) throw new Error("Not signed in");
        attachmentIds = await Promise.all(
          photosToUpload.map((f) => uploadAssistantPhoto({ file: f, threadId, userId })),
        );
      } catch (e: any) {
        setUploading(false);
        toast({
          title: "Photo upload failed",
          description: e?.message ?? "Could not upload photos. Try again.",
          variant: "destructive",
        });
        return;
      }
      setUploading(false);
    }

    setInput("");
    setPendingPhotos([]);
    try {
      await send.mutateAsync({
        solicitationId,
        threadId,
        message: msg || "(see attached photo)",
        persona,
        plainMode,
        slash,
        pinnedKnowledgeIds,
        attachmentIds,
      });
      invalidateAttachments(threadId);
      taRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Assistant error", description: e?.message ?? "Failed to send", variant: "destructive" });
      setInput(msg);
      // Note: uploaded photos remain in storage and attached to the thread,
      // but we don't restore them as pending (they're already saved).
    }
  };

  const onPersonaChange = (next: PersonaKey) => {
    if (!thread || next === persona) return;
    updateThread.mutate({ id: thread.id, patch: { persona: next } });
  };
  const onPlainChange = (next: boolean) => {
    if (!thread || next === plainMode) return;
    updateThread.mutate({ id: thread.id, patch: { plain_mode: next } });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b px-3 py-2 flex items-center justify-center gap-2 bg-background relative">
        <PersonaSelector value={persona} onChange={onPersonaChange} disabled={!thread || sending} />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <ExportThreadButton thread={thread} messages={messages} />
          <AssistantAnalyticsButton />
        </div>
      </div>

      <PinnedKnowledgeChips
        clientId={clientId ?? undefined}
        threadId={threadId}
        solicitationId={solicitationId}
        pinnedIds={pinnedKnowledgeIds}
      />
      <PinnedEntityChips thread={thread} />
      <div className="border-b bg-background px-3 py-1 flex items-center">
        <PinEntityPopover thread={thread} solicitationId={solicitationId} />
      </div>


      <MemoryPanel open={memoryOpen} onOpenChange={setMemoryOpen} />
      <PreferencesPanel open={prefsOpen} onOpenChange={setPrefsOpen} />
      <KnowledgePanel
        open={knowledgeOpen}
        onOpenChange={setKnowledgeOpen}
        clientId={clientId ?? undefined}
        threadId={threadId}
        solicitationId={solicitationId}
        pinnedIds={pinnedKnowledgeIds}
      />



      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(() => {
          const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
          if (!lastAssistant) return null;
          const sugg = (lastAssistant.citations ?? [])
            .filter((c: any) => c?.kind === "suggested_knowledge" && c?.document_id && c?.title)
            .map((c: any) => ({
              document_id: String(c.document_id),
              title: String(c.title),
              why: String(c.why ?? ""),
            })) as KnowledgeSuggestion[];
          if (!sugg.length) return null;
          return (
            <SuggestedKnowledgeBanner
              suggestions={sugg}
              pinnedIds={pinnedKnowledgeIds}
              threadId={threadId}
              solicitationId={solicitationId}
              messageKey={lastAssistant.id}
            />
          );
        })()}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : messages.length === 0 ? (
          <StarterCards
            solicitationId={solicitationId}
            persona={persona}
            plainMode={plainMode}
            fallback={presets as any[]}
            onPick={(p) => submit(p)}
            compact={compact}
          />
        ) : (
          messages.map((m) => <MessageRow key={m.id} m={m} threadId={threadId} solicitationId={solicitationId} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>


      {messages.length > 0 && presets.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t pt-3">
          {(presets as any[]).slice(0, 6).map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={sending}
              onClick={() => submit(p.prompt)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}

      <form
        className="border-t bg-background p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AttachmentChips
          files={pendingPhotos}
          onRemove={(i) => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
        />
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <SlashCommandPopover
              value={input}
              anchor={
                <Textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={
                    transcribe.state === "recording"
                      ? "Listening… click the mic to stop"
                      : transcribe.state === "transcribing"
                      ? "Transcribing…"
                      : uploading
                      ? "Uploading photos…"
                      : "Type / for commands, attach a photo, or ask about risks, requirements…"
                  }
                  rows={2}
                  className="resize-none min-h-[44px]"
                  disabled={sending || uploading || transcribe.state !== "idle"}
                />
              }
              onPick={(c) => {
                setInput((prev) => {
                  const rest = prev.trimStart().replace(/^\S+\s*/, "");
                  return `${c.cmd} ${rest}`.trimEnd() + (rest ? "" : " ");
                });
                taRef.current?.focus();
              }}
            />
          </div>
          <PhotoAttachmentButton
            pending={pendingPhotos}
            onAdd={(files) => setPendingPhotos((prev) => [...prev, ...files])}
            disabled={sending || uploading || transcribe.state !== "idle"}
          />
          <Button
            type="button"
            size="icon"
            variant={transcribe.state === "recording" ? "destructive" : "outline"}
            onClick={handleMic}
            disabled={sending || uploading || transcribe.state === "transcribing"}
            title={transcribe.state === "recording" ? "Stop recording" : "Voice input"}
            aria-label={transcribe.state === "recording" ? "Stop recording" : "Start voice input"}
          >
            {transcribe.state === "transcribing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : transcribe.state === "recording" ? (
              <Square className={cn("h-4 w-4")} />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={
              sending || uploading || transcribe.state !== "idle" ||
              (!input.trim() && pendingPhotos.length === 0)
            }
          >
            {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageRow({
  m,
  threadId,
  solicitationId,
}: {
  m: AssistantMessage;
  threadId: string;
  solicitationId: string;
}) {
  const text = (m.parts ?? []).map((p) => (p.type === "text" ? p.text ?? "" : "")).join("\n");
  const isUser = m.role === "user";
  const [citationsOpen, setCitationsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("assistant_citations_default_v1") === "open";
  });
  return (
    <div id={`assistant-msg-${m.id}`} className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] flex flex-col items-end"
            : "max-w-[92%] text-sm"
        }
      >
        {isUser ? (
          <>
            <MessageAttachments threadId={threadId} messageId={m.id} />
            <div className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
              {text}
            </div>
          </>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
            <InlineActionButtons
              messageId={m.id}
              solicitationId={solicitationId}
              citations={m.citations as any[]}
            />
            {Array.isArray(m.citations) && m.citations.length > 0 && (() => {
              const visible = (m.citations as any[]).filter(
                (c) => c?.kind !== "suggested_knowledge" && c?.kind !== "suggested_action" && c?.label,
              );
              if (!visible.length) return null;
              return (
                <div className="not-prose mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground gap-1"
                    onClick={() => {
                      const next = !citationsOpen;
                      setCitationsOpen(next);
                      try {
                        window.localStorage.setItem(
                          "assistant_citations_default_v1",
                          next ? "open" : "closed",
                        );
                      } catch {}
                    }}
                    aria-expanded={citationsOpen}
                  >
                    {citationsOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {citationsOpen ? "Hide" : "Show"} citations ({visible.length})
                  </Button>
                  {citationsOpen && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {visible.map((c: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                          {c.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
