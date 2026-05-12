import { z } from "zod";

export const APPROVAL_NOTE_MAX = 500;
export const APPROVAL_NOTE_REQUIRED_MIN = 5;

/** Optional decision note (approve, request approval, reopen). */
export const optionalNoteSchema = z
  .string()
  .trim()
  .max(APPROVAL_NOTE_MAX, `Keep it under ${APPROVAL_NOTE_MAX} characters`)
  .optional()
  .or(z.literal(""));

/** Required decision note (request changes). */
export const requiredNoteSchema = z
  .string()
  .trim()
  .min(APPROVAL_NOTE_REQUIRED_MIN, `Please add at least ${APPROVAL_NOTE_REQUIRED_MIN} characters explaining what needs to change`)
  .max(APPROVAL_NOTE_MAX, `Keep it under ${APPROVAL_NOTE_MAX} characters`);

export function validateNote(value: string, required: boolean): string | null {
  const schema = required ? requiredNoteSchema : optionalNoteSchema;
  const r = schema.safeParse(value);
  return r.success ? null : r.error.issues[0]?.message ?? "Invalid note";
}
