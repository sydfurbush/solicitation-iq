import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogTime, useTimeEntries, useDeleteTimeEntry } from "../hooks/useTimeEntries";
import { toast } from "@/hooks/use-toast";

const PHASES = [
  { value: "phase_1_initial", label: "Phase 1 — Initial" },
  { value: "phase_2_deep_dive", label: "Phase 2 — Deep Dive" },
  { value: "phase_3_outline", label: "Phase 3 — Outline" },
] as const;

export function LogTimeButton({ solicitationId }: { solicitationId: string }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [phase, setPhase] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billable, setBillable] = useState(true);
  const [notes, setNotes] = useState("");

  const log = useLogTime();
  const del = useDeleteTimeEntry();
  const { data: entries = [] } = useTimeEntries(solicitationId);

  const reset = () => {
    setHours("");
    setPhase("");
    setDate(new Date().toISOString().slice(0, 10));
    setBillable(true);
    setNotes("");
  };

  const onSubmit = async () => {
    const h = Number(hours);
    if (!h || h <= 0) {
      toast({ title: "Enter hours", variant: "destructive" });
      return;
    }
    try {
      await log.mutateAsync({
        solicitation_id: solicitationId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phase: (phase || null) as any,
        entry_date: date,
        hours: h,
        billable,
        notes: notes.trim() || null,
      });
      toast({ title: "Time logged", description: `${h} hour${h === 1 ? "" : "s"} on ${date}` });
      reset();
    } catch (e) {
      toast({ title: "Could not log time", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Clock className="h-4 w-4" />
          Log time
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Log time</SheetTitle>
          <SheetDescription>
            Total logged on this solicitation: <span className="font-medium">{totalHours.toFixed(1)} h</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="2.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Phase (optional)</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger><SelectValue placeholder="No phase" /></SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="billable" className="text-sm">Billable</Label>
              <p className="text-xs text-muted-foreground">Counts toward cost-to-bid</p>
            </div>
            <Switch id="billable" checked={billable} onCheckedChange={setBillable} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you work on?" />
          </div>
        </div>

        <SheetFooter className="mt-auto">
          <Button onClick={onSubmit} disabled={log.isPending} className="w-full">
            {log.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log time"}
          </Button>
        </SheetFooter>

        {entries.length > 0 && (
          <div className="mt-4 border-t pt-3 overflow-y-auto">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Recent entries</p>
            <ul className="space-y-2">
              {entries.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{Number(e.hours).toFixed(2)} h · {e.entry_date}</div>
                    {e.notes && <div className="text-xs text-muted-foreground truncate">{e.notes}</div>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => del.mutate(e.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
