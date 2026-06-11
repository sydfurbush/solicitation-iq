import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ChevronDown, ChevronUp, Loader2, Mic, Send, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * If the model emitted a markdown table on a single line (rows separated by
 * "| |" instead of "|\n|"), insert newlines so remark-gfm can parse it.
 */
function normalizeAssistantMarkdown(input: string): string {
  if (!input || !input.includes("|")) return input;
  // Only touch runs that look like a table (contain a separator like |---|).
  if (!/\|\s*-{3,}\s*\|/.test(input)) return input;

  // If the assistant already returned a normal multiline GFM table, leave it
  // untouched. Rewriting valid separator rows can make remark-gfm treat the
  // whole table as plain inline text.
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(input)) {
    return input;
  }

  return input
    // Break between adjacent rows: "...| |..." -> "...|\n|..."
    .replace(/\|[ \t]+\|/g, "|\n|")
    // Collapse accidental double newlines created above
    .replace(/\n{3,}/g, "\n\n");
}
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
import { MermaidBlock } from "./MermaidBlock";
import { OrgChartBlock, looksLikeOrgChart } from "./OrgChartBlock";
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
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-2 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1.5 prose-h4:text-sm prose-h4:mt-3 prose-h4:mb-1 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5 prose-li:my-0.5 prose-li:marker:text-muted-foreground prose-strong:text-foreground prose-strong:font-semibold prose-em:text-foreground prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:opacity-80 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-hr:my-4 prose-hr:border-border prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:p-3 prose-pre:overflow-x-auto prose-pre:my-3 prose-pre:text-[0.85em] prose-img:rounded-md prose-img:my-3 [&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0 [&_ul.contains-task-list]:my-2 [&_li.task-list-item>ul.contains-task-list]:my-1 [&_li.task-list-item>ol]:my-1 [&_li.task-list-item>ul.contains-task-list:first-child]:mt-0 [&_li.task-list-item>ul.contains-task-list:last-child]:mb-0 [&_li.task-list-item>ol:first-child]:mt-0 [&_li.task-list-item>ol:last-child]:mb-0 [&_li.task-list-item]:grid [&_li.task-list-item]:grid-cols-[auto_1fr] [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-x-2 [&_li.task-list-item]:my-1 [&_li.task-list-item:first-child]:mt-0 [&_li.task-list-item:last-child]:mb-0 [&_li.task-list-item]:leading-relaxed [&_li.task-list-item]:pl-0 [&_li.task-list-item]:before:hidden [&_li.task-list-item>p]:my-0 [&_li.task-list-item>p]:col-start-2 [&_li.task-list-item>ul]:col-start-2 [&_li.task-list-item>ol]:col-start-2 [&_li.task-list-item>input[type=checkbox]]:row-start-1 [&_li.task-list-item>input[type=checkbox]]:col-start-1 [&_li.task-list-item>input[type=checkbox]]:mt-[0.3em] [&_li.task-list-item>input[type=checkbox]]:h-3.5 [&_li.task-list-item>input[type=checkbox]]:w-3.5 [&_li.task-list-item>input[type=checkbox]]:shrink-0 [&_li.task-list-item>input[type=checkbox]]:cursor-default [&_li.task-list-item>input[type=checkbox]]:accent-primary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                pre: ({ node, children, ...props }: any) => {
                  // Let mermaid + org-chart code blocks be rendered by the
                  // code component (return children directly to avoid double
                  // wrapping in <pre>).
                  const child: any = Array.isArray(children) ? children[0] : children;
                  const childClass: string = child?.props?.className ?? "";
                  const childText: string = Array.isArray(child?.props?.children)
                    ? child.props.children.join("")
                    : String(child?.props?.children ?? "");
                  if (/language-mermaid/.test(childClass)) {
                    return <>{children}</>;
                  }
                  if (looksLikeOrgChart(childText)) {
                    return <>{children}</>;
                  }
                  return (
                    <pre
                      {...props}
                      className="not-prose my-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[0.8rem] leading-relaxed whitespace-pre font-mono"
                    >
                      {children}
                    </pre>
                  );
                },
                code: ({ node, className, children, ...props }: any) => {
                  const codeText = String(
                    Array.isArray(children) ? children.join("") : children ?? "",
                  );
                  if (/language-mermaid/.test(className ?? "")) {
                    return <MermaidBlock code={codeText.replace(/\n$/, "")} />;
                  }
                  // Detect ASCII org charts (with or without a language tag)
                  // and route them through the dedicated renderer.
                  const isBlock = /language-/.test(className ?? "") || codeText.includes("\n");
                  if (isBlock && looksLikeOrgChart(codeText)) {
                    return <OrgChartBlock code={codeText.replace(/\n$/, "")} />;
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                input: ({ node, ...props }: any) => {
                  if (props.type === "checkbox") {
                    return <input {...props} disabled readOnly />;
                  }
                  return <input {...props} />;
                },
                table: ({ node, ...props }) => (
                  <div className="my-3 -mx-1 overflow-x-auto rounded-md border border-border">
                    <table
                      {...props}
                      className="w-full border-collapse text-sm table-auto"
                    />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead {...props} className="bg-muted/60" />
                ),
                tbody: ({ node, ...props }) => (
                  <tbody
                    {...props}
                    className="[&_tr:nth-child(even)]:bg-muted/20"
                  />
                ),
                tr: ({ node, ...props }) => (
                  <tr {...props} className="border-b border-border last:border-b-0" />
                ),
                th: ({ node, style, ...props }: any) => (
                  <th
                    {...props}
                    style={style}
                    className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-border last:border-r-0"
                  />
                ),
                td: ({ node, style, ...props }: any) => (
                  <td
                    {...props}
                    style={style}
                    className="px-3 py-2 align-top border-r border-border last:border-r-0 break-words"
                  />
                ),
              }}
            >{normalizeAssistantMarkdown(text)}</ReactMarkdown>
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
