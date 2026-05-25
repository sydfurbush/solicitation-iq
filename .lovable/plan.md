## Goal

Today the Teaming tab assumes the client is the prime and partners are external. Make it easy to add the **client itself** to the roster — as Prime, Subcontractor, Teaming partner, or Mentor/Protégé — and prefill from the client record + `client_profiles` so the user doesn't retype name, NAICS, set-asides, POC, clearance, etc.

## UX

In `TeamingTab.tsx` add a second button next to "Add partner":

- **"Add client as…" ▾** dropdown with: Prime, Subcontractor, Teaming partner, Mentor/Protégé.
- Clicking a role opens the existing PartnerDrawer in create mode, **prefilled** from the client (see mapping below), with role preset and `linked_client_id` set to the client's id.
- If the client is already on the roster, the dropdown shows "Client already added (edit)" and opens the existing row instead of creating a duplicate.
- A subtle badge ("Client") on that row in the table so users can see at a glance which partner represents the client.

Inside the drawer, add a small **"Refill from client profile"** link (visible only when `linked_client_id` is set) that re-pulls current client data into empty fields without overwriting fields the user has edited.

## Prefill mapping (client → teaming partner)

Source: `clients` + `client_profiles` (loaded via existing `useClientProfile` for the solicitation's client).

| Teaming field        | Source                                                      |
|----------------------|-------------------------------------------------------------|
| name                 | `clients.name`                                              |
| role                 | chosen from dropdown (sub / prime / teaming / mentor)       |
| set_asides           | `client_profiles.set_asides`                                |
| naics_codes          | `client_profiles.naics_codes`                               |
| scope_summary        | empty (role-specific — user fills)                          |
| workshare_pct        | 100 if Prime, else empty                                    |
| agreement_status     | `subcontract` if Prime (self), else `none`                  |
| poc_name             | `clients.primary_contact_name`                              |
| poc_email            | `clients.primary_contact_email`                             |
| clearance_level      | `client_profiles.workforce_capacity.clearance_level` if present |
| cleared_staff_count  | `client_profiles.workforce_capacity.cleared_count` if present |
| notes                | short auto-note: "Auto-populated from client profile"       |
| linked_client_id     | `clients.id`                                                |

## Downstream impact

- AI prompt helper `supabase/functions/_shared/teaming.ts` already renders whatever's in the roster, so once the client appears as a partner it flows into gap analysis, drafting, etc. automatically. No edge-function changes needed.
- The existing comment in the tab ("Defaults live on the client's Capabilities profile; this overrides them for this bid only") stays accurate.

## Files touched

1. `src/features/teaming/components/TeamingTab.tsx`
   - Add `DropdownMenu` "Add client as…" next to "Add partner".
   - Build `buildClientPartnerDefaults(client, profile, role)` helper.
   - Detect existing client-linked row to switch button to "Edit client row".
   - Render "Client" badge on the client-linked row.
2. `src/features/teaming/components/PartnerDrawer` (same file)
   - Accept optional `initialValues` prop so prefill works.
   - Add "Refill from client profile" link when `linked_client_id` is set.
3. Reuse existing hooks: `useClients` / `useClientProfile`, `useCreateTeamingPartner`, `useUpdateTeamingPartner`. No new hooks, no migration — `linked_client_id` already exists on `solicitation_teaming_partners`.

## Out of scope

- Auto-creating the client row on solicitation creation (still explicit user action).
- Two-way sync (editing teaming row does not write back to client profile).
- Changing AI prompt structure.
