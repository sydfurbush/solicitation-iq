# Solicitation Intelligence Analyzer — Foundation Plan

Scaffold the front-end shell only. No backend wiring. Most tooling (Vite, React, TS strict, Tailwind, shadcn/ui, Lucide, React Router, TanStack Query) is already present in this Lovable project, so this plan focuses on what actually needs to be added or changed.

## 1. Dependencies

Already installed: React 18, Vite, TS, Tailwind, all requested shadcn/ui components, lucide-react, react-router-dom, @tanstack/react-query, react-hook-form, zod, date-fns.

Add:
- `zustand` (client state)

## 2. Folder structure

Create the directory tree under `/src` exactly as requested:
- `components/layout`, `components/shared`
- `features/{auth,organizations,clients,solicitations,documents,analysis,reports}`
- `lib/{supabase,utils,validators}` (keep existing `lib/utils.ts`)
- `types`, `stores`, plus new `pages` files

Each empty folder gets a `.gitkeep` so the structure is visible.

## 3. Theme tokens (`src/index.css` + `tailwind.config.ts`)

Convert brand colors to HSL semantic tokens (no raw hex in components):
- `--primary` ← #2563eb
- `--secondary` ← #0f172a
- `--accent` ← #10b981
- `--warning` ← #f59e0b (new token)
- `--destructive` ← #ef4444
- Sidebar tokens tuned for a dark sidebar (slate-900 base, light foreground, primary accents)
- Light content area stays on existing `--background` / `--foreground`

Register `warning` in `tailwind.config.ts` colors.

## 4. Root layout (`src/components/layout/RootLayout.tsx`)

Use shadcn `Sidebar` with `collapsible="icon"` for the 280px / 64px behavior, wrapped in `SidebarProvider`.

```text
┌─────────────────────────────────────────────┐
│ Sidebar (dark)   │ Header (trigger + avatar)│
│  Logo            ├──────────────────────────┤
│  Nav items       │                          │
│   - Dashboard    │  <Outlet/> in            │
│   - Clients      │  max-w-7xl container     │
│   - Solicitations│                          │
│   - Reports      │                          │
│   - Settings     │                          │
│  ─────────────   │                          │
│  User profile    │                          │
└─────────────────────────────────────────────┘
```

Pieces:
- `AppSidebar` component in `components/layout/AppSidebar.tsx`: brand block at top, `SidebarMenu` with NavLinks (active state via `useLocation`), `SidebarFooter` with avatar + name + role.
- Header: `SidebarTrigger` (always visible for collapse/expand on desktop, hamburger behavior on mobile via shadcn's built-in offcanvas), right-aligned `DropdownMenu` on `Avatar` (Profile / Settings / Log out — non-functional).
- Main: `<main class="flex-1"><div class="container max-w-7xl py-6"><Outlet/></div></main>`.
- Mobile responsive comes from shadcn Sidebar (auto offcanvas under `md`).

## 5. Pages

Create placeholder pages, each rendering a centered `Card` with title + "Coming soon" copy:
- `pages/Dashboard.tsx`
- `pages/Clients.tsx`
- `pages/Solicitations.tsx`
- `pages/Reports.tsx`
- `pages/Settings.tsx`
- `pages/Login.tsx` (rendered outside `RootLayout`)

Replace the existing placeholder `pages/Index.tsx` usage by routing `/` directly to `Dashboard`.

## 6. Routing (`src/App.tsx`)

```text
<Routes>
  <Route path="/login" element={<Login/>} />
  <Route element={<RootLayout/>}>
    <Route path="/" element={<Dashboard/>} />
    <Route path="/clients" element={<Clients/>} />
    <Route path="/solicitations" element={<Solicitations/>} />
    <Route path="/reports" element={<Reports/>} />
    <Route path="/settings" element={<Settings/>} />
  </Route>
  <Route path="*" element={<NotFound/>} />
</Routes>
```

Keep existing `QueryClientProvider`, `TooltipProvider`, `Toaster`s.

## 7. Out of scope (per prompt)

- No auth logic, no Supabase/Lovable Cloud, no data fetching.
- Login page is purely visual.
- Zustand store file is created empty (placeholder) — no real state yet.

## Technical details

- Strict mode is already enabled in `tsconfig`.
- All colors go through `hsl(var(--token))`; no hard-coded hex in JSX.
- Sidebar uses `Sidebar` + `SidebarTrigger` from `components/ui/sidebar.tsx`; the trigger lives in the header so it remains visible when collapsed.
- Active nav item uses `NavLink` + `isActive` prop on `SidebarMenuButton`.
- Avatar dropdown uses `dropdown-menu` + `avatar` shadcn primitives.
