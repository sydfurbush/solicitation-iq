## Add `federal_transition_assistance` lens preset

Add a new federal-family preset to `src/features/clients/lib/lensPresets.ts` for vendors serving the Federal Transition Assistance Program (TAP) ecosystem — workforce transition, employment readiness, counseling, and training for separating service members, veterans, and federal employees.

### File touched
- `src/features/clients/lib/lensPresets.ts` — append one entry to `FEDERAL_PRESETS`

No DB migration, no UI changes — `getPreset()` and the AI Lens dropdown read this array directly.

### Preset content

```ts
{
  key: "federal_transition_assistance",
  label: "Federal Transition Assistance (TAP)",
  description: "DoD TAP, VA VR&E, DOL VETS — transition counseling, employment workshops, vocational rehab, career readiness.",
  family: "federal",
  naics_codes: [
    "611430", // Professional & Management Development Training (TAP workshops)
    "624310", // Vocational Rehabilitation Services (VR&E)
    "541612", // HR Consulting
    "611710", // Educational Support Services
    "624190", // Other Individual & Family Services
  ],
  psc_codes: [
    "U008", // Training/Curriculum Development
    "U099", // Other Education & Training
    "R499", // Support – Professional: Other
    "B505", // Special Studies – Manpower
  ],
  set_asides: ["SDVOSB", "VOSB", "8(a)", "WOSB"],
  agencies_focus: [
    "DoD Transition Assistance Program (TAP)",
    "Department of Labor – VETS",
    "Department of Veterans Affairs – VR&E",
    "Military Departments (Army SFL-TAP, Navy TAP, USAF TAP, USMC TRP)",
    "Department of Homeland Security (USCG TAP)",
    "OPM (federal workforce transition)",
  ],
  contract_vehicles: [
    "GSA HCaTS / HCaTS SB (Pools 1 & 2)",
    "OASIS+ (Human Capital domain)",
    "GSA MAS 541612 / 611430",
    "VA T4NG (training task orders)",
    "SFL-TAP IDIQ (Army)",
  ],
  compliance_frameworks: [
    "Section 508",
    "FAR 52.222-50 (Trafficking)",
    "FAR 52.222-54 (E-Verify)",
    "Service Contract Act (SCA) / Wage Determinations",
    "DoDI 1332.35 (Transition Assistance)",
    "VOW Act / Veterans Opportunity to Work",
    "FERPA (when handling participant records)",
    "Privacy Act / PII safeguards",
  ],
  discriminators: [
    {
      title: "DoDI 1332.35-aligned curriculum library",
      evidence: "Modular workshops mapped to TAP core, two-day, and CRS tracks",
      proof_point: "Delivered at 10+ installations with >90% participant satisfaction",
    },
    {
      title: "Credentialed counselor bench (GCDF / NCDA)",
      evidence: "Career counselors with veteran-serving experience",
      proof_point: "Average 8 yrs counseling tenure; bilingual coverage",
    },
    {
      title: "Outcome tracking with VETS / DOL reporting cadence",
      evidence: "Integrated CRM + LMS with 30/60/180-day employment follow-up",
      proof_point: "Documented placement rate above DOL VETS benchmarks",
    },
  ],
  acronym_glossary: {
    TAP: "Transition Assistance Program",
    "SFL-TAP": "Soldier for Life – Transition Assistance Program (Army)",
    "VR&E": "Veteran Readiness and Employment (VA Chapter 31)",
    VETS: "Veterans' Employment and Training Service (DOL)",
    CRS: "Career Readiness Standards",
    DoDI: "Department of Defense Instruction",
    GCDF: "Global Career Development Facilitator",
    SCA: "Service Contract Act",
  },
  always_flag: [
    { rule: "Service Contract Act wage determinations apply", reason: "Direct labor pricing must use SCA WD rates by locality" },
    { rule: "On-installation delivery requirements", reason: "Triggers base access, background checks, and CAC/RAPIDS coordination" },
    { rule: "Section 508 conformance for digital curriculum", reason: "Required for any LMS / e-learning deliverable" },
    { rule: "PII handling of participant records", reason: "Privacy Act safeguards and breach reporting obligations" },
  ],
  tone_voice: "consultative",
  reading_level: 12,
}
```

### Notes
- Inserted alphabetically/contextually after `professional_services` in `FEDERAL_PRESETS`.
- No changes to types, dropdowns, or `isUtilityPreset` logic — it's a federal-family preset and behaves like the existing six.
- Users on the AI Lens tab will immediately see "Federal Transition Assistance (TAP)" in the Preset dropdown.