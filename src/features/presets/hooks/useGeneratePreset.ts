import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PresetContent } from "./usePresets";

export interface PresetReasoning {
  naics_codes?: string;
  psc_codes?: string;
  agencies_focus?: string;
  contract_vehicles?: string;
  compliance_frameworks?: string;
  discriminators?: string;
  always_flag?: string;
}

export interface GeneratedPresetDraft {
  label: string;
  description: string;
  family: "federal" | "utility";
  content: PresetContent;
  reasoning: PresetReasoning;
}

export interface GeneratePresetInput {
  category: string;
  family: "federal" | "utility";
  buyers?: string;
  context?: string;
}

export function useGeneratePreset() {
  return useMutation({
    mutationFn: async (input: GeneratePresetInput): Promise<GeneratedPresetDraft> => {
      const { data, error } = await supabase.functions.invoke("generate-preset", { body: input });
      if (error) throw error;
      const draft = (data as { draft?: GeneratedPresetDraft } | null)?.draft;
      if (!draft) throw new Error("AI returned no draft");
      return draft;
    },
    onError: (e: Error) => {
      const msg = e.message || "Generation failed";
      if (msg.includes("429")) toast.error("Rate limit hit. Try again in a moment.");
      else if (msg.includes("402")) toast.error("AI credits exhausted. Add credits in Settings.");
      else toast.error(msg);
    },
  });
}
