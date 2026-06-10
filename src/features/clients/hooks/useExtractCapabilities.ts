import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExtractedCapabilities = {
  core_capabilities?: string;
  differentiators?: string;
  past_performance?: string;
  key_personnel?: string;
  teaming_partners?: string;
  notes?: string;
  naics_codes?: string[];
  certifications?: string[];
};

export type ProfileHints = {
  psc_codes?: string[];
  agencies_focus?: string[];
  contract_vehicles?: string[];
  compliance_frameworks?: string[];
  service_categories?: string[];
};

export interface CapabilityExtraction {
  capabilities: ExtractedCapabilities;
  profile_hints?: ProfileHints;
  source_excerpts?: Record<string, string>;
  confidence?: Record<string, number>;
}

interface ExtractInput {
  clientId: string;
  text?: string;
  file?: File;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function useExtractCapabilities() {
  return useMutation({
    mutationFn: async (input: ExtractInput): Promise<{ draft: CapabilityExtraction; meta: { sourceChars: number; truncated: boolean; sourceKind: string } }> => {
      const body: Record<string, unknown> = { clientId: input.clientId };
      if (input.file) {
        body.fileBase64 = await fileToBase64(input.file);
        body.fileName = input.file.name;
        body.mimeType = input.file.type || undefined;
      } else if (input.text?.trim()) {
        body.text = input.text;
      } else {
        throw new Error("Provide a file or paste text.");
      }
      const { data, error } = await supabase.functions.invoke("extract-capabilities", { body });
      if (error) {
        const msg = (data as { error?: string } | null)?.error ?? error.message;
        throw new Error(msg || "Extraction failed");
      }
      const payload = data as { draft: CapabilityExtraction; meta: { sourceChars: number; truncated: boolean; sourceKind: string } };
      if (!payload?.draft?.capabilities) throw new Error("AI returned no capabilities");
      return payload;
    },
  });
}
