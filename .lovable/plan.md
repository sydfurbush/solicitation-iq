## Problem

In Phase 5 → Drafting, the AI returns Markdown (headings like `##`, bold `**…**`, lists, separators), but the editor pane is a plain `<Textarea>` showing raw syntax (`## 1.1 SF 1449…`, `**Solicitation Number:**`). The screenshot shows this — markdown is never rendered, so the draft looks unformatted.

The data is actually fine (it's well-structured Markdown stored in `proposal_drafts.content_json.markdown`). The issue is purely in the **presentation** layer of `src/features/drafting/components/DraftingWorkspace.tsx`.

## Recommendation

Add an **Edit / Preview** toggle to the section editor:

- **Edit mode** (default after AI Draft, or when user clicks Edit): the existing `<Textarea>` so writers can keep editing raw Markdown and citations like `[Req-X]`.
- **Preview mode**: render the same markdown with `react-markdown` + `remark-gfm` inside a styled `prose` container so headings, bold, lists, tables, and `---` separators look like the final proposal.

Auto-switch to **Preview** right after a successful AI Draft / AI Polish run, so the user immediately sees the formatted result (matches their expectation in the screenshot). They can click Edit to tweak.

## Changes

1. **`package.json`** — add `react-markdown` and `remark-gfm` (and `@tailwindcss/typography` if not already present, for `prose` classes).
2. **`tailwind.config.ts`** — register `@tailwindcss/typography` plugin if missing.
3. **`src/features/drafting/components/DraftingWorkspace.tsx`**
   - Add local `mode: "edit" | "preview"` state.
   - Add a small segmented toggle in the section header (next to Save / AI Draft).
   - Render `<Textarea>` when `mode === "edit"`; render `<ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none p-4 overflow-auto">{text}</ReactMarkdown>` when `mode === "preview"`.
   - In the `onAiDraft` and `onPolish` success paths, set `mode = "preview"`.
   - Highlight cited `[Req-X]` tokens in preview by post-processing into `<code>` (optional polish — keep the same citation tokens visible).

## Out of scope

- No edge-function changes — AI output already returns clean Markdown.
- No schema changes — content is still stored as Markdown in `content_json.markdown`.
- Compile / export pipeline already consumes Markdown; unaffected.

## Technical notes

- Use `prose-sm dark:prose-invert max-w-none` to inherit theme.
- Keep monospace font only for Edit mode.
- The preview container should be `flex-1 overflow-auto` to match the current Textarea sizing.
