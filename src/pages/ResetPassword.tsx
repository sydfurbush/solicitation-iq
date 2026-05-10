import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 15;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 20;
  if (/[0-9]/.test(pw)) score += 20;
  if (/[^A-Za-z0-9]/.test(pw)) score += 20;
  score = Math.min(score, 100);
  const label = score < 40 ? "Weak" : score < 70 ? "Fair" : score < 90 ? "Good" : "Strong";
  return { score, label };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase sets the session from the recovery link automatically
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const pw = form.watch("password");
  const strength = passwordStrength(pw || "");

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      return;
    }
    toast({ title: "Password updated", description: "You can now sign in with your new password." });
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-secondary via-secondary to-primary/30">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Set a new password</CardTitle>
            <CardDescription>Choose a strong password you don't use elsewhere.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <Alert variant="destructive">
              <AlertDescription>
                This page requires a valid password reset link. Please request a new one from{" "}
                <Link to="/forgot-password" className="underline">forgot password</Link>.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      {pw && (
                        <div className="space-y-1">
                          <Progress value={strength.score} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Updating..." : "Update password"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
