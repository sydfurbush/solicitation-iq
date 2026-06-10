import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Sparkles, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  useAssistantMessages,
  useAssistantPresets,
  useSendAssistantMessage,
  type AssistantMessage,
} from "../hooks/useAssistantThreads";
import { useAssistantTranscribe, MicrophoneError } from "../hooks/useAssistantTranscribe";
import { cn } from "@/lib/utils";

type Props = {
  solicitationId: string;
  threadId: string;
  compact?: boolean;
};

export function AssistantChat({ solicitationId, threadId, compact }: Props) {
  const { data: messages = [], isLoading } = useAssistantMessages(threadId);
  const { data: presets = [] } = useAssistantPresets();
  const send = useSendAssistantMessage();
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setInput("");
    try {
      await send.mutateAsync({ solicitationId, threadId, message: msg });
      taRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Assistant error", description: e?.message ?? "Failed to send", variant: "destructive" });
      setInput(msg);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : messages.length === 0 ? (
          <EmptyState compact={compact} onPick={(p) => submit(p)} presets={presets as any[]} />
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
              : "Ask about risks, requirements, incumbents, the client lens…"
          }
          rows={2}
          className="resize-none min-h-[44px]"
          disabled={sending || transcribe.state !== "idle"}
        />
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

function EmptyState({
  presets,
  onPick,
  compact,
}: {
  presets: any[];
  onPick: (p: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-base">AI Assistant</h3>
      <p className="text-sm text-muted-foreground max-w-md mt-1">
        Tailored to this solicitation. Ask about risks, requirements, the client's capabilities and lens, incumbents,
        or anything in the analysis.
      </p>
      {presets.length > 0 && (
        <div className={`mt-5 grid gap-2 w-full ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
          {presets.slice(0, 6).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.prompt)}
              className="text-left text-sm border rounded-md p-3 hover:bg-muted transition"
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.prompt}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
