import { useState, useEffect } from "react";
import { Settings2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAssistantPreferences, useUpdateAssistantPreferences } from "../hooks/useAssistantPreferences";
import { PERSONAS, type PersonaKey } from "../lib/personas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TONES = [
  { value: "neutral", label: "Neutral" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
];

export function PreferencesPanel({ open, onOpenChange }: Props) {
  const { data: prefs } = useAssistantPreferences();
  const upd = useUpdateAssistantPreferences();
  const [topicDraft, setTopicDraft] = useState("");
  const [blocked, setBlocked] = useState<string[]>([]);

  useEffect(() => {
    if (prefs?.blocked_topics) setBlocked(prefs.blocked_topics);
  }, [prefs?.blocked_topics]);

  if (!prefs) return null;

  const addTopic = () => {
    const t = topicDraft.trim();
    if (!t) return;
    const next = Array.from(new Set([...blocked, t]));
    setBlocked(next);
    setTopicDraft("");
    upd.mutate({ blocked_topics: next });
  };
  const removeTopic = (t: string) => {
    const next = blocked.filter((x) => x !== t);
    setBlocked(next);
    upd.mutate({ blocked_topics: next });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Assistant Preferences
          </SheetTitle>
          <SheetDescription>How the assistant talks and what it remembers.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-xs">Default persona</Label>
            <Select
              value={prefs.default_persona}
              onValueChange={(v) => upd.mutate({ default_persona: v as PersonaKey })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONAS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tone</Label>
            <Select value={prefs.tone} onValueChange={(v) => upd.mutate({ tone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Row
            label="Plain English by default"
            description="New conversations start in plain mode."
            checked={prefs.plain_mode_default}
            onChange={(v) => upd.mutate({ plain_mode_default: v })}
          />
          <Row
            label="Auto-learn from chat"
            description="Save durable facts you mention (NAICS, capabilities, preferences)."
            checked={prefs.auto_learn}
            onChange={(v) => upd.mutate({ auto_learn: v })}
          />
          <Row
            label="Voice replies"
            description="Read responses aloud when generated."
            checked={prefs.voice_replies}
            onChange={(v) => upd.mutate({ voice_replies: v })}
          />

          <div className="space-y-2">
            <Label className="text-xs">Blocked topics</Label>
            <p className="text-[11px] text-muted-foreground">
              The assistant will refuse to answer if any of these appear in the question.
            </p>
            <div className="flex gap-2">
              <Input
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                placeholder="e.g. pricing"
              />
              <Button size="sm" onClick={addTopic} disabled={!topicDraft.trim()}>Add</Button>
            </div>
            {blocked.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {blocked.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTopic(t)}
                      className="hover:bg-background rounded"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-xs">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
