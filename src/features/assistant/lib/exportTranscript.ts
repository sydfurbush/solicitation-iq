import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";
import { marked } from "marked";

const KIND_LABEL: Record<string, string> = {
  capture_manager: "Capture Manager",
  proposal_writer: "Proposal Writer",
  compliance_reviewer: "Compliance Reviewer",
  pricing_analyst: "Pricing Analyst",
  executive: "Executive",
  plain_english: "Plain English",
};

export function buildTranscriptMarkdown(thread: AssistantThread, messages: AssistantMessage[]): string {
  const lines: string[] = [];
  lines.push(`# ${thread.title || "Assistant transcript"}`);
  lines.push("");
  lines.push(`- **Persona:** ${KIND_LABEL[thread.persona] ?? thread.persona}`);
  lines.push(`- **Plain mode:** ${thread.plain_mode ? "on" : "off"}`);
  lines.push(`- **Exported:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const m of messages) {
    if (m.role === "system") continue;
    const speaker = m.role === "user" ? "User" : "Assistant";
    const ts = new Date(m.created_at).toLocaleString();
    const text = (m.parts ?? [])
      .map((p) => (p.type === "text" ? p.text ?? "" : ""))
      .join("\n")
      .trim();
    lines.push(`## ${speaker} — ${ts}`);
    lines.push("");
    if (text) lines.push(text);
    const visible = Array.isArray(m.citations)
      ? (m.citations as any[]).filter((c) => c?.label && c?.kind !== "suggested_knowledge")
      : [];
    if (visible.length) {
      lines.push("");
      lines.push(`**Citations:** ${visible.map((c: any) => c.label).join(" · ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function buildTranscriptHtml(thread: AssistantThread, messages: AssistantMessage[]): Promise<string> {
  const md = buildTranscriptMarkdown(thread, messages);
  const html = await marked.parse(md, { async: true });
  return String(html);
}

export function slugify(s: string): string {
  return (s || "thread")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "thread";
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
