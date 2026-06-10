// Lightweight embeddings client for Lovable AI Gateway (Google text-embedding-004, 768 dims).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "google/gemini-embedding-001";
export const EMBEDDING_DIMS = 768;

export class EmbeddingsUnavailableError extends Error {
  constructor(msg: string) { super(msg); this.name = "EmbeddingsUnavailableError"; }
}

let embeddingsDisabled = false;

export function embeddingsAvailable(): boolean {
  return !embeddingsDisabled;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  if (!texts.length) return [];
  if (embeddingsDisabled) throw new EmbeddingsUnavailableError("embeddings endpoint unavailable for this workspace");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: EMBEDDING_DIMS }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Workspace doesn't have embeddings entitlement — disable for the rest of this invocation.
    if (res.status === 404 || /route_not_found|not available/i.test(body)) {
      embeddingsDisabled = true;
      throw new EmbeddingsUnavailableError(`embeddings endpoint unavailable: ${body.slice(0, 200)}`);
    }
    throw new Error(`embeddings failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
  const sorted = [...(json.data ?? [])].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  try {
    const [v] = await embedTexts([text.slice(0, 8000)]);
    return v ?? null;
  } catch (e) {
    console.error("[embedQuery] failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Splits text into ~targetChars chunks with `overlap` characters of overlap.
 * Splits on paragraph/sentence boundaries when possible.
 */
export function chunkText(text: string, targetChars = 800, overlap = 100): string[] {
  const clean = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= targetChars) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + targetChars, clean.length);
    if (end < clean.length) {
      // Try to backtrack to a paragraph or sentence boundary.
      const slice = clean.slice(i, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
      );
      if (breakAt > targetChars * 0.5) end = i + breakAt + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks.filter((c) => c.length > 0);
}
