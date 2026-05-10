import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/useAuth";

export interface PresentUser {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  online_at: string;
}

export function usePresence(solicitationId: string | undefined) {
  const { user } = useAuth();
  const [present, setPresent] = useState<PresentUser[]>([]);

  useEffect(() => {
    if (!solicitationId || !user) return;
    const channel = supabase.channel(`presence-sol-${solicitationId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresentUser>();
        const flat: PresentUser[] = [];
        Object.values(state).forEach((arr) => arr.forEach((p) => flat.push(p)));
        setPresent(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            full_name: user.user_metadata?.full_name ?? null,
            email: user.email ?? null,
            avatar_url: user.user_metadata?.avatar_url ?? null,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [solicitationId, user]);

  return present;
}
