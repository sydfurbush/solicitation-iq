import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Loader2, Mic, Send, Settings2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
import { PlainModeToggle } from "./PlainModeToggle";
import { SlashCommandPopover } from "./SlashCommandPopover";
import { StarterCards } from "./StarterCards";
import { MemoryPanel } from "./MemoryPanel";
import { PreferencesPanel } from "./PreferencesPanel";
import { cn } from "@/lib/utils";

type Props = {
  solicitationId: string;
  threadId: string;
  compact?: boolean;
};

export function AssistantChat({ solicitationId, threadId, compact }: Props) {
  const { data: messages = [], isLoading } = useAssistantMessages(threadId);
  const { data: presets = [] } = useAssistantPresets();
  const { data: threads = [] } = useAssistantThreads(solicitationId);
  const thread = useMemo(() => threads.find((t) => t.id === threadId) ?? null, [threads, threadId]);

  const send = useSendAssistantMessage();
  const updateThread = useUpdateThread();
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persona: PersonaKey = (thread?.persona as PersonaKey) ?? "capture_manager";
  const plainMode = !!thread?.plain_mode;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, send.isPending]);

  useEffect(() => {
    taRef.current?.focus();
  }, [threadId]);

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
    if (!msg || sending) return;
    const parsed = parseSlashCommand(msg);
    const slash: SlashPayload | null = parsed
      ? { handler: parsed.cmd.handler, rest: parsed.rest }
      : null;
    setInput("");
    try {
      await send.mutateAsync({
        solicitationId,
        threadId,
        message: msg,
        persona,
        plainMode,
        slash,
      });
      taRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Assistant error", description: e?.message ?? "Failed to send", variant: "destructive" });
      setInput(msg);
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
      <div className="border-b px-3 py-2 flex items-center gap-2 bg-background">
        <PersonaSelector value={persona} onChange={onPersonaChange} disabled={!thread || sending} />
        <PlainModeToggle value={plainMode} onChange={onPlainChange} disabled={!thread || sending} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
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
          messages.map((m) => <MessageRow key={m.id} m={m} />)
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
        className="border-t bg-background p-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
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
                    // SlashCommandPopover may consume Enter when picking a command;
                    // it preventsDefault in that case so submit still fires safely.
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={
                  transcribe.state === "recording"
                    ? "Listening… click the mic to stop"
                    : transcribe.state === "transcribing"
                    ? "Transcribing…"
                    : "Type / for commands, or ask about risks, requirements, incumbents…"
                }
                rows={2}
                className="resize-none min-h-[44px]"
                disabled={sending || transcribe.state !== "idle"}
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
        <Button
          type="button"
          size="icon"
          variant={transcribe.state === "recording" ? "destructive" : "outline"}
          onClick={handleMic}
          disabled={sending || transcribe.state === "transcribing"}
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
        <Button type="submit" size="icon" disabled={sending || !input.trim() || transcribe.state !== "idle"}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function MessageRow({ m }: { m: AssistantMessage }) {
  const text = (m.parts ?? []).map((p) => (p.type === "text" ? p.text ?? "" : "")).join("\n");
  const isUser = m.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap"
            : "max-w-[92%] text-sm"
        }
      >
        {isUser ? (
          text
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
            {Array.isArray(m.citations) && m.citations.length > 0 && (
              <div className="not-prose mt-2 flex flex-wrap gap-1">
                {m.citations.map((c: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                    {c.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
