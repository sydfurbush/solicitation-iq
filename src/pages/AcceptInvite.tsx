import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? params.get("invite");
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setStatus("error");
      setMessage("Missing invitation token.");
      return;
    }
    if (!user) return;
    setStatus("working");
    supabase.rpc("accept_org_invitation", { p_token: token }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        toast.success("Joined organization");
        setTimeout(() => navigate("/", { replace: true }), 800);
      }
    });
  }, [token, user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept invitation</CardTitle>
          <CardDescription>Join your team's workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!user && !loading && (
            <>
              <p className="text-sm">Sign in or create an account using the email this invite was sent to.</p>
              <div className="flex gap-2">
                <Button asChild className="flex-1"><Link to={`/signup?invite=${token}`}>Sign up</Link></Button>
                <Button asChild variant="outline" className="flex-1"><Link to={`/login?next=/accept-invite?token=${token}`}>Sign in</Link></Button>
              </div>
            </>
          )}
          {status === "working" && <p className="text-sm">Joining your team…</p>}
          {status === "done" && <p className="text-sm text-green-600">You're in! Redirecting…</p>}
          {status === "error" && <p className="text-sm text-destructive">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
