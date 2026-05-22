import { FileType, Ruler, Hash, AlignLeft, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FormatProfile } from "@/features/formatProfiles/hooks/useFormatProfiles";

interface Props {
  profile: FormatProfile;
  isDefault: boolean;
}

export function FormatProfilePanel({ profile, isDefault }: Props) {
  const limits = (profile.volume_page_limits ?? {}) as Record<string, number | null>;
  const limitEntries = Object.entries(limits);

  return (
    <Card className="border-dashed">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Format profile</span>
            <span className="text-sm text-muted-foreground">· {profile.name}</span>
            {isDefault && <Badge variant="outline" className="text-[10px]">org default</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <FileType className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Font:</span>
            <span className="font-medium">{profile.font} {profile.size_pt}pt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Margins:</span>
            <span className="font-medium">{profile.margins_in}"</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Line:</span>
            <span className="font-medium">{profile.line_spacing}x</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Pages:</span>
            <span className="font-mono text-[11px]">{profile.page_number_format}</span>
          </div>
        </div>

        {limitEntries.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Volume page limits</p>
            <div className="flex flex-wrap gap-1.5">
              {limitEntries.map(([vol, limit]) => (
                <Badge key={vol} variant="secondary" className="text-[10px]">
                  {vol}: {limit ?? "no limit"}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.notes && (
          <p className="text-xs text-muted-foreground border-t pt-2">{profile.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
