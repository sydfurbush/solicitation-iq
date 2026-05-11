## Add counts to question filter chips

Show a count next to each filter option in `QuestionsFilters.tsx` so users can see how many questions match before clicking.

### Scope
- Category chips (Clarification, Strategic, …)
- Recommendation chips (Submit, Hold, Monitor, Internal)
- Priority chips (High, Medium, Low)
- Submitted dropdown options (All / Submitted / Not submitted)
- Source dropdown options (All / AI / Manual)

### Count semantics
Counts reflect the **full question set for the solicitation** (not the currently filtered set), so users always see total availability per option. The "All" option shows the total count.

Example: `Clarification (11)`, `High (42)`, `Submitted only (7)`.

### Implementation (frontend only)

1. **`SolicitationQuestions.tsx`** — compute a `counts` object from `allQuestions` (already loaded) with tallies per category, recommendation, priority, submitted, and source. Pass to `<QuestionsFilters counts={counts} … />`.

2. **`QuestionsFilters.tsx`**
   - Accept new optional `counts` prop.
   - `ChipRow` renders `{label} {count}` with the count in a muted span (e.g. `text-muted-foreground ml-1`).
   - Append counts to the Select dropdown items for Submitted and Source.
   - Chips with count `0` render dimmed (reduced opacity) but stay clickable.

3. No changes to filtering logic, hooks, or backend.

### Files touched
- `src/features/questions/components/QuestionsFilters.tsx`
- `src/pages/SolicitationQuestions.tsx`
