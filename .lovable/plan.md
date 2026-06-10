
# AI Assistant — Feature parity build (Solicitation IQ)

Implementation plan for the items you picked:

**UI/UX**: 1 Personas · 3 Slash commands · 4 Dynamic starters · 5 Memory panel · 6 Preferences panel · 7 Knowledge documents panel · 8 Risk Radar panel · 9 Photo intake · 10 Grouped history · 11 Pinned context chips · 14 Copy rich · 17 Regenerate

**Data**: A Memory · B Preferences · C Thread metadata (persona/mode/pinned) · E Audit log · F Rate limits · I Safety/blocked-topics tracking

> Reading `ce` as **C + E** (thread metadata + audit log). Tell me if you meant something else.

---

## Phase 1 — Schema foundation (data A, B, C, E, F, I)

Single migration. Every new `public` table gets explicit GRANTs and RLS.

### A. `assistant_memory` — durable user facts
```text
id uuid pk, user_id uuid (auth.users), organization_id uuid,
fact text, source text check in ('explicit','auto'),
created_at, updated_at
```
RLS: a user sees and writes their own rows; org admins read org rows for audit.

### B. `assistant_preferences` — one row per user
```text
user_id uuid pk, tone text, voice_replies bool default false,
auto_learn bool default true, blocked_topics text[] default '{}',
default_persona text, plain_mode_default bool default false,
updated_at
```
RLS: user reads/writes their own row.

### C. Add columns to `assistant_threads`
```text
persona text default 'capture_manager',
plain_mode bool default false,
pinned_client_id uuid null references clients(id),
pinned_solicitation_id uuid null references solicitations(id),
pinned_entity jsonb null  -- {kind, id, label} for risks/exhibits/etc.
```

### E. `assistant_audit_log` — every model request
```text
id uuid pk, user_id, organization_id, thread_id, message_id,
solicitation_id, persona, model text, tokens_in int, tokens_out int,
latency_ms int, status text, error text null, created_at
```
RLS: admins read org rows; service role inserts from edge function.

### F. `assistant_rate_limits` — windowed counters
```text
user_id, window_start timestamptz, request_count int,
primary key (user_id, window_start)
```
Plus a SECURITY DEFINER RPC `assistant_check_and_increment(p_user_id, p_limit, p_window_seconds)` returning `{allowed, remaining, reset_at}`.

### I. Safety tracking on messages
Add to `assistant_messages`:
```text
safety_status text default 'ok',   -- ok | redacted | refused
safety_reason text null,
safety_topics text[] default '{}'
```

---

## Phase 2 — Personas, slash commands, plain mode, dynamic starters (UI 1, 3, 4)

### Files
- **New** `src/features/assistant/lib/personas.ts` — `PERSONAS` array, `SLASH_COMMANDS` array, `getPersona`, system-prompt fragment per persona.
- **New** `src/features/assistant/components/PersonaSelector.tsx` — dropdown in chat header.
- **New** `src/features/assistant/components/SlashCommandPopover.tsx` — type `/` to open.
- **Edit** `AssistantChat.tsx` — header row with persona + plain-mode toggle, slash popover in composer, sends `{persona, plainMode}` along with the message.
- **Edit** `useAssistantThreads.ts` — `useUpdateThread` accepts `persona`, `plain_mode`; new `useUpdateThreadPin`.
- **New edge function** `generate-assistant-starters` — given persona + solicitation context, returns 4 dynamic starters; cached client-side via React Query (5 min stale time).
- **Edit** `supabase/functions/solicitation-assistant/index.ts` — accept `persona`, `plainMode`; pick system-prompt fragment; process slash commands server-side (`/remember`, `/forget`, `/summarize`, `/cite`, `/clear-context`).

### Personas (initial set, editable later)
Capture Manager · Proposal Writer · Compliance Reviewer · Pricing Analyst · Executive Summary · Plain English

### Slash commands
`/remember <fact>` · `/forget <fact-id-or-text>` · `/summarize` · `/cite <topic>` · `/risks` · `/requirements` · `/clear-context`

---

## Phase 3 — Memory & Preferences panels (UI 5, 6 + data A, B)

### Files
- **New** `src/features/assistant/hooks/useAssistantMemory.ts` — list/add/delete facts.
- **New** `src/features/assistant/hooks/useAssistantPreferences.ts` — get/update prefs.
- **New** `src/features/assistant/components/MemoryPanel.tsx` — list + add/delete; surfaced from a "Memory" button in the chat header (Sheet on right side).
- **New** `src/features/assistant/components/PreferencesPanel.tsx` — Sheet with tone, voice-replies, auto-learn, blocked topics, default persona, plain-mode default.
- **Edit** `solicitation-assistant/index.ts` — inject memory facts and preference flags into the system prompt; if `auto_learn=true`, run a small post-response classifier to capture new explicit preference statements and insert into `assistant_memory` with `source='auto'`.

---

## Phase 4 — Knowledge documents panel (UI 7)

The DB already has `client_knowledge_documents` and `client_knowledge_chunks` with embeddings + `match_client_knowledge` RPC. They are not wired into the assistant.

### Files
- **New** `src/features/assistant/components/KnowledgePanel.tsx` — Sheet showing the active client's knowledge library with ready/processing status, last indexed date, and an "Add document" affordance that reuses the existing `ingest-client-knowledge` function.
- **Edit** `solicitation-assistant/index.ts`:
  - Resolve `client_id` from the solicitation.
  - In `retrieveDocumentExcerpts`, run `match_client_knowledge` in parallel with the existing FTS + `match_document_chunks` calls.
  - Merge into the RRF pool; tag client-knowledge results with `kind: 'client_knowledge'` so the chat UI can render a distinct badge style.

