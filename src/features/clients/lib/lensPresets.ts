// Lens presets — starter values an admin can apply, then edit.
//
// Two families:
//   1. Federal contracting presets (original).
//   2. Utility-supplier presets (additive) — for clients selling into the
//      utility industry across IT/OT, engineering, construction, EPC,
//      staffing, services, equipment, etc.
//
// Utility presets seed `service_categories`, `regulatory_bodies`,
// `delivery_models` and other utility-specific fields. Federal presets
// leave those empty and behave exactly as before.

export interface LensPreset {
  key: string;
  label: string;
  description: string;
  family?: "federal" | "utility";
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

  // Utility-supplier optional fields (ignored by federal presets).
  service_categories?: string[];
  regulatory_bodies?: string[];
  iso_rto?: string;
  delivery_models?: string[];
  service_territory?: { states?: string[]; counties?: string[]; divisions?: string[] };
  buyer_relationships?: { buyers?: string[]; prequal_platforms?: string[]; msas?: string[] };
  safety_metrics?: { trir?: number | null; dart?: number | null; emr?: number | null; mutual_aid?: string };
  workforce_capacity?: Record<string, number | string>;
  diversity_tiers?: { certifications?: string[]; utility_tier_ids?: string[] };
  bonding?: { single?: string; aggregate?: string; coverages?: string[] };
  labor_posture?: { unions?: string[]; prevailing_wage?: boolean; pla_experience?: boolean };
  storm_response?: { mutual_aid_groups?: string[]; sla?: string; staging?: string };
  tech_stack?: Record<string, string>;
}

// Service category vocabulary (used by UI multi-select and lens prompt).
export const UTILITY_SERVICE_CATEGORIES = [
  "IT & OT",
  "Engineering",
  "Electric Construction (T&D / Substations)",
  "Gas Construction (Distribution / Transmission)",
  "Water / Wastewater Construction",
  "Civil Construction (Sitework / Paving / ROW)",
  "EPC / Renewables (Solar / Wind / BESS / EV)",
  "Staffing & Workforce",
  "Professional Services / Consulting",
  "Field Services & O&M",
  "Equipment & Materials",
] as const;

export const UTILITY_DELIVERY_MODELS = [
  "MSA / Alliance",
  "EPC",
  "Design-Build",
  "T&M",
  "Unit-Price",
  "MSP / VMS",
  "SOW Staffing",
  "Fixed-Fee Consulting",
  "Equipment Supply with Stocking",
] as const;

export const UTILITY_ISO_RTOS = [
  "PJM", "MISO", "ERCOT", "CAISO", "SPP", "NYISO", "ISO-NE", "SERC (non-RTO)", "WECC (non-RTO)",
] as const;

// ============================================================
// FEDERAL PRESETS (unchanged)
// ============================================================

const FEDERAL_PRESETS: LensPreset[] = [
  {
    key: "healthcare_it",
    label: "Healthcare IT",
    description: "VA, HHS, MHS — EHR, interoperability, HIPAA-bound systems.",
    family: "federal",
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
    acronym_glossary: { VISN: "Veterans Integrated Service Network", EHR: "Electronic Health Record", ATO: "Authority to Operate", MHS: "Military Health System" },
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
    family: "federal",
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
    acronym_glossary: { "C5ISR": "Command, Control, Communications, Computers, Cyber, Intelligence, Surveillance, Reconnaissance", MOSA: "Modular Open Systems Approach", "TS/SCI": "Top Secret / Sensitive Compartmented Information" },
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
    family: "federal",
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
    acronym_glossary: { ATO: "Authority to Operate", ZTA: "Zero Trust Architecture", SCA: "Security Control Assessment" },
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
    family: "federal",
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
    acronym_glossary: { MILCON: "Military Construction", EMR: "Experience Modification Rate", UFC: "Unified Facilities Criteria", MATOC: "Multiple-Award Task Order Contract" },
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
    family: "federal",
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
    acronym_glossary: { DCAA: "Defense Contract Audit Agency", EVMS: "Earned Value Management System", PgMP: "Program Management Professional" },
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
    family: "federal",
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
    acronym_glossary: { OTA: "Other Transaction Authority", BAA: "Broad Agency Announcement", TRL: "Technology Readiness Level" },
    always_flag: [
      { rule: "Data rights / IP assertion clauses", reason: "Affects commercialization runway" },
      { rule: "TRL maturity gate misalignment", reason: "May require risk-adjustment" },
    ],
    tone_voice: "technical",
    reading_level: 14,
  },
];

