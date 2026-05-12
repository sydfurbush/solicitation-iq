## Plan B — Token-based Client Invite Links

The `client_user_invitations` table already has a unique `token` column auto-generated on insert. We just need to (1) expose that token as a shareable link, (2) build a public acceptance page, and (3) wire up an edge function to safely create the auth user + `client_users` row.

### 1. Edge Functions (2 new, public — `verify_jwt = false`)

**`accept-client-invitation`**
- Input: `{ token: string }`
- Looks up invitation by token using service-role client
- Returns: invitation status (`valid` / `expired` / `revoked` / `already_accepted`), client name, invitee email, full name. Does NOT require auth — used to render the accept page.

**`complete-client-invitation`**
- Input: `{ token: string, password: string }`
- Validates token (pending + not expired)
- Creates Supabase auth user via `admin.createUser` (email_confirm: true, password)
- Inserts `client_users` row using the new auth user id, copies `email`, `full_name`, `client_id` from invitation
- Marks invitation `status = 'accepted'`, `accepted_at = now()`
- Returns success — frontend then signs the user in with email/password

### 2. New Public Page — `/portal/accept-invite`

Route added to `App.tsx` (public, outside auth guard).

Flow:
1. Read `?token=...` from URL
2. On mount, call `accept-client-invitation` to validate
3. Show one of:
   - **Valid** → form with read-only email + full name, password + confirm password fields, "Create account & sign in" button
   - **Expired/Revoked/Accepted** → friendly message + link to `/portal/login`
4. On submit: call `complete-client-invitation`, then `signIn(email, password)`, redirect to `/portal`

Uses existing portal styling (matches `PortalLogin.tsx` split-panel layout).

### 3. UI changes — `ClientUsersManagement.tsx`

In the Invitations table:
- Add a **Copy invite link** action to the row dropdown (alongside Refresh / Revoke)
- Generates `${window.location.origin}/portal/accept-invite?token=${invitation.token}`
- Toast confirmation: "Invite link copied — share with the invitee"

Replace the existing "Copy portal link" button (which copies the useless generic `/portal/login`) with a help hint: "Use the per-invite link in each row's menu."

Also: after creating an invitation in `InviteClientUserDialog.tsx`, immediately copy the new invite link to clipboard and show: "Invitation created and link copied to clipboard."

### 4. Out of scope (deferred to future Option C)
- Automated email sending — agent will paste/share manually for now
- Custom branded email templates
- Resend-via-email button

### Build order
1. Edge function `accept-client-invitation`
2. Edge function `complete-client-invitation`
3. `/portal/accept-invite` page + route
4. UI updates in `ClientUsersManagement.tsx` + `InviteClientUserDialog.tsx`

No DB migration required — `token`, `expires_at`, and `status` already exist.