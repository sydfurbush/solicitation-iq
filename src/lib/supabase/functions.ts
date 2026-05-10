import { supabase } from "@/integrations/supabase/client";

async function invoke<T = unknown>(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}

export type ProcessDocumentResult = {
  ok: boolean;
  sections: number;
  pages: number | null;
  chars: number;
};

export type ExtractEntitiesResult = { ok: boolean; entities: number };

export function invokeProcessDocument(documentId: string) {
  return invoke<ProcessDocumentResult>("process-document", { documentId });
}

export function invokeExtractEntities(documentId: string) {
  return invoke<ExtractEntitiesResult>("extract-entities", { documentId });
}

export function invokeAnalyzeSolicitation(solicitationId: string) {
  return invoke<{ ok: boolean }>("analyze-solicitation", { solicitationId });
}
