import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";
import { useUser } from "@/features/auth/hooks/useUser";
import { MetaTags } from "@/components/shared/MetaTags";
import { AIModelsTab } from "@/features/settings/components/AIModelsTab";

export default function Settings() {
  const { role } = useUser();
  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="space-y-6 max-w-4xl">
      <MetaTags title="Settings" description="Workspace, organization, and account preferences." />
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace preferences.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="ai-models">AI Models</TabsTrigger>}
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6"><ProfileTab /></TabsContent>
        <TabsContent value="organization" className="mt-6"><OrganizationTab /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationsTab /></TabsContent>
        {isAdmin && <TabsContent value="ai-models" className="mt-6"><AIModelsTab /></TabsContent>}
        <TabsContent value="integrations" className="mt-6"><PlaceholderTab title="Integrations" body="API keys and webhook management is coming soon." /></TabsContent>
        <TabsContent value="billing" className="mt-6"><PlaceholderTab title="Billing" body="Subscription and billing details will appear here." /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuthContext();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("users").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState(profile?.full_name ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? "");
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("users")
        .update({ full_name: name, avatar_url: avatar })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePw = useMutation({
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

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={profile?.full_name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Avatar URL</Label>
          <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save profile</Button>

        <Separator className="my-6" />

        <div className="space-y-2">
          <Label>New password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <Button
          variant="outline"
          disabled={!password || password.length < 8 || changePw.isPending}
          onClick={() => changePw.mutate()}
        >
          Update password
        </Button>
      </CardContent>
    </Card>
  );
}

function OrganizationTab() {
  const { data: org } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("*").maybeSingle();
      return data;
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Organization</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={org?.name ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={org?.slug ?? ""} disabled />
        </div>
        <p className="text-xs text-muted-foreground">
          Contact your account owner to update organization-level settings.
        </p>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    weekly_digest: true,
    new_analysis: true,
    new_question: true,
    mentions: true,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Email notifications</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {[
          ["weekly_digest", "Weekly digest"],
          ["new_analysis", "New analysis completed"],
          ["new_question", "New strategic questions generated"],
          ["mentions", "Mentions in annotations"],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key}>{label}</Label>
            <Switch
              id={key}
              checked={(prefs as any)[key]}
              onCheckedChange={(v) => setPrefs({ ...prefs, [key]: v })}
            />
          </div>
        ))}
        <Button onClick={() => toast.success("Preferences saved")}>Save preferences</Button>
      </CardContent>
    </Card>
  );
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
