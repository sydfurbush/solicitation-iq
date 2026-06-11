## Goal
Make org charts in assistant responses render as readable structured charts instead of cramped ASCII/code-block text like the screenshot.

## Plan
1. **Add org-chart detection in assistant markdown rendering**
   - Detect code blocks or paragraphs that look like ASCII org charts: box-drawing/table-like content with vertical pipes, dashed borders, connector lines, or role hierarchy labels.
   - Keep normal code blocks unchanged so technical snippets still render as code.

2. **Render detected org charts with a dedicated visual component**
   - Convert the org chart text into a scrollable hierarchy layout with role cards, reporting lines, and consistent spacing.
   - Use semantic design tokens for borders, muted surfaces, foreground text, and accents.
   - Preserve the original content if parsing is imperfect by showing a clean monospace fallback inside a better scroll container.

3. **Improve fallback formatting for ASCII diagrams**
   - Add targeted styling for diagram-like code blocks: larger readable line height, stable monospace sizing, wider min-width, horizontal scrolling, and no clipped content.
   - Avoid applying these changes to all markdown code snippets.

4. **Validate against the screenshot case**
   - Confirm the assistant message no longer appears as a cramped gray block.
   - Confirm horizontal scrolling works on smaller screens and the message box remains aligned with existing chat styling.

## Technical details
- Primary file: `src/features/assistant/components/AssistantChat.tsx`.
- Add a small `OrgChartBlock` helper/component near the existing `MessageRow` markdown renderer.
- Override the `ReactMarkdown` `code` component to route detected org-chart code blocks to `OrgChartBlock`.
- Keep `remark-gfm` and existing table/task-list styling intact.