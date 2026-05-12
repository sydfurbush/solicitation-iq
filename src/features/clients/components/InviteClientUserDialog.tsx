import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteClientUserDialog({ clientId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [accessLevel, setAccessLevel] = useState<"summary" | "full" | "restricted">("summary");

  const invite = useMutation({
    mutationFn: async () => {
      // Update client access level if changed
      await supabase.from("clients").update({ access_level: accessLevel }).eq("id", clientId);
      // Create invitation record
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("client_user_invitations")
        .insert({
          client_id: clientId,
          email,
          full_name: fullName,
          invited_by: user?.id,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      const link = `${window.location.origin}/portal/accept-invite?token=${data.token}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Invitation created — link copied to clipboard");
      } catch {
        toast.success("Invitation created. Open the row menu to copy the link.");
      }
      qc.invalidateQueries({ queryKey: ["client-users", clientId] });
      qc.invalidateQueries({ queryKey: ["client-invitations", clientId] });
      setEmail("");
      setFullName("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to invite"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Invite client user
          </DialogTitle>
          <DialogDescription>
            Send an invitation to access the client portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@client.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Client access level</Label>
            <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary — exec summary & reports only</SelectItem>
                <SelectItem value="full">Full — all analysis details</SelectItem>
                <SelectItem value="restricted">Restricted — published items only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!email || invite.isPending} onClick={() => invite.mutate()}>
            {invite.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
