import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, password } = await req.json();
    if (!token || typeof token !== 'string') return json({ error: 'Token required' }, 400);
    if (!password || typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: invite, error: invErr } = await admin
      .from('client_user_invitations')
      .select('id, client_id, email, full_name, status, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!invite) return json({ error: 'Invalid invitation' }, 404);
    if (invite.status === 'accepted' || invite.accepted_at) {
      return json({ error: 'Invitation already accepted' }, 409);
    }
    if (invite.status === 'revoked') return json({ error: 'Invitation revoked' }, 410);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ error: 'Invitation expired' }, 410);
    }

    let userId: string | null = null;

    // Try to create the auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: invite.full_name ?? undefined },
    });

    if (createErr) {
      // If already registered, try to update password and continue
      if (/already.*registered|already.*exists|duplicate/i.test(createErr.message)) {
        // Find existing user by paging; for small instances this is fine
        let page = 1;
        const perPage = 1000;
        while (page <= 10 && !userId) {
          const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
          if (listErr) throw listErr;
          const match = list.users.find((u) => u.email?.toLowerCase() === invite.email.toLowerCase());
          if (match) { userId = match.id; break; }
          if (list.users.length < perPage) break;
          page += 1;
        }
        if (!userId) throw createErr;
        await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      } else {
        throw createErr;
      }
    } else {
      userId = created.user!.id;
    }

    // Upsert client_users row
    const { error: cuErr } = await admin
      .from('client_users')
      .upsert({
        id: userId!,
        client_id: invite.client_id,
        email: invite.email,
        full_name: invite.full_name,
        deleted_at: null,
      }, { onConflict: 'id' });
    if (cuErr) throw cuErr;

    // Mark invitation accepted
    const { error: updErr } = await admin
      .from('client_user_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);
    if (updErr) throw updErr;

    return json({ ok: true, email: invite.email }, 200);
  } catch (e) {
    console.error('complete-client-invitation error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
