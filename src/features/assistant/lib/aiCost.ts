// USD prices per 1M tokens. Approximate published list prices; keep in sync as needed.
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "google/gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "google/gemini-2.5-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "google/gemini-3-flash-preview": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "openai/gpt-5": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "openai/gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0 },
  "openai/gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "claude-sonnet-4-5": { inputPer1M: 3.0, outputPer1M: 15.0 },
};

export function estimateCost(args: {
  model: string | null | undefined;
  tokensIn: number;
  tokensOut: number;
}): { usd: number; unknownPricing: boolean } {
  const key = (args.model ?? "").trim();
  const price = PRICING[key];
  if (!price) return { usd: 0, unknownPricing: true };
  const usd =
    (args.tokensIn / 1_000_000) * price.inputPer1M +
    (args.tokensOut / 1_000_000) * price.outputPer1M;
  return { usd, unknownPricing: false };
}

export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
