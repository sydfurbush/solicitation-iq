## Problem

In assistant message citations like `[Doc: CB26-RFQ0012 SENTRY publish.1780353503557.pdf§Key Personnel]`, the `§` (section sign) sits flush against `.pdf`, so it reads as a stray special character. It's actually the section separator the system prompt and citation builder use (e.g. `§3.2 p.14`), but when the section label is a heading name like `Key Personnel` and there's no space, it looks like rendering corruption.

Source: `supabase/functions/solicitation-assistant/index.ts` builds excerpt labels as `` `§${section_title}` `` (lines ~193, 224) with no preceding space inside the citation bracket.

## Fix

Display-only cleanup in the markdown normalizer used by the assistant renderer — keeps stored messages and citations intact, only changes presentation.

### `src/features/assistant/components/AssistantMessageBody.tsx` — extend `normalizeAssistantMarkdown`

Inside the existing helper, add a pass that improves spacing around `§` so citations read naturally:

- Insert a thin space before `§` whenever it directly follows a word character (letter/digit/`.`/`)`), e.g. `.pdf§Key` → `.pdf §Key`.
- Insert a space after `§` if it's immediately followed by a capital letter starting a word (e.g. `§Key Personnel` stays as-is since the `§` already prefixes the label cleanly — only the missing leading space is the real issue).

Scope: only applied to assistant message bodies, so user inputs, code blocks, tables, and other surfaces are unaffected. No backend, model-prompt, or data changes.

## Out of scope

- No edits to how citations are emitted by the edge function (keeps the model's citation grammar stable).
- No change to thread titles, exports, or other renderers.

## Verification

1. Reload the AI Assistant thread shown in the screenshot. The citations `…pdf§Key Personnel` and `…03557.pdf§Key Personnel` should now render as `…pdf §Key Personnel` with a visible space before the section sign.
2. Existing citations that already had a space (e.g. `filename §3.2 p.14`) are unchanged — no double spaces.
3. Word/PDF export of the same message still produces correct text (display-time only; not affecting export source).