// ============================================================
// UTILITY SUPPLIER PRESETS (additive)
// Buyers: IOUs, municipal utilities, co-ops, JPAs, ISOs/RTOs,
// public power authorities. Suppliers can be in any lane.
// ============================================================

const UTILITY_PRESETS: LensPreset[] = [
  {
    key: "utility_it_ot",
    label: "Utility — IT & OT",
    description: "Enterprise IT, ADMS/OMS/DERMS, SCADA, AMI head-end, GIS, billing/CIS, OT cybersecurity.",
    family: "utility",
    service_categories: ["IT & OT"],
    naics_codes: ["541512", "541511", "541513", "518210", "541519"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Municipal Utilities", "Electric Cooperatives", "Public Power Authorities", "ISO/RTO"],
    contract_vehicles: ["MSA", "Alliance Contract", "EPRI Member Programs"],
    compliance_frameworks: ["NERC CIP", "NIST 800-82", "NIST 800-53", "TSA Security Directive (Pipeline)", "SOC 2 Type II", "ISO 27001"],
    regulatory_bodies: ["FERC", "NERC", "State PUCs"],
    delivery_models: ["MSA / Alliance", "Fixed-Fee Consulting", "T&M", "SOW Staffing"],
    discriminators: [
      { title: "OT-segmented Purdue-aligned reference architecture", evidence: "Deployments across 2+ ISO regions", proof_point: "Zero CIP audit findings 3 yrs" },
      { title: "Vendor-neutral ADMS/OMS integration", evidence: "Schneider/GE/OSI experience", proof_point: "Cutover within outage window" },
    ],
    acronym_glossary: {
      ADMS: "Advanced Distribution Management System",
      OMS: "Outage Management System",
      DERMS: "Distributed Energy Resource Management System",
      AMI: "Advanced Metering Infrastructure",
      "NERC CIP": "NERC Critical Infrastructure Protection standards",
      BES: "Bulk Electric System",
    },
    always_flag: [
      { rule: "NERC CIP medium/high impact BES Cyber System scope", reason: "Triggers strict access, training, and asset-mgmt obligations" },
      { rule: "OT/ICS without NIST 800-82 alignment", reason: "Cyber risk and likely DQ in modern utility scorecards" },
      { rule: "Required prequal platform (ISN/Avetta/Veriforce/Browz) not held", reason: "Hard-stop for many IOUs" },
    ],
    tone_voice: "technical",
    reading_level: 13,
  },
  {
    key: "utility_engineering",
    label: "Utility — Engineering Services",
    description: "PE-led T&D, substation, gas integrity, hydraulic, civil/structural, environmental.",
    family: "utility",
    service_categories: ["Engineering"],
    naics_codes: ["541330", "541310", "541370", "541620"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Municipal Utilities", "Electric Cooperatives", "Water Authorities"],
    contract_vehicles: ["MSA", "Alliance Contract", "Task-Order Engineering"],
    compliance_frameworks: ["IEEE 1547", "NESC", "ASME B31.8", "API 1173", "AWWA M-series", "PHMSA 192/195"],
    regulatory_bodies: ["FERC", "NERC", "PHMSA", "State PUCs", "EPA"],
    delivery_models: ["MSA / Alliance", "Fixed-Fee Consulting", "Unit-Price", "T&M"],
    discriminators: [
      { title: "Multi-state PE registration coverage", evidence: "PE bench across 30+ jurisdictions", proof_point: "Stamped deliverables on time" },
      { title: "Integrated GIS-PLS-CAD workflow", evidence: "Esri + Bentley OpenUtilities", proof_point: "Reduced rework by 40%" },
    ],
    acronym_glossary: {
      PE: "Professional Engineer",
      NESC: "National Electrical Safety Code",
      PHMSA: "Pipeline and Hazardous Materials Safety Administration",
      DIMP: "Distribution Integrity Management Program",
      TIMP: "Transmission Integrity Management Program",
    },
    always_flag: [
      { rule: "PE stamp required in jurisdictions where client lacks registration", reason: "Cannot deliver compliant package" },
      { rule: "PHMSA-regulated scope without DIMP/TIMP plan reference", reason: "Likely scope/cost gap" },
    ],
    tone_voice: "technical",
    reading_level: 13,
  },
  {
    key: "utility_electric_construction",
    label: "Utility — Electric Construction (T&D / Substations)",
    description: "Overhead/underground T&D, substation construction, storm response.",
    family: "utility",
    service_categories: ["Electric Construction (T&D / Substations)"],
    naics_codes: ["237130", "238210"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Municipal Utilities", "Electric Cooperatives"],
    contract_vehicles: ["MSA", "Alliance", "Unit-Price Book", "EEI Mutual-Aid"],
    compliance_frameworks: ["NESC", "OSHA 1910.269", "NFPA 70E", "EEI Safety Manual"],
    regulatory_bodies: ["NERC", "State PUCs", "OSHA"],
    delivery_models: ["MSA / Alliance", "Unit-Price", "T&M", "Design-Build"],
    storm_response: { mutual_aid_groups: ["RMAG", "SMAG", "EEI"], sla: "24h mobilization", staging: "Regional yards" },
    discriminators: [
      { title: "EMR < 0.8 with zero serious incidents 36 mo", evidence: "OSHA 300A", proof_point: "Tier 1 supplier status at multiple IOUs" },
      { title: "Storm-response capacity with mutual-aid history", evidence: "X line crews / Y bucket trucks", proof_point: "Named in last 3 IOU after-action reports" },
    ],
    acronym_glossary: {
      "T&D": "Transmission and Distribution",
      MAD: "Minimum Approach Distance",
      EEI: "Edison Electric Institute",
      OQ: "Operator Qualification",
    },
    always_flag: [
      { rule: "Energized 1910.269 work without MAD / EEI 587 references", reason: "Safety + regulatory exposure" },
      { rule: "Davis-Bacon / state prevailing wage triggers", reason: "Affects pricing and compliance burden" },
      { rule: "Outage-window or restoration-SLA liquidated damages", reason: "Schedule-risk financial exposure" },
    ],
    tone_voice: "formal",
    reading_level: 11,
  },
  {
    key: "utility_gas_construction",
    label: "Utility — Gas Construction",
    description: "Distribution mains, services, integrity, transmission pipeline.",
    family: "utility",
    service_categories: ["Gas Construction (Distribution / Transmission)"],
    naics_codes: ["237120", "237990"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Local Distribution Companies", "Gas Utilities", "Pipeline Operators"],
    contract_vehicles: ["MSA", "Alliance", "Unit-Price Book"],
    compliance_frameworks: ["PHMSA 49 CFR 192", "PHMSA 49 CFR 195", "ASME B31.8", "API 1173", "OQ (Subpart N)"],
    regulatory_bodies: ["PHMSA", "State PUCs", "OSHA"],
    delivery_models: ["MSA / Alliance", "Unit-Price", "T&M"],
    discriminators: [
      { title: "API 1104-qualified welding bench", evidence: "X qualified welders on staff", proof_point: "Zero NDE rejects last 12 mo" },
      { title: "DIMP/TIMP-aligned execution playbooks", evidence: "Integrated with operator IM plan", proof_point: "Audit-ready records" },
    ],
    acronym_glossary: {
      DIMP: "Distribution Integrity Management Program",
      TIMP: "Transmission Integrity Management Program",
      OQ: "Operator Qualification",
      MAOP: "Maximum Allowable Operating Pressure",
    },
    always_flag: [
      { rule: "PHMSA-regulated pipeline scope without DIMP/TIMP plan reference", reason: "Cannot execute compliantly" },
      { rule: "OQ task list missing or incomplete", reason: "Crew cannot perform covered tasks" },
    ],
    tone_voice: "formal",
    reading_level: 11,
  },
  {
    key: "utility_water_construction",
    label: "Utility — Water / Wastewater Construction",
    description: "Treatment, distribution, collection, LSLR, PFAS.",
    family: "utility",
    service_categories: ["Water / Wastewater Construction"],
    naics_codes: ["237110", "238910"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Municipal Water Utilities", "Wastewater Districts", "Water Authorities", "EPA SRF programs"],
    contract_vehicles: ["MSA", "Design-Build", "CMAR", "WIFIA / SRF"],
    compliance_frameworks: ["AWWA M-series", "AWWA C810 (LSLR)", "EPA LCRR", "SDWA", "CWA", "Buy America (BABA)"],
    regulatory_bodies: ["EPA", "State DEP/DEQ", "State Drinking Water Programs"],
    delivery_models: ["Design-Build", "MSA / Alliance", "Unit-Price"],
    discriminators: [
      { title: "Trenchless / pipe-bursting capability", evidence: "In-house equipment + crews", proof_point: "Reduced restoration $/LF" },
      { title: "LSLR program experience at scale", evidence: "X services replaced last 24 mo", proof_point: "EPA LCRR-compliant inventory" },
    ],
    acronym_glossary: {
      LSLR: "Lead Service Line Replacement",
      LCRR: "Lead and Copper Rule Revisions",
      SRF: "State Revolving Fund",
      BABA: "Build America, Buy America",
    },
    always_flag: [
      { rule: "Lead service line work missing AWWA C810 / EPA LCRR alignment", reason: "Non-compliant deliverable" },
      { rule: "BABA / Buy America on IIJA-funded scope", reason: "Material sourcing constraints" },
    ],
    tone_voice: "formal",
    reading_level: 11,
  },
  {
    key: "utility_civil_construction",
    label: "Utility — Civil Construction",
    description: "Sitework, paving, restoration, ROW clearing, access roads.",
    family: "utility",
    service_categories: ["Civil Construction (Sitework / Paving / ROW)"],
    naics_codes: ["237310", "238910", "238990"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Municipal Utilities", "Pipeline Operators"],
    contract_vehicles: ["MSA", "Unit-Price Book", "Task-Order"],
    compliance_frameworks: ["OSHA 1926", "USACE 404", "CWA 401", "State erosion control"],
    regulatory_bodies: ["OSHA", "USACE", "EPA", "State DEP/DEQ"],
    delivery_models: ["MSA / Alliance", "Unit-Price", "T&M"],
    discriminators: [
      { title: "Self-perform earthwork + paving", evidence: "In-house fleet", proof_point: "Schedule reliability 95%+" },
      { title: "Environmental compliance bench", evidence: "On-staff biologists/wetlands specialists", proof_point: "Zero NOVs 24 mo" },
    ],
    acronym_glossary: { ROW: "Right of Way", NOV: "Notice of Violation", SWPPP: "Stormwater Pollution Prevention Plan" },
    always_flag: [
      { rule: "USACE 404 / CWA 401 permitting on critical path", reason: "Schedule risk if not pre-permitted" },
      { rule: "Davis-Bacon / state prevailing wage triggers", reason: "Pricing impact" },
    ],
    tone_voice: "formal",
    reading_level: 11,
  },
  {
    key: "utility_renewables_epc",
    label: "Utility — Renewables EPC (Solar / Wind / BESS / EV)",
    description: "EPC and O&M for utility-scale solar, wind, BESS, EV charging.",
    family: "utility",
    service_categories: ["EPC / Renewables (Solar / Wind / BESS / EV)"],
    naics_codes: ["237130", "541330"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "IPPs", "Public Power Authorities", "Munis"],
    contract_vehicles: ["EPC Contract", "PPA-driven EPC", "BESS Supply + Install"],
    compliance_frameworks: ["IEEE 1547", "UL 9540 / 9540A", "NFPA 855", "FERC Order 845/2222", "BABA"],
    regulatory_bodies: ["FERC", "NERC", "ISO/RTO", "State PUCs"],
    delivery_models: ["EPC", "Design-Build", "MSA / Alliance"],
    discriminators: [
      { title: "BESS-augmentation modeling expertise", evidence: "PVsyst + battery degradation models", proof_point: "Bankable IE reports" },
      { title: "Interconnection-queue navigation", evidence: "Cluster-study experience in PJM/MISO/CAISO", proof_point: "Energization on schedule" },
    ],
    acronym_glossary: {
      BESS: "Battery Energy Storage System",
      EPC: "Engineering, Procurement, Construction",
      PPA: "Power Purchase Agreement",
      IE: "Independent Engineer",
      "FERC 2222": "FERC Order 2222 (DER aggregation in wholesale markets)",
    },
    always_flag: [
      { rule: "BABA / Buy America domestic-content thresholds", reason: "Equipment sourcing impact" },
      { rule: "NFPA 855 / UL 9540A test-data requirement for BESS", reason: "AHJ approval gate" },
      { rule: "Interconnection study cost/timeline assumptions", reason: "Major schedule risk" },
    ],
    tone_voice: "technical",
    reading_level: 13,
  },
  {
    key: "utility_staffing_workforce",
    label: "Utility — Staffing & Workforce",
    description: "Staff augmentation, MSP/VMS, OQ-qualified labor, locating, meter services, vegetation.",
    family: "utility",
    service_categories: ["Staffing & Workforce"],
    naics_codes: ["561320", "561311", "561612"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Municipal Utilities", "Electric Cooperatives"],
    contract_vehicles: ["MSP/VMS Program", "Direct Staffing MSA", "Tiered Supplier Program"],
    compliance_frameworks: ["OSHA 1910.269", "OSHA 1926", "OQ (Subpart N)", "Drug & Alcohol (49 CFR 199 / Part 40)", "Background-screening standards"],
    regulatory_bodies: ["OSHA", "PHMSA", "State PUCs"],
    delivery_models: ["MSP / VMS", "SOW Staffing", "T&M"],
    discriminators: [
      { title: "OQ-qualified bench across covered tasks", evidence: "X workers OQ-current", proof_point: "Audit-ready ISN/Veriforce records" },
      { title: "Rapid mobilization for storm/peak", evidence: "Bench + travel program", proof_point: "Filled X reqs in <72h" },
    ],
    acronym_glossary: {
      MSP: "Managed Service Provider",
      VMS: "Vendor Management System",
      OQ: "Operator Qualification",
      SOW: "Statement of Work",
    },
    always_flag: [
      { rule: "VMS rate-card with margin compression below threshold", reason: "Profitability risk" },
      { rule: "OQ task list mismatch vs. bench coverage", reason: "Cannot fulfill covered work" },
      { rule: "Required prequal platform (ISN/Avetta/Veriforce) not held or below grade", reason: "Hard-stop for many IOUs" },
    ],
    tone_voice: "consultative",
    reading_level: 12,
  },
  {
    key: "utility_professional_services",
    label: "Utility — Professional Services / Consulting",
    description: "Management consulting, regulatory/rate-case support, PMO, training, change management.",
    family: "utility",
    service_categories: ["Professional Services / Consulting"],
    naics_codes: ["541611", "541618", "541990"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Public Power Authorities", "Municipal Utilities", "ISO/RTO"],
    contract_vehicles: ["MSA", "Fixed-Fee SOW", "T&M"],
    compliance_frameworks: ["FERC Standards of Conduct", "PUC Filing Standards", "EEI Reporting"],
    regulatory_bodies: ["FERC", "State PUCs", "ISO/RTO Stakeholder Process"],
    delivery_models: ["Fixed-Fee Consulting", "T&M", "MSA / Alliance"],
    discriminators: [
      { title: "Rate-case witness bench", evidence: "Filed testimony in X jurisdictions", proof_point: "Approved rate orders" },
      { title: "IRP / DSP modeling capability", evidence: "Aurora / EnCompass / PLEXOS", proof_point: "Used in commission-approved IRPs" },
    ],
    acronym_glossary: {
      IRP: "Integrated Resource Plan",
      DSP: "Distribution System Plan",
      RPS: "Renewable Portfolio Standard",
      "Rate Case": "PUC proceeding to set utility rates",
    },
    always_flag: [
      { rule: "Conflict-of-interest / Standards of Conduct exposure", reason: "May DQ from other engagements" },
      { rule: "Confidentiality / market-sensitive data handling", reason: "Affects staffing and access controls" },
    ],
    tone_voice: "consultative",
    reading_level: 13,
  },
  {
    key: "utility_field_services_om",
    label: "Utility — Field Services & O&M",
    description: "Inspection, NDE/NDT, leak survey, locating, vegetation, drone, LiDAR.",
    family: "utility",
    service_categories: ["Field Services & O&M"],
    naics_codes: ["541380", "561730", "541370"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Pipeline Operators", "Municipal Utilities"],
    contract_vehicles: ["MSA", "Unit-Price Book", "Task-Order"],
    compliance_frameworks: ["OSHA 1910.269", "PHMSA 192/195 (gas leak survey)", "ANSI A300 (vegetation)", "FAA Part 107 (drone)", "ASNT NDT certifications"],
    regulatory_bodies: ["OSHA", "PHMSA", "FAA", "State PUCs"],
    delivery_models: ["Unit-Price", "MSA / Alliance", "T&M"],
    discriminators: [
      { title: "ASNT-certified NDE bench (UT/RT/PAUT)", evidence: "X Level II + Level III on staff", proof_point: "Audit-ready procedures" },
      { title: "LiDAR + AI defect detection", evidence: "Proprietary processing pipeline", proof_point: "Find rate vs. ground-truth" },
    ],
    acronym_glossary: {
      NDE: "Non-Destructive Examination",
      NDT: "Non-Destructive Testing",
      "ANSI A300": "Tree care industry standards",
      PAUT: "Phased Array Ultrasonic Testing",
    },
    always_flag: [
      { rule: "Restoration / re-inspection SLA with LDs", reason: "Schedule-risk financial exposure" },
      { rule: "Required prequal platform not held", reason: "Hard-stop on field access" },
    ],
    tone_voice: "technical",
    reading_level: 12,
  },
  {
    key: "utility_equipment_materials",
    label: "Utility — Equipment & Materials",
    description: "Transformers, switchgear, cable, pipe, meters, valves, with stocking/logistics.",
    family: "utility",
    service_categories: ["Equipment & Materials"],
    naics_codes: ["335311", "335313", "335314", "335929", "332919"],
    psc_codes: [],
    set_asides: [],
    agencies_focus: ["Investor-Owned Utilities", "Municipal Utilities", "Electric Cooperatives", "Distributors"],
    contract_vehicles: ["Supply Agreement", "Stocking/Consignment", "VMI Program", "ESS / Co-op Pool"],
    compliance_frameworks: ["IEEE / ANSI Equipment Standards", "DOE Efficiency Standards", "BABA / Buy America", "RoHS / REACH (where applicable)"],
    regulatory_bodies: ["DOE", "FERC", "State PUCs"],
    delivery_models: ["Equipment Supply with Stocking", "Unit-Price", "MSA / Alliance"],
    discriminators: [
      { title: "Domestic-content compliant product line", evidence: "BABA-certified SKUs", proof_point: "Used on IIJA-funded projects" },
      { title: "Vendor-managed inventory program", evidence: "Stocking yards in X regions", proof_point: "Fill-rate >98%" },
    ],
    acronym_glossary: {
      VMI: "Vendor-Managed Inventory",
      BABA: "Build America, Buy America",
      ESS: "Energy Storage Systems (or Electric Supply Storeroom in some utilities)",
      DOE: "Department of Energy",
    },
    always_flag: [
      { rule: "BABA / Buy America domestic-content thresholds", reason: "May DQ non-compliant SKUs" },
      { rule: "Lead-time vs. required on-site date for long-lead equipment", reason: "Schedule risk (transformers / switchgear)" },
      { rule: "Stocking / consignment / VMI obligations", reason: "Working capital + insurance impact" },
    ],
    tone_voice: "formal",
    reading_level: 11,
  },
];

export const LENS_PRESETS: LensPreset[] = [...FEDERAL_PRESETS, ...UTILITY_PRESETS];

export function getPreset(key: string | null | undefined): LensPreset | undefined {
  if (!key) return undefined;
  return LENS_PRESETS.find((p) => p.key === key);
}

export function isUtilityPreset(key: string | null | undefined): boolean {
  return !!key && key.startsWith("utility_");
}
