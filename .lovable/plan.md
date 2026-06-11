## Fix Persona Selector Sizing

The persona dropdown trigger above the chat is too narrow (180px) and short (h-8), causing the description text ("High-level summaries for leadership.") to wrap and look cramped.

### Change

In `src/features/assistant/components/PersonaSelector.tsx`:

- Increase trigger width from `w-[180px]` to `w-[300px]` (auto-fits longest persona name + description).
- Increase height from `h-8` to `h-auto` with vertical padding so the two-line label (name + description) sits comfortably.
- Render the selected persona as a stacked label (name on top, description below) inside the trigger via a custom display, instead of relying on default `SelectValue` truncation.
- Add `whitespace-nowrap` on the name and `truncate` fallback on the description so longer personas still degrade gracefully.

No other files touched. Purely presentational.