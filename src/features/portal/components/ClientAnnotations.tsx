import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquare, HelpCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientUser } from "../hooks/useClientUser";

interface Props {
  solicitationId: string;
  hasFullAccess: boolean;
}

export function ClientAnnotations({ solicitationId, hasFullAccess }: Props) {
  const { clientUser } = useClientUser();
  const qc = useQueryClient();
  const [type, setType] = useState<"note" | "question">("note");
  const [content, setContent] = useState("");

  const { data: annotations = [] } = useQuery({
    queryKey: ["portal-annotations", solicitationId],
    enabled: hasFullAccess && !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotations")
        .select("*")
        .eq("solicitation_id", solicitationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!clientUser?.id) throw new Error("Not signed in");
      const { error } = await supabase.from("annotations").insert({
        solicitation_id: solicitationId,
        user_id: clientUser.id,
        annotation_type: type,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Annotation added");
      setContent("");
      qc.invalidateQueries({ queryKey: ["portal-annotations", solicitationId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (!hasFullAccess) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          Annotations are not available for your access level.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Annotations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="question">Question</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add your note or question..."
            rows={3}
          />
          <Button
            size="sm"
            disabled={!content || create.isPending}
            onClick={() => create.mutate()}
          >
            <Send className="h-4 w-4 mr-1" /> Submit
          </Button>
        </div>

        <div className="space-y-2">
          {annotations.length === 0 && (
            <div className="text-sm text-muted-foreground">No annotations yet.</div>
          )}
          {annotations.map((a: any) => {
            const Icon = a.annotation_type === "question" ? HelpCircle : MessageSquare;
            const mine = a.user_id === clientUser?.id;
            return (
              <div key={a.id} className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">{a.annotation_type}</Badge>
                  {mine && <Badge variant="secondary" className="text-xs">You</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(a.created_at), "PP")}
                  </span>
                </div>
                <p className="text-sm">{a.content}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
