import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUser } from "@/features/auth/hooks/useUser";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MyRateCard } from "@/features/time/components/MyRateCard";

export default function Profile() {
  const { user, role, isLoading, refetch } = useUser();
  const { user: authUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
  }, [user?.full_name]);

  const initials = (fullName || authUser?.email || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSaveName = async () => {
    if (!authUser) return;
    setSavingName(true);
    const { error } = await supabase
      .from("users")
      .update({ full_name: fullName.trim() || null })
      .eq("id", authUser.id);
    setSavingName(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profile updated" });
    refetch();
  };

  const handleAvatarUpload = async (file: File) => {
    if (!authUser) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${authUser.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("users")
      .update({ avatar_url: data.publicUrl })
      .eq("id", authUser.id);
    setUploading(false);
    if (updErr) {
      toast({ title: "Could not update avatar", description: updErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avatar updated" });
    refetch();
  };

  const handleChangePassword = async () => {
    setPwError(null);
    if (pw.length < 8 || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      setPwError("Password must be 8+ chars with a number and special character.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPw("");
    toast({ title: "Password updated" });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading profile...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information and credentials.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your profile details visible to your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={fullName} /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90"
                aria-label="Upload avatar"
                disabled={uploading}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                }}
              />
            </div>
            <div>
              <p className="font-medium">{fullName || authUser?.email}</p>
              <p className="text-sm text-muted-foreground">{authUser?.email}</p>
              {role && (
                <Badge variant="secondary" className="mt-1 capitalize">
                  {role}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <div className="flex gap-2">
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                placeholder="Your name"
              />
              <Button onClick={handleSaveName} disabled={savingName}>
                {savingName ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={authUser?.email ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use 8+ characters with a number and a special character.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwError && (
            <Alert variant="destructive">
              <AlertDescription>{pwError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={pwSaving || !pw}>
            {pwSaving ? "Updating..." : "Update password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
