import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSamKey } from "../hooks/useSamKey";

export function IntegrationsTab() {
  const { data, isLoading, save, remove } = useSamKey();
  const [value, setValue] = useState("");

  const handleSave = async () => {
    try {
      await save.mutateAsync(value);
      toast.success("SAM.gov API key saved");
      setValue("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save key");
    }
  };

  const handleRemove = async () => {
    try {
      await remove.mutateAsync();
      toast.success("SAM.gov API key removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove key");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          SAM.gov API key
          {!isLoading && (
            <Badge variant={data?.hasKey ? "default" : "secondary"}>
              {data?.hasKey ? "Connected" : "Not configured"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Each user provides their own SAM.gov API key. It's used whenever you import a notice or
          pull attachments from SAM.gov.{" "}
          <a
            href="https://open.gsa.gov/api/get-opportunities-public-api/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            How to get a key
          </a>
          .
        </p>

        {data?.hasKey && (
          <div className="text-sm">
            Current key: <code>••••••••{data.lastFour}</code>
            {data.updatedAt && (
              <span className="text-muted-foreground ml-2">
                · updated {new Date(data.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="sam-key">{data?.hasKey ? "Replace key" : "API key"}</Label>
          <Input
            id="sam-key"
            type="password"
            autoComplete="off"
            placeholder="Paste your SAM.gov API key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!value.trim() || save.isPending}>
            {data?.hasKey ? "Replace key" : "Save key"}
          </Button>
          {data?.hasKey && (
            <Button variant="outline" onClick={handleRemove} disabled={remove.isPending}>
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
