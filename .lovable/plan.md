# Plan: Hide Risk Radar & Add Citation Toggle

## 1. Risk Radar — never auto-show

The current `messages.length > 0` gate still surfaces the radar as soon as a thread has any history, which the screenshot shows is unwanted. Change behavior so Risk Radar is fully opt-in.

**Changes in `src/features/assistant/components/AssistantChat.tsx`:**
- Remove the unconditional `<RiskRadar />` block (lines 293–296).
- Add a small "Risk Radar" toggle button in the existing assistant toolbar (next to Knowledge / Memory / Analytics icons) using the `Radar` lucide icon.
- Track `showRadar` in local component state, default `false`. Persist per-thread in `localStorage` (`assistant_show_radar_v1:<threadId>`) so toggling it on for a thread doesn't reset on remount.
- Render `<RiskRadar />` only when `showRadar === true`.
- The existing `onDiscuss` action remains unchanged.

Result: New chats and existing chats both load with no radar. User clicks the new toolbar button to reveal it; clicks again to hide.

## 2. Per-message Citations Toggle

Currently each assistant message renders its citations row inline by default. Add a user-controlled toggle so citations stay collapsed unless requested.

**Changes in `AssistantChat.tsx` (`MessageRow` component, around lines 477–500):**
- Wrap the citations block in a collapsible region.
- Replace the always-visible citation badges with a small footer control beneath the message body:
  - A ghost button labeled `Show citations (N)` / `Hide citations (N)` with a chevron icon.
  - Only render the button when `visible.length > 0` (matches existing filter that excludes `suggested_action` / `suggested_knowledge`).
- Track `expanded` via `useState(false)` per `MessageRow` so each message has its own toggle.
- Persist the user's preferred default in `localStorage` (`assistant_citations_default_v1`, values `"open" | "closed"`, default `"closed"`). The first toggle in a session updates the default so subsequent messages honor it.
- The existing `InlineActionButtons` and the `citations` prop passed to `MessageBubble` (used for inline `[n]` reference numbering inside the message body) are not affected — only the badge list under the bubble is gated.

## Out of scope
- No edge function / backend changes.
- No changes to `RiskRadar.tsx` internals.
- No changes to `SuggestedKnowledgeBanner` or inline action buttons.

## Files touched
- `src/features/assistant/components/AssistantChat.tsx` (only)
