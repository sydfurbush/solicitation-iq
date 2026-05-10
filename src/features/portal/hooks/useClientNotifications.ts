import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientUser } from "./useClientUser";

export function useClientNotifications() {
  const { clientUser, isClient } = useClientUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["client-notifications", clientUser?.id],
    enabled: isClient && !!clientUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notifications")
        .select("*")
        .eq("client_user_id", clientUser!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!clientUser?.id) return;
    const channel = supabase
      .channel(`notifications-${clientUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_notifications",
          filter: `client_user_id=eq.${clientUser.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["client-notifications", clientUser.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientUser?.id, qc]);

  const unreadCount = (query.data ?? []).filter((n: any) => !n.is_read).length;
  return { ...query, unreadCount };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const { clientUser } = useClientUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!clientUser?.id) return;
      const { error } = await supabase
        .from("client_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("client_user_id", clientUser.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-notifications"] }),
  });
}
