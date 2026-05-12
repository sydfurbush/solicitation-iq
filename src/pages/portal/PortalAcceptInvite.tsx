import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/features/auth/hooks/useAuth";

type InviteState =
  | { status: "loading" }
  | { status: "valid"; email: string; full_name: string | null; client_name: string | null }
  | { status: "invalid" | "expired" | "revoked" | "already_accepted" }
  | { status: "error"; message: string };

export default function PortalAcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [state, setState] = useState<InviteState>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid" });
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("accept-client-invitation", {
        body: { token },
      });
      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      setState(data);
    })();
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (password.length < 8) return setSubmitError("Password must be at least 8 characters.");
    if (password !== confirm) return setSubmitError("Passwords do not match.");
    if (state.status !== "valid") return;

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("complete-client-invitation", {
      body: { token, password },
    });
    if (error || data?.error) {
      setSubmitting(false);
      setSubmitError(error?.message ?? data?.error ?? "Could not accept invitation.");
      return;
    }
    const { error: signInErr } = await signIn(state.email, password);
    setSubmitting(false);
    if (signInErr) {
      setSubmitError("Account created. Please sign in.");
      navigate("/portal/login");
      return;
    }
    navigate("/portal", { replace: true });
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <Building2 className="h-5 w-5" /> Client Portal
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-3">You're invited</h1>
          <p className="opacity-90">
            Set a password to access your client portal — view your solicitation analyses,
            executive reports, and updates from your strategy team.
          </p>
        </div>
        <div className="text-xs opacity-80">© Solicitation Intelligence Analyzer</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          {state.status === "loading" && (
            <CardContent className="py-12 text-center text-muted-foreground">
              Validating invitation…
            </CardContent>
          )}

          {state.status === "valid" && (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">Accept your invitation</CardTitle>
                <CardDescription>
                  {state.client_name
                    ? `You've been invited to access the ${state.client_name} portal.`
                    : "You've been invited to the client portal."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={state.full_name ?? ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={state.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Create password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating account…" : "Create account & sign in"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {(state.status === "invalid" ||
            state.status === "expired" ||
            state.status === "revoked" ||
            state.status === "already_accepted" ||
            state.status === "error") && (
            <>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {state.status === "already_accepted" ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  {messageTitle(state.status)}
                </CardTitle>
                <CardDescription>{messageBody(state.status)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to="/portal/login">Go to sign in</Link>
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function messageTitle(s: string) {
  switch (s) {
    case "already_accepted": return "Invitation already used";
    case "expired": return "Invitation expired";
    case "revoked": return "Invitation revoked";
    case "error": return "Something went wrong";
    default: return "Invalid invitation";
  }
}
function messageBody(s: string) {
  switch (s) {
    case "already_accepted":
      return "This invitation has already been accepted. Sign in with your existing credentials.";
    case "expired":
      return "This invitation link has expired. Ask your account team to send a new one.";
    case "revoked":
      return "This invitation has been revoked. Please contact your account team.";
    case "error":
      return "We couldn't validate this invitation. Try again or contact your account team.";
    default:
      return "We couldn't find this invitation. Check the link or ask for a new one.";
  }
}
