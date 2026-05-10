import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  ACCESS_LEVELS,
  INDUSTRIES,
  clientSchema,
  type ClientInput,
} from "@/lib/validators/client";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/features/auth/hooks/useUser";
import { toast } from "@/hooks/use-toast";
import type { ClientRow } from "../hooks/useClients";

interface Props {
  defaultValues?: Partial<ClientRow>;
  onSubmit: (values: ClientInput) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

const ACCESS_LABELS: Record<(typeof ACCESS_LEVELS)[number], string> = {
  full: "Full access",
  summary: "Summary only",
  restricted: "Restricted",
};

export function ClientForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isSubmitting,
}: Props) {
  const { organization } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      industry: defaultValues?.industry ?? undefined,
      website: defaultValues?.website ?? "",
      primary_contact_name: defaultValues?.primary_contact_name ?? "",
      primary_contact_email: defaultValues?.primary_contact_email ?? "",
      access_level: (defaultValues?.access_level as ClientInput["access_level"]) ?? "summary",
      notes: defaultValues?.notes ?? "",
      logo_url: defaultValues?.logo_url ?? "",
    },
  });

  const logoUrl = form.watch("logo_url");
  const name = form.watch("name") || "Client";

  const handleLogoUpload = async (file: File) => {
    if (!organization?.id) {
      toast({ title: "No organization", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${organization.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("client-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
    form.setValue("logo_url", data.publicUrl, { shouldDirty: true });
    setUploading(false);
  };

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16">
              {logoUrl ? <AvatarImage src={logoUrl} alt={name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90"
              aria-label="Upload logo"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload(f);
              }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Upload a square logo. PNG or JPG, ideally under 2MB.
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Acme Defense Corp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Industry</FormLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v || undefined)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an industry" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://acme.com" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="primary_contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary contact name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Doe" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primary_contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary contact email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="jane@acme.com" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="access_level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client access level</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ACCESS_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {ACCESS_LABELS[lvl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Controls how much of the analysis the client can see if invited.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Internal notes about this client..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || form.formState.isSubmitting}>
            {(isSubmitting || form.formState.isSubmitting) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