No new tables.

---

## Phase 5 — Risk Radar panel (UI 8)

### Files
- **New** `src/features/assistant/components/RiskRadarPanel.tsx` — Sheet listing this solicitation's `risks` (top severity first) with quick "Insert into chat" and "Ask about this risk" buttons that prefill the composer with `/cite <risk title>`.
- **Edit** `AssistantChat.tsx` — header button to open the panel.

No new tables; reads existing `risks`.

---

## Phase 6 — Photo intake (UI 9)

### Files
- **Storage**: add `assistant-attachments` bucket (private). Add `assistant_attachments.thread_id, message_id, storage_path, mime_type, kind ('photo'|'doc'), created_by` if columns missing — table already exists per the table list; verify columns and add only what's missing.
- **New** `src/features/assistant/components/PhotoIntakeButton.tsx` — uses `<input type="file" accept="image/*" capture="environment">` on mobile; uploads to bucket; previews thumbnail in composer.
- **Edit** `useSendAssistantMessage` — accept optional `attachmentIds`.
- **Edit** `solicitation-assistant/index.ts` — when attachments are present, build signed URLs and add them as image parts in the model call (Gemini multimodal). Persist attachment references on the user message row.

---

## Phase 7 — Grouped history + pinned context chips (UI 10, 11)

### Files
- **Rewrite** `ThreadList.tsx`:
  - Group by Today / Yesterday / Previous 7 days / Previous 30 days / Older.
  - Pinned threads stay in their own top section.
  - Each row shows persona icon + pinned-entity chip if any.
- **New** `src/features/assistant/components/PinnedContextChips.tsx` — chips above the composer showing pinned client / pinned prior solicitation / pinned entity. Click ✕ to remove. Click "+" to open a popover that searches clients, prior solicitations, risks, exhibits.
- **Edit** `solicitation-assistant/index.ts` — when thread has `pinned_*`, hydrate them and prepend to the system context as `# Pinned context`.

---

## Phase 8 — Copy rich + Regenerate + safety + audit + rate limit (UI 14, 17 + data E, F, I)

### Files
- **New** `src/features/assistant/lib/copyRich.ts` — copies markdown rendered to HTML so paste into Word/Outlook preserves formatting; falls back to plain text.
- **Edit** `MessageRow` in `AssistantChat.tsx`:
  - On hover, show action row: Copy, Copy rich, Regenerate, Speak (placeholder for future TTS).
  - Regenerate calls a new server action `regenerate-assistant-message` which deletes the last assistant message and re-runs with the same prior turns.
- **Edit** `solicitation-assistant/index.ts`:
  - **Rate limit** — call `assistant_check_and_increment`; return 429 with structured error on deny. Surface in UI as toast.
  - **Safety** — before model call, scan user message against `assistant_preferences.blocked_topics`; if match, write a message with `safety_status='refused'` and short reason; do not call the model. After model response, optional lightweight pass for redaction; mark `safety_status='redacted'` if applied.
  - **Audit** — on every request, insert one row into `assistant_audit_log` with timings, tokens (from response usage), status, and persona.

---

## Phase 9 — Wire everything into the page

### Files
- **Edit** `src/pages/SolicitationAssistant.tsx`:
  - Left rail: grouped `ThreadList` (Phase 7).
  - Header bar: persona selector · plain-mode switch · pinned-context chips · buttons for Memory / Preferences / Knowledge / Risks panels (each opens a Sheet).
  - Center: `AssistantChat` with composer enhancements (slash popover, photo intake, attachments, message actions).
- Keep route shape `/solicitations/:id?tab=assistant&thread=:threadId` — no routing changes.

---

## Out of scope (kept from your earlier excluded items)

- #2 Plain-language mode toggle → *included implicitly with personas (Phase 2 covers `plain_mode`).* If you wanted it as a separate visible toggle, it already ships in the Phase 2 header.
- #12 Action confirm cards · #13 Voice replies (TTS) · #15 Capability elevation · #16 Mobile sheet nav · #18 Branding
- Data tables D (ai_actions), G (separate ai_knowledge — using existing `client_knowledge_*` instead), H (starters cache table — using React Query cache instead), J (access policy table)

---

## Validation plan

1. After Phase 1: run linter, confirm RLS + GRANTs on each new table; quick policy smoke test.
2. After Phase 2: switch persona mid-thread, send a `/remember` and a regular message, confirm thread row reflects persona/plain_mode and starters refresh on persona change.
3. After Phase 3: add a memory fact, ask a question that should leverage it, confirm fact appears in `# Memory` block (verifiable in audit row context size).
4. After Phase 4: ask about a topic only present in a client-knowledge doc, confirm citation badge with `client_knowledge` styling.
5. After Phase 6: upload a photo of a page; ask the model to describe it.
6. After Phase 7: create multiple threads spanning days; verify groups + pinned section; pin a client and verify chip + system-prompt injection.
7. After Phase 8: trigger blocked topic + rate-limit error paths; check audit log rows.

## Estimated work order

Phases 1 → 2 → 8 (safety/audit/rate limit deserve to land early) → 3 → 7 → 4 → 5 → 6 → 9 (final wiring). Phase 9 is mostly cosmetic glue once others are in.

Reply "go" to start with Phase 1, or tell me to merge/skip/reorder phases.
