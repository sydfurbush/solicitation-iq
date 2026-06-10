// Persona + slash-command catalog. Shared between client UI and edge function.
// To keep them in sync, the edge function re-declares the same identifiers
// (Deno can't import from /src). Update both if you change keys.

export type PersonaKey =
  | "capture_manager"
  | "proposal_writer"
  | "compliance_reviewer"
  | "pricing_analyst"
  | "executive"
  | "plain_english";

export type Persona = {
  key: PersonaKey;
  label: string;
  shortLabel: string;
  description: string;
  /** Appended to the system prompt when this persona is active. */
  systemFragment: string;
};

export const PERSONAS: Persona[] = [
  {
    key: "capture_manager",
    label: "Capture Manager",
    shortLabel: "Capture",
    description: "Strategy, win themes, competitive positioning, teaming.",
    systemFragment:
      "Adopt the perspective of a senior Capture Manager. Emphasize win strategy, discriminators, competitive position, teaming gaps, and go/no-go signals.",
  },
  {
    key: "proposal_writer",
    label: "Proposal Writer",
    shortLabel: "Writer",
    description: "Section drafting, themes, narrative, persuasion.",
    systemFragment:
      "Adopt the perspective of a senior Proposal Writer. Focus on section content, narrative flow, win themes woven in, and persuasive language. Quote the solicitation when relevant.",
  },
  {
    key: "compliance_reviewer",
    label: "Compliance Reviewer",
    shortLabel: "Compliance",
    description: "Section L/M, requirement traceability, page limits, format.",
    systemFragment:
      "Adopt the perspective of a strict Compliance Reviewer. Map answers to Section L/M, identify shall-statements, flag format/page-limit risks. Always cite the exact section.",
  },
  {
    key: "pricing_analyst",
    label: "Pricing Analyst",
    shortLabel: "Pricing",
    description: "Cost, BOEs, labor categories, escalation.",
    systemFragment:
      "Adopt the perspective of a Pricing Analyst. Focus on cost structure, labor categories, basis-of-estimate signals, escalation, ceilings, and price-to-win considerations.",
  },
  {
    key: "executive",
    label: "Executive Summary",
    shortLabel: "Exec",
    description: "High-level summaries for leadership.",
    systemFragment:
      "Adopt the perspective of an executive briefer. Lead with the bottom line, follow with 3-5 bullets, end with the single most important risk and opportunity.",
  },
  {
    key: "plain_english",
    label: "Plain English",
    shortLabel: "Plain",
    description: "No jargon, short sentences, simple words.",
    systemFragment:
      "Use plain English. Avoid jargon and acronyms; if you must use one, define it. Prefer short sentences and concrete examples.",
  },
];

export const PERSONA_BY_KEY: Record<PersonaKey, Persona> = PERSONAS.reduce(
  (acc, p) => ({ ...acc, [p.key]: p }),
  {} as Record<PersonaKey, Persona>,
);

export function getPersona(key: string | null | undefined): Persona {
  return PERSONA_BY_KEY[(key as PersonaKey) ?? "capture_manager"] ?? PERSONAS[0];
}

// ---------------------------------------------------------------------------
// Slash commands

export type SlashCommand = {
  cmd: string;
  label: string;
  description: string;
  /** When set, message is intercepted client-side or edge-side and handled as a directive. */
  handler: "remember" | "forget" | "summarize" | "cite" | "risks" | "requirements" | "clear";
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/remember", label: "Remember", description: "Save a durable fact: /remember our NAICS is 541512", handler: "remember" },
  { cmd: "/forget", label: "Forget", description: "Remove a saved fact: /forget NAICS", handler: "forget" },
  { cmd: "/summarize", label: "Summarize", description: "Summarize the solicitation so far", handler: "summarize" },
  { cmd: "/cite", label: "Cite", description: "Find citations for a topic: /cite incumbent transition", handler: "cite" },
  { cmd: "/risks", label: "Risks", description: "Walk through current risks", handler: "risks" },
  { cmd: "/requirements", label: "Requirements", description: "List the critical requirements", handler: "requirements" },
  { cmd: "/clear-context", label: "Clear context", description: "Forget the conversation, keep memory + thread", handler: "clear" },
];

export function parseSlashCommand(message: string): { cmd: SlashCommand; rest: string } | null {
  const m = message.trim().match(/^(\/[a-z\-]+)(\s+(.*))?$/i);
  if (!m) return null;
  const cmd = SLASH_COMMANDS.find((c) => c.cmd.toLowerCase() === m[1].toLowerCase());
  if (!cmd) return null;
  return { cmd, rest: (m[3] ?? "").trim() };
}
