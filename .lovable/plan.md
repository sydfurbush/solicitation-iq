# AI Assistant: Full-Bleed Mode with Collapse

When the user activates the AI Assistant (`?tab=assistant`), the assistant should take over the full Solicitation content area — hiding the breadcrumb/header, phase strip, and workflow tab bar — and expose a collapse control that returns the user to the previous workspace tab.

## Behavior

- Entering `tab=assistant` switches `SolicitationDetail` into a "focused assistant" layout: only the `SolicitationAssistant` component renders inside the page content region (sidebar + top app chrome remain untouched — they live in `RootLayout`).
- A compact header bar sits above the assistant with:
  - Solicitation title + code badge (condensed, single line) on the left for context.
  - A **Collapse** button (chevron-left + "Exit assistant" label, icon-only on small widths) on the right.
- Clicking Collapse navigates back to the previously active tab. We track the "last non-assistant tab" in a ref when `tab` changes; if none, fall back to `phase-1`.
- The assistant chat fills the remaining height (`h-[calc(100vh-...)]` adjusted so it uses the full available area, not the current `-260px` budget).
- `AssistantLauncher` (floating button) is hidden while `tab === "assistant"` to avoid duplication.
- All other tabs (`phase-1`…`phase-5`, writing-queue, reports, comparison, activity) keep their current layout untouched.

## Technical Changes

- `src/pages/SolicitationDetail.tsx`
  - Add `useRef<string | null>` (or state) `previousTabRef` updated whenever `tab` changes and is not `"assistant"`.
  - Early-return a dedicated full-bleed branch when `tab === "assistant"`: render a flex column that contains the new `AssistantHeaderBar` and `<SolicitationAssistant solicitationId={s.id} />`, skipping the normal header/phase/workflow JSX.
  - Hide `<AssistantLauncher />` when on the assistant tab.
  - Collapse handler: `setSearchParams` with `tab` set to `previousTabRef.current ?? "phase-1"` and the `thread` param removed.
- `src/pages/SolicitationAssistant.tsx`
  - Remove the fixed `h-[calc(100vh-260px)]` budget and switch the root to `h-full` so it stretches to its parent. Keep the 260px thread list column.
- New small component (inline in `SolicitationDetail.tsx` or `src/features/assistant/components/AssistantHeaderBar.tsx`)
  - Renders title/code + Collapse button (`ChevronLeft` icon, `variant="ghost"`).
  - Receives `onCollapse`, `title`, `code` props.

## Out of Scope

- No changes to thread routing, persistence, voice input, or chat composer.
- No keyboard shortcut for collapse in this pass (can add later if desired).
