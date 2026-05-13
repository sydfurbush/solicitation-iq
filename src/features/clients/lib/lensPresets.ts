// Lens presets — starter values an admin can apply, then edit.

export interface LensPreset {
  key: string;
  label: string;
  description: string;
  naics_codes: string[];
  psc_codes: string[];
  set_asides: string[];
  agencies_focus: string[];
  contract_vehicles: string[];
  compliance_frameworks: string[];
  discriminators: { title: string; evidence: string; proof_point: string }[];
  acronym_glossary: Record<string, string>;
  always_flag: { rule: string; reason: string }[];
  tone_voice: string;
  reading_level: number;
}

export const LENS_PRESETS: LensPreset[] = [
  {
    key: "healthcare_it",
    label: "Healthcare IT",
    description: "VA, HHS, MHS — EHR, interoperability, HIPAA-bound systems.",
    naics_codes: ["541512", "541511", "541519"],
    psc_codes: ["DA01", "DC01", "DE01"],
    set_asides: ["SDVOSB", "8(a)"],
    agencies_focus: ["Department of Veterans Affairs", "HHS", "Defense Health Agency"],
    contract_vehicles: ["VA T4NG", "GSA MAS IT", "CIO-SP4"],
    compliance_frameworks: ["HIPAA", "FedRAMP Moderate", "NIST 800-53", "Section 508", "HL7 FHIR"],
    discriminators: [
      { title: "FHIR-native integration platform", evidence: "Production deployments at 3 VISNs", proof_point: "MHS GENESIS interface library" },
      { title: "PHI-safe AI pipeline", evidence: "ATO with continuous monitoring", proof_point: "OIG audit clean 3 yrs" },
    ],
    acronym_glossary: {
      VISN: "Veterans Integrated Service Network",
      EHR: "Electronic Health Record",
      ATO: "Authority to Operate",
      MHS: "Military Health System",
    },
    always_flag: [
      { rule: "PHI storage outside FedRAMP Moderate boundary", reason: "Disqualifying for VA/MHS work" },
      { rule: "LPTA evaluation criteria", reason: "Healthcare IT rarely succeeds under LPTA" },
    ],
    tone_voice: "consultative",
    reading_level: 12,
  },
  {
    key: "dod_c5isr",
    label: "DoD C5ISR",
    description: "Army, Navy, Air Force C5ISR systems, classified environments.",
    naics_codes: ["541330", "541715", "336413"],
    psc_codes: ["AC12", "AC13", "5810"],
    set_asides: [],
    agencies_focus: ["DoD", "Army", "Navy", "Air Force", "DARPA"],
    contract_vehicles: ["SeaPort-NxG", "OASIS+", "STARS III"],
    compliance_frameworks: ["CMMC L2", "NIST 800-171", "ITAR", "DFARS 252.204-7012"],
    discriminators: [
      { title: "Cleared workforce ready Day 1", evidence: "85% TS/SCI bench", proof_point: "FSO letter on file" },
      { title: "Open-architecture payload designs", evidence: "MOSA-aligned reference architecture", proof_point: "Awards on PEO IEW&S" },
    ],
    acronym_glossary: {
      "C5ISR": "Command, Control, Communications, Computers, Cyber, Intelligence, Surveillance, Reconnaissance",
      MOSA: "Modular Open Systems Approach",
      "TS/SCI": "Top Secret / Sensitive Compartmented Information",
    },
    always_flag: [
      { rule: "Foreign ownership disclosure", reason: "Triggers FOCI mitigation requirements" },
      { rule: "GFE/GFI dependencies", reason: "Schedule risk if government-furnished items slip" },
    ],
    tone_voice: "technical",
    reading_level: 14,
  },
  {
    key: "civilian_it",
    label: "Civilian IT Services",
    description: "Civilian agency IT modernization, cloud, SecDevOps.",
    naics_codes: ["541511", "541512", "541513", "518210"],
    psc_codes: ["DA01", "DA10", "D399"],
    set_asides: ["8(a)", "WOSB", "HUBZone"],
    agencies_focus: ["GSA", "USDA", "Treasury", "DOI", "Education"],
    contract_vehicles: ["Alliant 3", "GSA MAS", "8(a) STARS III"],
    compliance_frameworks: ["FedRAMP Moderate", "NIST 800-53", "FISMA", "Section 508"],
    discriminators: [
      { title: "Zero-trust reference architecture", evidence: "CISA-aligned ZTA pattern library", proof_point: "Two ATOs in 18 mo" },
      { title: "Continuous ATO via DevSecOps", evidence: "SCA-as-code pipeline", proof_point: "30-day ATO renewal" },
    ],
    acronym_glossary: {
      ATO: "Authority to Operate",
      ZTA: "Zero Trust Architecture",
      SCA: "Security Control Assessment",
    },
    always_flag: [
      { rule: "On-prem-only constraints", reason: "Limits cloud-native discriminator" },
      { rule: "Section 889 vendor restrictions", reason: "Supply-chain disqualifier" },
    ],
    tone_voice: "consultative",
    reading_level: 12,
  },
  {
    key: "construction",
    label: "Federal Construction",
    description: "USACE, NAVFAC, GSA PBS — design-build, MILCON.",
    naics_codes: ["236220", "237310", "238210"],
    psc_codes: ["Y1AA", "Y1BA", "Z1AA"],
    set_asides: ["SDVOSB", "HUBZone", "8(a)"],
    agencies_focus: ["USACE", "NAVFAC", "GSA PBS", "VA OCFM"],
    contract_vehicles: ["MATOC", "MACC", "SATOC"],
    compliance_frameworks: ["UFC", "UFGS", "EM 385-1-1", "Davis-Bacon"],
    discriminators: [
      { title: "EMR < 0.7 with zero recordables 24 mo", evidence: "OSHA 300 logs", proof_point: "USACE PPQs avg 4.8" },
      { title: "Self-perform structural + MEP", evidence: "In-house union crews", proof_point: "Schedule reliability 96%" },
    ],
    acronym_glossary: {
      MILCON: "Military Construction",
      EMR: "Experience Modification Rate",
      UFC: "Unified Facilities Criteria",
      MATOC: "Multiple-Award Task Order Contract",
    },
    always_flag: [
      { rule: "Bonding requirement above current capacity", reason: "May require teaming" },
      { rule: "Liquidated damages clause", reason: "Schedule-risk financial exposure" },
    ],
    tone_voice: "formal",
    reading_level: 11,
  },
  {
    key: "professional_services",
    label: "Professional Services / Mgmt Consulting",
    description: "Strategy, program management, financial advisory.",
    naics_codes: ["541611", "541618", "541990"],
    psc_codes: ["R408", "R499", "R707"],
    set_asides: ["8(a)", "WOSB"],
    agencies_focus: ["OMB", "Treasury", "GSA", "DOL"],
    contract_vehicles: ["OASIS+", "GSA MAS PSS", "PACTS III"],
    compliance_frameworks: ["FAR 31", "CAS", "DCAA-compliant accounting"],
    discriminators: [
      { title: "DCAA-approved accounting system", evidence: "ICE submission accepted FY24", proof_point: "Clean DCMA review" },
      { title: "Senior PMP/PgMP bench", evidence: "12 PgMPs on staff", proof_point: "Earned-value reporting under EVMS-validated system" },
    ],
    acronym_glossary: {
      DCAA: "Defense Contract Audit Agency",
      EVMS: "Earned Value Management System",
      PgMP: "Program Management Professional",
    },
    always_flag: [
      { rule: "Cost-reimbursable line items", reason: "Requires DCAA-approved accounting" },
      { rule: "Key personnel commitment durations", reason: "Affects PM availability planning" },
    ],
    tone_voice: "consultative",
    reading_level: 12,
  },
  {
    key: "rd_innovation",
    label: "R&D / Innovation",
    description: "DARPA, AFRL, ARL — SBIR/STTR, OTAs, prototypes.",
    naics_codes: ["541713", "541714", "541715"],
    psc_codes: ["AC11", "AC12", "AR11"],
    set_asides: ["SBIR-eligible"],
    agencies_focus: ["DARPA", "AFRL", "ARL", "NSF", "DOE"],
    contract_vehicles: ["OTA", "SBIR Phase II/III", "BAA"],
    compliance_frameworks: ["NIST 800-171", "ITAR", "EAR"],
    discriminators: [
      { title: "Patent portfolio in adjacent tech", evidence: "8 issued US patents", proof_point: "Phase III transitions on 3 SBIRs" },
      { title: "University research consortium", evidence: "MOUs with 4 R1 schools", proof_point: "Joint publications in IEEE" },
    ],
    acronym_glossary: {
      OTA: "Other Transaction Authority",
      BAA: "Broad Agency Announcement",
      TRL: "Technology Readiness Level",
    },
    always_flag: [
      { rule: "Data rights / IP assertion clauses", reason: "Affects commercialization runway" },
      { rule: "TRL maturity gate misalignment", reason: "May require risk-adjustment" },
    ],
    tone_voice: "technical",
    reading_level: 14,
  },
];

export function getPreset(key: string | null | undefined): LensPreset | undefined {
  if (!key) return undefined;
  return LENS_PRESETS.find((p) => p.key === key);
}
