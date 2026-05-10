import { useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientUser } from "../hooks/useClientUser";

export function SupportWidget() {
  const { clientUser, client } = useClientUser();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!clientUser?.id || !client?.id) throw new Error("Not signed in");
      const { error } = await supabase.from("client_support_messages").insert({
        client_user_id: clientUser.id,
        client_id: client.id,
        subject,
        message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent. Our team will reply soon.");
      setSubject("");
      setMessage("");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40"
          aria-label="Support"
        >
          <LifeBuoy className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold">Contact support</h4>
            <p className="text-xs text-muted-foreground">
              Send a message to your account team.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="How can we help?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your question..."
            />
          </div>
          <Button
            className="w-full"
            disabled={!subject || !message || submit.isPending}
            onClick={() => submit.mutate()}
          >
            <Send className="h-4 w-4 mr-2" />
            {submit.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
