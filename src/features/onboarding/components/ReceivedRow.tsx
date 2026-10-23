import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { ReceivedMeta } from "./OnboardingUploader";

function fmtContact(name: string | null | undefined, email: string | null | undefined): string {
  if (name && email) return `${name} <${email}>`;
  return name || email || "";
}

export function useReceivedState(clientId: string) {
  const [via, setVia] = useState<"email" | "other">("email");
  const [from, setFrom] = useState<string>("");
  const [on, setOn] = useState<Date>(new Date());
  const [touched, setTouched] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["onboarding-contacts", clientId],
    queryFn: async () => {
      const [{ data: c }, { data: users }] = await Promise.all([
        supabase.from("clients").select("primary_contact_name, primary_contact_email").eq("id", clientId).maybeSingle(),
        supabase.from("client_users").select("full_name, email").eq("client_id", clientId),
      ]);
      const list: { value: string; primary: boolean }[] = [];
      const primary = fmtContact(c?.primary_contact_name, c?.primary_contact_email);
      if (primary) list.push({ value: primary, primary: true });
      (users ?? []).forEach((u) => {
        const v = fmtContact(u.full_name, u.email);
        if (v && !list.some((x) => x.value === v)) list.push({ value: v, primary: false });
      });
      return list;
    },
  });

  useEffect(() => {
    if (!touched && !from && contacts[0]?.primary) setFrom(contacts[0].value);
  }, [contacts, touched, from]);

  const meta: ReceivedMeta = useMemo(
    () => ({ via, from: from.trim() || null, on: format(on, "yyyy-MM-dd") }),
    [via, from, on],
  );
  return { via, setVia, from, setFrom: (v: string) => { setTouched(true); setFrom(v); }, on, setOn, contacts, meta };
}

export function ReceivedRow({ state: s }: { state: ReturnType<typeof useReceivedState> }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-sm font-medium mb-2">How did these arrive?</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Received via</Label>
          <Select value={s.via} onValueChange={(v) => s.setVia(v as "email" | "other")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email from client</SelectItem>
              <SelectItem value="other">Other (e.g. shared drive, USB)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                <span className={cn("truncate", !s.from && "text-muted-foreground")}>{s.from || "Choose or type a sender"}</span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Name or email…" value={typed} onValueChange={setTyped} />
                <CommandList>
                  <CommandEmpty>No matches.</CommandEmpty>
                  {typed.trim() && (
                    <CommandGroup heading="Use typed value">
                      <CommandItem value={`__typed ${typed}`} onSelect={() => { s.setFrom(typed.trim()); setTyped(""); setOpen(false); }}>
                        Use "{typed.trim()}"
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup heading="Client contacts">
                    {s.contacts.map((c) => (
                      <CommandItem key={c.value} value={c.value} onSelect={() => { s.setFrom(c.value); setTyped(""); setOpen(false); }}>
                        <span className="truncate">{c.value}</span>
                        {c.primary && <span className="ml-auto text-xs text-muted-foreground">Primary</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date received</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                <CalendarIcon className="h-4 w-4 mr-2" />{format(s.on, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={s.on} onSelect={(d) => d && s.setOn(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
