import { useEffect, useMemo, useState } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUserRates, useUpsertUserRate } from "../hooks/useTimeEntries";
import { toast } from "@/hooks/use-toast";

export function MyRateCard() {
  const { user } = useAuth();
  const { data: rates = [], isLoading } = useUserRates();
  const upsert = useUpsertUserRate();

  const current = useMemo(
    () => rates.find((r) => r.user_id === user?.id && !r.effective_to) ?? null,
    [rates, user?.id]
  );

  const [hourly, setHourly] = useState("");
  const [capacity, setCapacity] = useState("40");

  useEffect(() => {
    if (current) {
      setHourly(current.hourly_rate != null ? String(current.hourly_rate) : "");
      setCapacity(
        current.weekly_capacity_hours != null ? String(current.weekly_capacity_hours) : "40"
      );
    }
  }, [current]);

  const onSave = async () => {
    if (!user) return;
    const rate = Number(hourly);
    const cap = Number(capacity);
    if (!(rate >= 0) || !(cap > 0)) {
      toast({ title: "Enter a valid rate and capacity", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        user_id: user.id,
        hourly_rate: rate,
        weekly_capacity_hours: cap,
      });
      toast({ title: "Rate updated" });
    } catch (e) {
      toast({
        title: "Could not save rate",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Billing rate & capacity
        </CardTitle>
        <CardDescription>
          Used for cost-to-bid and utilization metrics in Reports. Only you and organization admins see this.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourly-rate">Hourly rate (USD)</Label>
                <Input
                  id="hourly-rate"
                  type="number"
                  min="0"
                  step="1"
                  value={hourly}
                  onChange={(e) => setHourly(e.target.value)}
                  placeholder="150"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly-capacity">Weekly capacity (hours)</Label>
                <Input
                  id="weekly-capacity"
                  type="number"
                  min="1"
                  max="80"
                  step="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>
            {current?.effective_from && (
              <p className="text-xs text-muted-foreground">
                Current rate effective from {current.effective_from}.
              </p>
            )}
            <Button onClick={onSave} disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save rate"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
