import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Copy, Trash2, Star, StarOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCreateFormatProfile,
  useDeleteFormatProfile,
  useFormatProfiles,
  useUpdateFormatProfile,
  type FormatProfile,
} from "@/features/formatProfiles/hooks/useFormatProfiles";
import { FormatProfileEditor } from "./FormatProfileEditor";

export function FormatProfilesTab() {
  const { data: profiles = [], isLoading } = useFormatProfiles();
  const create = useCreateFormatProfile();
  const update = useUpdateFormatProfile();
  const del = useDeleteFormatProfile();
  const [editing, setEditing] = useState<FormatProfile | null>(null);
  const [creating, setCreating] = useState(false);

  const onSetDefault = (p: FormatProfile) => {
    update.mutate(
      { id: p.id, patch: { is_default: true } },
      { onSuccess: () => toast.success(`"${p.name}" set as default for ${p.vertical}`) },
    );
  };

  const onDuplicate = (p: FormatProfile) => {
    create.mutate(
      {
        name: `${p.name} (copy)`,
        vertical: p.vertical,
        font: p.font,
        size_pt: p.size_pt,
        margins_in: p.margins_in,
        line_spacing: p.line_spacing,
        page_number_format: p.page_number_format,
        file_name_pattern: p.file_name_pattern,
        header_html: p.header_html,
        footer_html: p.footer_html,
        notes: p.notes,
        volume_page_limits: p.volume_page_limits,
        is_default: false,
      },
      { onSuccess: () => toast.success("Profile duplicated") },
    );
  };

  const onDelete = (p: FormatProfile) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    del.mutate(p.id, {
      onSuccess: () => toast.success("Profile deleted"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Format profiles</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Buyer-specific page setup applied when compiling proposals. One profile per vertical can be marked default.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New profile
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No format profiles yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Font / size</TableHead>
                <TableHead>Margins</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{p.vertical}</Badge></TableCell>
                  <TableCell className="text-sm">{p.font} / {p.size_pt}pt</TableCell>
                  <TableCell className="text-sm">{p.margins_in}" · {p.line_spacing}x</TableCell>
                  <TableCell>
                    {p.is_default ? (
                      <Badge className="gap-1"><Star className="h-3 w-3" /> Default</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => onSetDefault(p)} disabled={update.isPending}>
                        <StarOff className="h-3.5 w-3.5 mr-1" /> Set default
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDuplicate(p)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {(creating || editing) && (
        <FormatProfileEditor
          profile={editing}
          open={creating || !!editing}
          onOpenChange={(open) => {
            if (!open) { setCreating(false); setEditing(null); }
          }}
        />
      )}
    </Card>
  );
}
