# Fix unformatted assistant tables

The "Top Opportunities" output is a GitHub-Flavored-Markdown table, but `AssistantChat.tsx` renders assistant messages with `<ReactMarkdown>` without the `remark-gfm` plugin. Without GFM, ReactMarkdown treats `|` as plain text and flows everything as one paragraph — exactly what the screenshot shows. `remark-gfm` is already in `package.json`.

## Changes

**`src/features/assistant/components/AssistantChat.tsx`**
1. Import `remarkGfm` from `remark-gfm`.
2. Pass `remarkPlugins={[remarkGfm]}` to the assistant `<ReactMarkdown>` (line 460). This enables tables, task lists, strikethrough, and autolinks.
3. Normalize single-line tables before rendering: if the text contains a table-looking run where rows are separated only by `| |` (no newline), insert a newline between rows so GFM can parse it. Cheap regex on the message text inside the assistant branch; user messages are untouched.
4. Add table styling so rows/headers/borders look right inside the existing `prose prose-sm` container — add a `not-prose`-free wrapper class and a small CSS rule (Tailwind `[&_table]:...` arbitrary variants) for borders, header background, cell padding, and horizontal scroll on overflow.

No other files, no backend, no schema changes.

## Out of scope

- Changing the assistant's prompt to prefer tables/markdown.
- Restyling user message bubbles.
- Export/Copy formatting (Markdown export already preserves tables).
