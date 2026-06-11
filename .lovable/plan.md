## Plan

1. **Add a new org-chart rendering option**
   - Detect ASCII org charts and hierarchy-style code blocks in assistant responses, not just fenced `mermaid` blocks.
   - Route those detected blocks to a dedicated visual renderer instead of showing cramped monospace text.

2. **Build a readable fallback org chart view**
   - Create a compact visual hierarchy layout with role cards, reporting lines, consistent gaps, and horizontal scrolling for wide charts.
   - Preserve all original chart text in a details/fallback area if parsing is imperfect, so no information is lost.

3. **Keep Mermaid support but make it more robust**
   - Improve the Mermaid container sizing so generated diagrams fit the assistant message area and scroll cleanly on small screens.
   - Keep normal code blocks unchanged.

4. **Update assistant diagram instructions**
   - Tighten the backend prompt so future org charts are returned as valid Mermaid flowcharts.
   - Add a fallback instruction to use a simple role hierarchy list if Mermaid is not appropriate, never ASCII box art.

## Technical details

- Main frontend changes will be in `src/features/assistant/components/AssistantChat.tsx` and the existing `MermaidBlock` component.
- I’ll add a small `OrgChartBlock` helper/component to render detected ASCII org chart content as a structured visual chart.
- Existing GFM table and task-list formatting will stay intact.