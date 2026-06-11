## Problem

Thread titles in the AI Assistant sidebar are showing raw markdown like:

```
```prompt ## Role and C...
```

This happens because `supabase/functions/solicitation-assistant/index.ts` line 822 auto-titles a new thread by taking the first user message verbatim:

```ts
updates.title = message.slice(0, 60).trim() || "New chat";
```

When a user pastes a structured prompt that begins with ` ```prompt `, `## Role`, `**...**`, etc., the markdown syntax becomes the visible title.

## Fix

Two small changes, both presentation-only — no data model changes.

### 1. Server: sanitize new auto-titles (`supabase/functions/solicitation-assistant/index.ts`)

Before slicing to 60 chars, strip markdown noise from the message. A small helper:

- Remove fenced code blocks/backticks (``` ``` ```, `` ` ``)
- Remove leading code-fence language labels (`prompt`, `markdown`, `text`, etc.) at the start
- Strip leading heading hashes (`^#+\s*`)
- Strip bold/italic/strike markers (`**`, `__`, `*`, `_`, `~~`)
- Strip blockquote/list bullets at line start (`>`, `-`, `*`, `1.`)
- Collapse whitespace/newlines to single spaces, trim
- Then `slice(0, 60)` and fall back to `"New chat"` if empty

This fixes all *new* threads going forward.

### 2. Client: sanitize legacy titles at render time (`src/features/assistant/components/ThreadList.tsx`)

Existing rows already have ugly titles stored. Rather than running a DB backfill, apply the same sanitizer in the UI when displaying:

- Add a `formatThreadTitle(raw: string)` helper (same rules as server).
- Use it in the two places titles render in `ThreadList.tsx`:
  - Line 242 — `{t.title || "Untitled"}`
  - Line 524 — `{h.thread_title || "Untitled"}` (history search result)
- Also use it as the seed value for the rename input (line 110) so editing shows a clean string.

The raw DB value is preserved; only display is cleaned.

## Out of scope

- No migration to rewrite existing `assistant_threads.title` rows.
- No changes to message body rendering, model config, or the AI Assistant chat itself.
- No changes to how user messages are stored or echoed.

## Verification

1. Open the AI Assistant on the affected solicitation. Existing thread titles in the sidebar (Pinned / Previous 7 Days) should now read as plain text — no leading ``` ``` ```, no `##`, no `prompt` label.
2. Start a new chat, paste a prompt that begins with ` ```prompt ## Role and Context `, send. Sidebar title should appear as `Role and Context …` (or similar) rather than the raw markdown.
3. Rename a thread — the rename input should pre-fill with the cleaned title.
4. History search results dropdown should also show cleaned thread titles.
