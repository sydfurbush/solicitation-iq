import { supabase } from "@/integrations/supabase/client";

export interface RunReportInput {
  runId: string;
  solicitationId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  insertedCount: number;
  currentStep: string | null;
  errorMessage: string | null;
  failedDocNames: string[];
  crossDocFailed: boolean;
  parentRunId: string | null;
  solicitationTitle?: string | null;
}

const escape = (s: unknown): string => {
  const str = s == null ? "" : String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString() : "—";

async function fetchRunQuestions(input: RunReportInput) {
  const upper = input.completedAt ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("strategic_questions")
    .select(
      "id, question_text, category, recommendation, priority, question_rationale, source_citation, source_quote, strategic_advantage_notes, potential_answer_insight, created_at"
    )
    .eq("solicitation_id", input.solicitationId)
    .eq("is_ai_generated", true)
    .gte("created_at", input.startedAt)
    .lte("created_at", upper)
    .order("priority", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function buildHtml(input: RunReportInput, questions: Awaited<ReturnType<typeof fetchRunQuestions>>): string {
  const rows = questions
    .map(
      (q) => `
    <article class="q">
      <header>
        <span class="cat">${escape(q.category)}</span>
        <span class="rec rec-${escape(q.recommendation ?? "monitor")}">${escape(q.recommendation ?? "monitor")}</span>
        <span class="pri">Priority ${escape(q.priority ?? "—")}</span>
      </header>
      <h3>${escape(q.question_text)}</h3>
      ${q.question_rationale ? `<p><strong>Rationale:</strong> ${escape(q.question_rationale)}</p>` : ""}
      ${q.strategic_advantage_notes ? `<p><strong>Strategic advantage:</strong> ${escape(q.strategic_advantage_notes)}</p>` : ""}
      ${q.potential_answer_insight ? `<p><strong>Potential answer insight:</strong> ${escape(q.potential_answer_insight)}</p>` : ""}
      ${q.source_citation ? `<p class="src"><strong>Source:</strong> ${escape(q.source_citation)}</p>` : ""}
      ${q.source_quote ? `<blockquote>${escape(q.source_quote)}</blockquote>` : ""}
    </article>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Question generation run · ${escape(input.runId.slice(0, 8))}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #fff; line-height: 1.5; }
  .wrap { max-width: 880px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  h3 { font-size: 15px; margin: 6px 0; font-weight: 600; }
  .meta { color: #64748b; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0 8px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  .stat .v { font-size: 18px; font-weight: 600; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .b-running { background: #dbeafe; color: #1d4ed8; }
  .b-completed { background: #dcfce7; color: #166534; }
  .b-partial { background: #fef3c7; color: #92400e; }
  .b-failed { background: #fee2e2; color: #991b1b; }
  .q { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .q header { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px; margin-bottom: 6px; }
  .cat, .rec, .pri { padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
  .rec-ask { background: #dcfce7; color: #166534; }
  .rec-do_not_ask { background: #fee2e2; color: #991b1b; }
  .rec-monitor { background: #fef3c7; color: #92400e; }
  .src { color: #475569; font-size: 13px; }
  blockquote { margin: 6px 0 0; padding: 6px 12px; border-left: 3px solid #cbd5e1; color: #475569; font-style: italic; font-size: 13px; }
  .err { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
  .failed-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .chip { background: #f1f5f9; padding: 2px 8px; border-radius: 999px; font-size: 12px; color: #334155; }
  .empty { text-align: center; padding: 40px; color: #94a3b8; font-style: italic; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .actions { margin-bottom: 16px; }
  .btn { display: inline-block; background: #0f172a; color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 13px; text-decoration: none; cursor: pointer; border: none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="actions noprint">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <h1>Question Generation Run Report</h1>
  <div class="meta">
    Run <code>${escape(input.runId)}</code>
    ${input.solicitationTitle ? ` · ${escape(input.solicitationTitle)}` : ""}
  </div>

  <div class="grid">
    <div class="stat"><div class="l">Status</div><div class="v"><span class="badge b-${escape(input.status)}">${escape(input.status)}</span></div></div>
    <div class="stat"><div class="l">Inserted</div><div class="v">${escape(input.insertedCount)}</div></div>
    <div class="stat"><div class="l">Batches</div><div class="v">${escape(input.completedBatches)} / ${escape(input.totalBatches)}${input.failedBatches > 0 ? ` <span style="color:#991b1b;font-size:13px">(${escape(input.failedBatches)} failed)</span>` : ""}</div></div>
    <div class="stat"><div class="l">Duration</div><div class="v" style="font-size:14px">${escape(formatDate(input.startedAt))}<br/><span style="color:#64748b;font-weight:400">→ ${escape(formatDate(input.completedAt))}</span></div></div>
  </div>

  ${input.parentRunId ? `<p class="meta">Retry of run <code>${escape(input.parentRunId)}</code></p>` : ""}

  ${
    input.failedDocNames.length > 0 || input.crossDocFailed
      ? `<h2>Failed batches</h2>
         <div class="failed-list">
           ${input.failedDocNames.map((n) => `<span class="chip">${escape(n)}</span>`).join("")}
           ${input.crossDocFailed ? `<span class="chip">cross-document pass</span>` : ""}
         </div>`
      : ""
  }

  ${input.errorMessage ? `<h2>Error</h2><div class="err">${escape(input.errorMessage)}</div>` : ""}

  <h2>Questions added (${questions.length})</h2>
  ${questions.length === 0 ? `<div class="empty">No questions were inserted in this run window.</div>` : rows}
</div>
</body>
</html>`;
}

export async function downloadRunReport(input: RunReportInput): Promise<number> {
  const questions = await fetchRunQuestions(input);
  const html = buildHtml(input, questions);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `question-run-${input.runId.slice(0, 8)}-${new Date(input.startedAt).toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return questions.length;
}
