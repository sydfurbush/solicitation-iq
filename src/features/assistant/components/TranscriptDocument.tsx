import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";
import { AssistantMessageBody } from "./AssistantMessageBody";

const PERSONA_LABEL: Record<string, string> = {
  capture_manager: "Capture Manager",
  proposal_writer: "Proposal Writer",
  compliance_reviewer: "Compliance Reviewer",
  pricing_analyst: "Pricing Analyst",
  executive: "Executive",
  plain_english: "Plain English",
};

export function TranscriptDocument({
  thread,
  messages,
}: {
  thread: AssistantThread;
  messages: AssistantMessage[];
}) {
  const visible = messages.filter((m) => m.role !== "system");
  return (
    <div className="transcript-document">
      <header className="transcript-header">
        <h1 className="transcript-title">{thread.title || "Assistant transcript"}</h1>
        <div className="transcript-meta">
          <span>
            <strong>Persona:</strong> {PERSONA_LABEL[thread.persona] ?? thread.persona}
          </span>
          <span>
            <strong>Plain mode:</strong> {thread.plain_mode ? "on" : "off"}
          </span>
          <span>
            <strong>Exported:</strong> {new Date().toLocaleString()}
          </span>
        </div>
        <hr />
      </header>
      <main>
        {visible.map((m) => {
          const text = (m.parts ?? [])
            .map((p) => (p.type === "text" ? p.text ?? "" : ""))
            .join("\n");
          const isUser = m.role === "user";
          const ts = new Date(m.created_at).toLocaleString();
          const citations = Array.isArray(m.citations)
            ? (m.citations as any[]).filter(
                (c) => c?.label && c?.kind !== "suggested_knowledge" && c?.kind !== "suggested_action",
              )
            : [];
          return (
            <section key={m.id} className={`transcript-turn ${isUser ? "is-user" : "is-assistant"}`}>
              <div className="transcript-turn-head">
                <span className="transcript-speaker">{isUser ? "User" : "Assistant"}</span>
                <span className="transcript-timestamp">{ts}</span>
              </div>
              {isUser ? (
                <div className="transcript-user-body">{text}</div>
              ) : (
                <AssistantMessageBody text={text} />
              )}
              {citations.length > 0 && (
                <div className="transcript-citations">
                  <strong>Citations:</strong> {citations.map((c: any) => c.label).join(" · ")}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
