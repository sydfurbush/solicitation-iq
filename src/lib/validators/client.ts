import { z } from "zod";

export const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance & Banking",
  "Government",
  "Defense & Aerospace",
  "Energy & Utilities",
  "Manufacturing",
  "Transportation & Logistics",
  "Education",
  "Professional Services",
  "Telecommunications",
  "Retail & Consumer",
  "Construction & Engineering",
  "Non-Profit",
  "Other",
] as const;

export const ACCESS_LEVELS = ["full", "summary", "restricted"] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .refine(
    (v) => {
      if (!v) return true;
      try {
        new URL(v.startsWith("http") ? v : `https://${v}`);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Enter a valid URL" }
  );

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "Enter a valid email",
  });

export const clientSchema = z.object({
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(120),
  industry: z.string().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  website: optionalUrl,
  primary_contact_name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  primary_contact_email: optionalEmail,
  access_level: z.enum(ACCESS_LEVELS).default("summary"),
  notes: z
    .string()
    .max(5000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  logo_url: z.string().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
});

export type ClientInput = z.infer<typeof clientSchema>;
