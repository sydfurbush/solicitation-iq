import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return json({ error: 'Token required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: invite, error } = await admin
      .from('client_user_invitations')
      .select('id, client_id, email, full_name, status, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    if (!invite) return json({ status: 'invalid' }, 200);

    if (invite.status === 'accepted' || invite.accepted_at) {
      return json({ status: 'already_accepted' }, 200);
    }
    if (invite.status === 'revoked') return json({ status: 'revoked' }, 200);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ status: 'expired' }, 200);
    }

    const { data: client } = await admin
      .from('clients')
      .select('name')
      .eq('id', invite.client_id)
      .maybeSingle();

    return json({
      status: 'valid',
      email: invite.email,
      full_name: invite.full_name,
      client_name: client?.name ?? null,
    }, 200);
  } catch (e) {
    console.error('accept-client-invitation error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
