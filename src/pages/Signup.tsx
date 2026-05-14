import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signUpSchema, type SignUpInput } from "@/lib/validators/auth";
import { useAuth } from "@/features/auth/hooks/useAuth";

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite");
  const { signUp, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      organizationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignUpInput) => {
    setError(null);
    const { error: signUpErr } = await signUp(values.email, values.password, {
      full_name: values.fullName,
      // Only pass organization_name when there's no invite — invited users join the inviter's org.
      ...(inviteToken ? {} : { organization_name: values.organizationName }),
    });
    if (signUpErr) {
      setError(signUpErr.message);
      return;
    }
    // Auto-confirm is enabled, so we can sign the user in immediately.
    const { error: signInErr } = await signIn(values.email, values.password);
    if (signInErr) {
      // Account was created but session not established — send to login.
      navigate("/login", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-secondary via-secondary to-primary/30">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">{inviteToken ? "Join your team" : "Create your workspace"}</CardTitle>
            <CardDescription>
              {inviteToken
                ? "You've been invited. Create your account to join the workspace."
                : "Set up Solicitation Intelligence Analyzer for your team"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!inviteToken && (
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Consulting" autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@firm.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                    </FormControl>
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
                      <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating workspace..." : "Create workspace"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
