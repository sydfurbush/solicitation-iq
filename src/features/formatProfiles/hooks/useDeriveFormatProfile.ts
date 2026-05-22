import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DerivedFormatProfile {
  font?: string;
  size_pt?: number;
  margins_in?: number;
  line_spacing?: number;
  page_number_format?: string;
  file_name_pattern?: string;
  volume_page_limits?: Record<string, number | null>;
  notes?: string;
}

export interface DeriveFormatResponse {
  profile: DerivedFormatProfile;
  citations: Record<string, { quote?: string; l_reference?: string }>;
  unresolved: string[];
  confidence: number | null;
  sections_considered: number;
}

export function useDeriveFormatProfile(solicitationId: string | undefined) {
  return useMutation({
    mutationFn: async (): Promise<DeriveFormatResponse> => {
      if (!solicitationId) throw new Error("Missing solicitationId");
      const { data, error } = await supabase.functions.invoke("extract-format-profile", {
        body: { solicitationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as DeriveFormatResponse;
    },
  });
}
