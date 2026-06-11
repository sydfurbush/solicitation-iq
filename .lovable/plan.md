## Hide Risk Radar on empty chats

The Risk Radar currently renders at the top of every chat — including brand-new conversations where there's nothing else on screen, which makes it look like a forced selection instead of an in-conversation aid.

### Change

In `src/features/assistant/components/AssistantChat.tsx`, only mount `<RiskRadar />` when the thread already has at least one message. The empty state (Sparkle icon + "AI Assistant" + Suggested Starters) will be the only thing shown on a new chat.

```tsx
{messages.length > 0 && (
  <RiskRadar solicitationId={solicitationId} onDiscuss={(p) => submit(p)} compact={compact} />
)}
```

Once the user sends their first message, the Risk Radar will appear above the message list as before.

### Out of scope

- No changes to RiskRadar's internal behavior, collapsed/expanded state, or the "Discuss" action.
- No changes to other empty-state surfaces (Suggested Knowledge banner already only renders when there's an assistant reply).
