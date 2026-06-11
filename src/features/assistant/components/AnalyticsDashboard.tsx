import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useAssistantAnalytics } from "../hooks/useAssistantAnalytics";
import { formatUsd } from "../lib/aiCost";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitationId?: string;
};

export function AnalyticsDashboard({ open, onOpenChange, solicitationId }: Props) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAssistantAnalytics(
    solicitationId ? { solicitationId } : days,
  );
  const scoped = !!solicitationId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{scoped ? "Assistant analytics — this solicitation" : "Assistant analytics"}</SheetTitle>
          <SheetDescription>
            {scoped
              ? "Token, cost, and model usage across all users for this solicitation."
              : "Usage across your organization."}
          </SheetDescription>
        </SheetHeader>

        {!scoped && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Window</span>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading || !data ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Requests" value={data.totalRequests.toLocaleString()} />
              <Stat
                label="Error rate"
                value={`${(data.errorRate * 100).toFixed(1)}%`}
                sub={`${data.errors} errors`}
                tone={data.errorRate > 0.05 ? "warn" : undefined}
              />
              <Stat label="Avg latency" value={`${data.avgLatencyMs} ms`} />
              <Stat
                label="Tokens"
                value={(data.totalTokensIn + data.totalTokensOut).toLocaleString()}
                sub={`${data.totalTokensIn.toLocaleString()} in · ${data.totalTokensOut.toLocaleString()} out`}
              />
              <Stat
                label="Estimated cost"
                value={formatUsd(data.estimatedCostUsd)}
                sub={data.hasUnknownPricing ? "* some models unpriced" : "based on token usage"}
              />
              <Stat
                label="Models used"
                value={String(data.byModel.length)}
                sub={data.byModel[0]?.model ?? "—"}
              />
            </div>

            <Section title="By model">
              {data.byModel.length === 0 ? (
                <Empty />
              ) : (
                <ul className="text-sm divide-y rounded-md border">
                  {data.byModel.map((m) => (
                    <li key={m.model} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="truncate font-mono text-xs">{m.model}</span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span>{m.requests} req</span>
                        <span>{m.tokens.toLocaleString()} tok</span>
                        <span>{m.unknownPricing ? "—" : formatUsd(m.costUsd)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Requests per day">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} fontSize={10} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Section>

            <Section title="By persona">
              {data.byPersona.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(120, data.byPersona.length * 28)}>
                  <BarChart data={data.byPersona} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={10} allowDecimals={false} />
                    <YAxis type="category" dataKey="persona" fontSize={10} width={120} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>

            <Section title="Top users">
              {data.byUser.length === 0 ? (
                <Empty />
              ) : (
                <ul className="text-sm divide-y rounded-md border">
                  {data.byUser.map((u) => (
                    <li key={u.user_id} className="flex items-center justify-between px-3 py-2">
                      <span className="truncate">{u.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{u.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-xs text-muted-foreground">No data in this window.</div>;
}
