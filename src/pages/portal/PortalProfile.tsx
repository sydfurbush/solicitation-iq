import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientUser } from "@/features/portal/hooks/useClientUser";

export default function PortalProfile() {
  const { clientUser } = useClientUser();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState(clientUser?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(clientUser?.avatar_url ?? "");
  const [prefs, setPrefs] = useState<any>(
    clientUser?.notification_preferences ?? {
      new_report: true,
      analysis_updated: true,
      question_answered: true,
    },
  );
  const [password, setPassword] = useState("");

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!clientUser?.id) return;
      const { error } = await supabase
        .from("client_users")
        .update({ full_name: fullName, avatar_url: avatarUrl, notification_preferences: prefs })
        .eq("id", clientUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["client-user"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setPassword("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const initials = fullName?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Personal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{initials || "C"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label>Avatar URL</Label>
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={clientUser?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ["new_report", "New report published"],
            ["analysis_updated", "Analysis updated"],
            ["question_answered", "Question answered"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={!!prefs?.[key]}
                onCheckedChange={(v) => setPrefs({ ...prefs, [key]: v })}
              />
            </div>
          ))}
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={() => changePassword.mutate()}
            disabled={!password || password.length < 8 || changePassword.isPending}
          >
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
