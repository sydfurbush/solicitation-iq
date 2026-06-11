# Phase 8 — History Search & Analytics Dashboard

Cross-thread message search inside the assistant sidebar plus an org-admin analytics dashboard sourced from `assistant_audit_log`.

## New files

- `src/features/assistant/hooks/useAssistantHistorySearch.ts` — Searches `assistant_messages.parts` text across all threads in the current solicitation (client-side filter over the 500 most-recent messages, snippet ±80 chars).
- `src/features/assistant/hooks/useAssistantAnalytics.ts` — Aggregates `assistant_audit_log` for the last N days: total requests, error rate, avg latency, tokens, per-day series, per-persona, top users.
- `src/features/assistant/components/AnalyticsDashboard.tsx` — `Sheet` with stat tiles + Recharts line/bar charts. 7 / 30 / 90-day window selector.
- `src/features/assistant/components/AssistantAnalyticsButton.tsx` — Header icon button visible only to org `owner` / `admin`; opens the dashboard.

## Edits

- `src/features/assistant/components/ThreadList.tsx` — When the search box has ≥2 chars, swap the list to message-content hits showing thread title + snippet + relative time + role icon. Clicking a hit calls `onSelect(threadId, messageId)`.
- `src/pages/SolicitationAssistant.tsx` — `setThread` now writes an optional `?msg=<id>` query param for jump-to-message.
- `src/features/assistant/components/AssistantChat.tsx` — Mounts `<AssistantAnalyticsButton />` in the header. Reads `?msg` and scrolls the matching `#assistant-msg-<id>` row into view with a 2s primary-ring highlight, then clears the param. `MessageRow` now renders the DOM id.

## Validation

- Typing "incumbent" in the sidebar search shows messages across multiple threads; clicking one jumps to the right thread and scrolls the message into view with a brief highlight.
- An org admin sees the chart icon in the header; non-admins do not. Opening it shows totals, the per-day line chart, persona breakdown, and a top-users list, all scoped to the current org by RLS.
