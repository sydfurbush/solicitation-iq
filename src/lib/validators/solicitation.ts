import { z } from "zod";

export const AGENCY_TYPES = ["Federal", "State", "Local", "Commercial"] as const;
export const CONTRACT_TYPES = ["FFP", "T&M", "Cost-Plus", "IDIQ", "BPA", "Other"] as const;

export const SOLICITATION_STATUSES = [
  "intake",
  "processing",
  "phase_1_complete",
  "phase_2_active",
  "phase_3_active",
  "phase_4_active",
  "complete",
  "archived",
] as const;
export type SolicitationStatus = (typeof SOLICITATION_STATUSES)[number];

export const PHASES = [
  "phase_1_initial",
  "phase_2_deep_dive",
  "phase_3_outline",
  "phase_4_win_themes",
] as const;
export type PhaseType = (typeof PHASES)[number];

const optStr = z
  .string()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v.trim() : undefined));

const optDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optNum = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

export const solicitationBasicSchema = z.object({
  client_id: z.string().uuid({ message: "Select a client" }),
  title: z.string().trim().min(2, { message: "Title is required" }).max(300),
  solicitation_number: optStr,
  issuing_agency: optStr,
  agency_type: z.enum(AGENCY_TYPES).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  contract_type: z.enum(CONTRACT_TYPES).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
});

export const solicitationDatesSchema = z
  .object({
    release_date: optDate,
    questions_due_date: optDate,
    proposal_due_date: optDate,
    expected_award_date: optDate,
    period_of_performance_start: optDate,
    period_of_performance_end: optDate,
  })
  .refine(
    (d) =>
      !d.questions_due_date ||
      !d.proposal_due_date ||
      new Date(d.questions_due_date) <= new Date(d.proposal_due_date),
    { path: ["questions_due_date"], message: "Questions due must be on or before proposal due" }
  );

export const solicitationFinancialsSchema = z
  .object({
    estimated_value_low: optNum,
    estimated_value_high: optNum,
    has_incumbent: z.boolean().default(false),
    incumbent_name: optStr,
    incumbent_contract_number: optStr,
    incumbent_contract_value: optNum,
    incumbent_performance_notes: z
      .string()
      .max(5000)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
  })
  .refine(
    (d) =>
      d.estimated_value_low === undefined ||
      d.estimated_value_high === undefined ||
      d.estimated_value_low <= d.estimated_value_high,
    { path: ["estimated_value_high"], message: "High must be ≥ low" }
  );

export const solicitationTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  notes: z
    .string()
    .max(5000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});

export const solicitationFullSchema = solicitationBasicSchema
  .merge(solicitationDatesSchema.innerType())
  .merge(solicitationFinancialsSchema.innerType())
  .merge(solicitationTagsSchema);

export type SolicitationBasic = z.infer<typeof solicitationBasicSchema>;
export type SolicitationDates = z.infer<typeof solicitationDatesSchema>;
export type SolicitationFinancials = z.infer<typeof solicitationFinancialsSchema>;
export type SolicitationTags = z.infer<typeof solicitationTagsSchema>;
export type SolicitationFullInput = SolicitationBasic &
  SolicitationDates &
  SolicitationFinancials &
  SolicitationTags;
