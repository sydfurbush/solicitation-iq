# AI Assistant Restructure

Model the assistant after the UtilityCRM Shell reference: a dedicated left rail for thread management and quick actions, a centered persona switcher above the message area, and folder/tag/pin organization for threads.

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ AI Assistant header  ........................  Exit assist  │
├──────────────┬──────────────────────────────────────────────┤
│ + New Chat   │            [ Persona ▾ ]    (centered)       │
│              │                                              │
│ 🔎 Search    │   ── messages ──                             │
│              │                                              │
│ Knowledge    │                                              │
│ Memory       │                                              │
│ Preferences  │                                              │
│ ─────        │                                              │
│ 📁 New folder│                                              │
│ 🏷 Tags  🗑   │                                              │
│ ─────        │                                              │
│ 📌 PINNED (n)│                                              │
│   • thread   │                                              │
│ UNFILED      │                                              │
│ Previous 7d  │                                              │
│   • thread   │                                              │
│ Older        │                                              │
│   • thread   │                                              │
├──────────────┴──────────────────────────────────────────────┤
│                Composer (textarea + mic + photo + send)     │
└─────────────────────────────────────────────────────────────┘
```

## Changes

### Left sidebar (new component `AssistantSidebar.tsx`)
- **+ New Chat** button (primary, top).
- Search input for titles/messages (already exists — relocate).
- Quick-action buttons stacked: **Knowledge**, **Memory**, **Preferences**. Each opens its existing panel/sheet. Removes them from the header.
- Folder controls row: **+ New folder**, **Tags**, **Trash**.
- **Pinned** section (collapsible) listing pinned threads with a pin icon toggle per row.
- **Unfiled** section grouped by recency: *Previous 7 days*, *Older*.
- Per-thread row: title, timestamp, pin toggle, menu (rename, move to folder, tag, delete).

### Message area
- **Persona selector** moves out of the header to a centered dropdown trigger directly above the first message (matches reference image 2 styling). Uses existing `PersonaSelector` component.
- Header keeps: title, Export, Analytics, Exit assistant.

### Header simplification
- Remove Knowledge / Memory / Preferences buttons (now in sidebar).
- Keep Export, Analytics.

## Data model (folders, tags, pinning)

Add to `assistant_threads`:
- `pinned boolean default false`
- `folder_id uuid null` → references new `assistant_folders` table
- `tags text[] default '{}'`

New tables:
- `assistant_folders` — `id, user_id, organization_id, name, color, created_at` with RLS scoped to `auth.uid()`.
- `assistant_tags` — `id, user_id, organization_id, name, color` (optional; or just use `tags text[]` on threads).
- Soft delete: add `deleted_at timestamptz null` to `assistant_threads` for the Trash view.

GRANTs on new tables: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`; `ALL` to `service_role`. RLS policies scope by `user_id = auth.uid()`.

## Hooks
- Extend `useAssistantThreads` to return threads grouped by `{ pinned, byFolder, unfiled, trash }` and to expose mutations: `pinThread`, `moveToFolder`, `addTag`, `softDeleteThread`, `restoreThread`.
- New `useAssistantFolders` hook (list/create/rename/delete).

## Files
- New: `src/features/assistant/components/AssistantSidebar.tsx`, `AssistantThreadList.tsx`, `AssistantFolderDialog.tsx`, `AssistantTrashPanel.tsx`, `hooks/useAssistantFolders.ts`.
- Edit: `AssistantChat.tsx` (remove header buttons, move Persona above messages), `useAssistantThreads.ts` (new mutations + grouped query), `SolicitationAssistant.tsx` page (compose sidebar + chat side-by-side).
- Migration: add columns + new tables + RLS + GRANTs.

## Out of scope (this pass)
- Morning Brief and Risk Radar shortcuts (you previously asked to keep Risk Radar gated; not adding here).
- Cross-solicitation thread roll-up.
