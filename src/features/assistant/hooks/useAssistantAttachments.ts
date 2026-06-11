import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AssistantAttachment = {
  id: string;
  thread_id: string;
  message_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: "photo" | "doc";
  created_at: string;
};

/** Fetch all photo attachments for a thread, grouped by message_id. */
export function useAssistantAttachments(threadId: string | undefined) {
  return useQuery({
    queryKey: ["assistant_attachments", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_attachments")
        .select("*")
        .eq("thread_id", threadId!)
        .eq("kind", "photo")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as AssistantAttachment[];
      const byMessage = new Map<string, AssistantAttachment[]>();
      for (const r of rows) {
        if (!r.message_id) continue;
        const list = byMessage.get(r.message_id) ?? [];
        list.push(r);
        byMessage.set(r.message_id, list);
      }
      return { rows, byMessage };
    },
  });
}

/** In-memory signed-URL cache shared across hook instances. */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export function useSignedAttachmentUrl(storagePath: string | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!storagePath) return null;
    const hit = urlCache.get(storagePath);
    return hit && hit.expiresAt > Date.now() ? hit.url : null;
  });
  const ref = useRef(storagePath);
  ref.current = storagePath;

  useEffect(() => {
    if (!storagePath) return;
    const hit = urlCache.get(storagePath);
    if (hit && hit.expiresAt > Date.now()) {
      setUrl(hit.url);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from("assistant-attachments")
        .createSignedUrl(storagePath, 300);
      if (cancelled || ref.current !== storagePath) return;
      if (error || !data?.signedUrl) {
        setUrl(null);
        return;
      }
      urlCache.set(storagePath, { url: data.signedUrl, expiresAt: Date.now() + 4 * 60_000 });
      setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return url;
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_PER_MESSAGE = 4;
const MAX_BYTES = 8 * 1024 * 1024;

export type PhotoValidationError = { kind: "too_many" | "too_large" | "bad_type"; file?: File };

export function validatePhotos(existing: File[], incoming: File[]): { accepted: File[]; errors: PhotoValidationError[] } {
  const errors: PhotoValidationError[] = [];
  const accepted: File[] = [];
  for (const f of incoming) {
    if (existing.length + accepted.length >= MAX_PER_MESSAGE) {
      errors.push({ kind: "too_many" });
      break;
    }
    if (f.size > MAX_BYTES) {
      errors.push({ kind: "too_large", file: f });
      continue;
    }
    const type = (f.type || "").toLowerCase();
    if (!ALLOWED_MIME.includes(type) && !type.startsWith("image/")) {
      errors.push({ kind: "bad_type", file: f });
      continue;
    }
    accepted.push(f);
  }
  return { accepted, errors };
}

/** Upload a single photo to storage + insert assistant_attachments row. Returns the new attachment id. */
export async function uploadAssistantPhoto(args: {
  file: File;
  threadId: string;
  userId: string;
}): Promise<string> {
  const ext = (() => {
    const fromName = args.file.name.split(".").pop()?.toLowerCase();
    if (fromName && fromName.length <= 5) return fromName;
    const fromMime = args.file.type.split("/").pop()?.toLowerCase();
    return fromMime || "jpg";
  })();
  const uuid = crypto.randomUUID();
  const path = `${args.userId}/${args.threadId}/${uuid}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("assistant-attachments")
    .upload(path, args.file, { contentType: args.file.type || "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  const { data: row, error: insErr } = await supabase
    .from("assistant_attachments")
    .insert({
      thread_id: args.threadId,
      storage_path: path,
      file_name: args.file.name,
      mime_type: args.file.type || null,
      size_bytes: args.file.size,
      kind: "photo",
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (insErr || !row?.id) throw insErr ?? new Error("Failed to record attachment");
  return row.id as string;
}

export function useInvalidateAttachments() {
  const qc = useQueryClient();
  return (threadId: string) => qc.invalidateQueries({ queryKey: ["assistant_attachments", threadId] });
}
