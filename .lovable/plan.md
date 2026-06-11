# Streamlined Thread List

## Goal
Give chat titles more horizontal space by collapsing the per-row action icons (Pin, Move-to-folder, Share, Trash) into a single "…" overflow menu, and add a **Rename** action — matching the reference screenshot.

## Changes (only `src/features/assistant/components/ThreadList.tsx`)

### 1. Row layout
- Remove the 4-icon hover strip on the right.
- Replace with a single `MoreHorizontal` (…) icon button, visible on hover/focus and always visible for the active row.
- Keep a small inline **pin indicator** (📌) on the left of pinned rows so users still see pin state at a glance — the action itself moves into the menu.
- Result: title gets ~80px more width, fewer truncations like "provide an exampl…".

### 2. "…" overflow menu (DropdownMenu)
Active (non-trash) row items, in order:
1. **Pin to top** / **Unpin** (toggles)
2. **Rename** ← new
3. **Move to folder ▸** (submenu listing folders + "Unfiled")
4. **Copy share link**
5. ─ separator ─
6. **Move to Trash** (destructive)

Trash row items:
1. **Restore**
2. **Delete permanently** (destructive)

### 3. Rename flow
- Inline rename: clicking **Rename** swaps the title text with an `<Input>` focused and selected. Enter or blur saves via `useUpdateThread({ patch: { title } })`; Escape cancels. Empty title reverts.
- No new dialog needed — keeps the list compact and feels like the reference UI.

### 4. Visual polish
- Title line: bump from `text-sm` truncate to allow up to 2 lines with `line-clamp-2` (optional — recommendation A) OR keep single-line truncate with the extra width (recommendation B, matches reference more closely).
- Timestamp stays as the small muted line beneath.
- Active row keeps `bg-muted`; "…" button uses `opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100` so it stays visible while the menu is open.

## Recommendations / Options for you to choose

**A. Title wrapping**
- A1 *(recommended)*: Single-line truncate — cleanest, matches your reference screenshot.
- A2: Allow 2-line wrap (`line-clamp-2`) — fewer truncations, taller rows.

**B. Pin visibility**
- B1 *(recommended)*: Small pin glyph on the left of pinned rows + Pin/Unpin inside the "…" menu.
- B2: No inline glyph — rely on the dedicated "Pinned" section header only.

**C. Rename UX**
- C1 *(recommended)*: Inline edit in place (described above).
- C2: Modal dialog (consistent with folder rename dialog already in the file).

Default plan uses **A1 + B1 + C1**. Tell me if you'd prefer different options and I'll adjust before implementation.

## Out of scope
No changes to folders sidebar, search, quick actions (Knowledge/Memory/Preferences), trash behavior, or backend hooks.
