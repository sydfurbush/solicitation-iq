// Pure helpers for outline volumes. No imports: usable from edge functions,
// the frontend and Vitest.

/**
 * Volumes used for internal tracking (submission checklists, evaluation notes,
 * post-award terms). They hold requirements in the outline but must never be
 * compiled into the submitted proposal. Convention: the volume name starts
 * with "Internal".
 */
export function isInternalVolume(volume: string | null | undefined): boolean {
  return /^\s*internal\b/i.test(volume ?? "");
}
