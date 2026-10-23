# BidSense AI

PROMPT 1: Project Foundation

Create a new React + TypeScript application for a "Solicitation Intelligence Analyzer" - a platform that helps consulting firms analyze RFP/RFQ/RFI documents and generate strategic intelligence reports for their clients.

 

PROJECT SETUP:

1. Initialize with Vite + React + TypeScript (strict mode)

2. Install and configure:

   - Tailwind CSS with the default config

   - Shadcn/UI (install these components: button, card, input, label, textarea, select, dialog, dropdown-menu, tabs, table, badge, toast, skeleton, separator, scroll-area, avatar, tooltip, progress, alert, accordion, command, popover, calendar, checkbox, radio-group, switch, sheet, navigation-menu, breadcrumb, pagination)

   - Lucide React for icons

   - React Router DOM v6 for routing

   - TanStack Query (React Query) v5

   - React Hook Form + Zod

   - date-fns for date formatting

   - Zustand for client state

 

3. Create the following folder structure:

   /src

     /components

       /ui (shadcn components go here)

       /layout

       /shared

     /features

       /auth

       /organizations

       /clients

       /solicitations

       /documents

       /analysis

       /reports

     /hooks

     /lib

       /supabase

       /utils

       /validators

     /types

     /stores

     /pages

 

4. Create a root layout component at /src/components/layout/RootLayout.tsx with:

   - A collapsible sidebar (280px expanded, 64px collapsed)

   - Top header bar with user avatar dropdown

   - Main content area with max-width container

   - Mobile-responsive hamburger menu

   - Use a professional dark sidebar with light content area theme

 

5. Create placeholder pages with basic "Coming Soon" content:

   - /src/pages/Dashboard.tsx (route: /)

   - /src/pages/Clients.tsx (route: /clients)

   - /src/pages/Solicitations.tsx (route: /solicitations)

   - /src/pages/Reports.tsx (route: /reports)

   - /src/pages/Settings.tsx (route: /settings)

   - /src/pages/Login.tsx (route: /login)

 

6. Set up React Router with these routes in App.tsx

 

7. Create a theme configuration with these brand colors:

   - Primary: #2563eb (blue-600)

   - Secondary: #0f172a (slate-900)

   - Accent: #10b981 (emerald-500)

   - Warning: #f59e0b (amber-500)

   - Danger: #ef4444 (red-500)

 

The sidebar should show:

- Logo/brand at top

- Navigation items: Dashboard, Clients, Solicitations, Reports, Settings

- User profile section at bottom

 

IMPORTANT: Do not connect to any backend yet. This is UI scaffolding only.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://solicitation-iq.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2e90255b-0daf-42f1-8522-298fa8ab3375).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
