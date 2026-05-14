
# Supporting Utility-Industry Suppliers (additive to federal contracting)

**Framing.** The platform already supports federal contracting end-to-end. This plan **adds** a parallel, multi-vertical capability for clients who sell *into the utility industry* (IOUs, municipal utilities, co-ops, JPAs, ISOs/RTOs, public power authorities). Nothing federal is removed, renamed, or altered — every change is additive and gated on the active Client Lens.

**Scope of "utility supplier" — explicitly broad.** A utility supplier may be in any of:

- **IT & OT** — enterprise IT, ADMS/OMS/DERMS, SCADA, AMI head-end, GIS, billing/CIS, cybersecurity, cloud.
- **Engineering** — T&D engineering, substation design, gas integrity, hydraulic modeling, civil/structural, environmental, PE-stamped deliverables.
- **Construction** — electric T&D, substations, gas distribution/transmission, water/wastewater treatment, pipelines, civil sitework, paving, restoration.
- **EPC / Renewables** — solar, wind, BESS, EV charging, hydrogen.
- **Staffing & Workforce** — staff augmentation, MSP/VMS programs, OQ-qualified labor, locating, meter services, vegetation management.
- **Professional Services** — management consulting, regulatory/rate-case support, program management, training, change management.
- **Field Services & O&M** — inspections, NDE/NDT, leak survey, locating, vegetation, drone, LiDAR.
- **Equipment & Materials** — transformers, switchgear, cable, pipe, meters, valves, with stocking/logistics.

The lens model must accommodate **all of the above** in a single client profile (some suppliers play in multiple lanes).

## 1. Lens presets (additive to federal presets)

Add a `utility_*` family to `src/features/clients/lib/lensPresets.ts`:

- `utility_it_ot` — IT/OT systems, cybersecurity, integrations.
- `utility_engineering` — PE-led engineering services.
- `utility_electric_construction` — T&D and substation construction.
- `utility_gas_construction` — distribution mains, integrity, pipeline.
- `utility_water_construction` — treatment, distribution, LSLR, collection.
- `utility_civil_construction` — sitework, paving, restoration, ROW.
- `utility_renewables_epc` — solar/wind/BESS/EV EPC and O&M.
- `utility_staffing_workforce` — staff aug, MSP, OQ labor, vegetation.
- `utility_professional_services` — management consulting, rate-case, PMO.
- `utility_field_services_om` — inspection, NDE, locating, drone, LiDAR.
- `utility_equipment_materials` — manufacturers, distributors, stocking programs.

Each preset preloads the right NAICS, agency/buyer archetypes, vehicles (MSA, alliance, EEI mutual-aid, WRDA/SRF, ESPC, PPA), and compliance frameworks for that lane.

## 2. Profile schema additions (Client Lens fields)

Additive, all nullable. Existing federal clients leave them empty and see zero behavior change.

- **Service categories** — multi-select across the eleven lanes above (a client can be in several).
- **Regulatory bodies** — FERC, NERC + Region (RF/SERC/WECC/MRO/NPCC/Texas RE/WECC), state PUC(s), PHMSA, EPA Region, state DEP/DEQ.
- **Compliance frameworks (utility set)** — NERC CIP, NESC, OSHA 1910.269, IEEE 1547, AWWA M-series, ASME B31.8, API 1173, PHMSA 192/195, SDWA/CWA, NFPA 70E, NIST 800-82, TSA Security Directives.
- **Service territory** — states, ISO/RTO (PJM, MISO, ERCOT, CAISO, SPP, NYISO, ISO-NE), counties or operating divisions.
- **Buyer relationships** — known IOUs/munis/co-ops, current MSAs, prequalification status (ISN, Avetta, Veriforce, Browz).
- **Safety metrics** — TRIR, DART, EMR, lost-time, mutual-aid history.
- **Workforce & capacity** — line crews (D/T), bucket trucks, directional drills, hydrovacs, welders (API 1104), CDL drivers, PEs by discipline, billable engineers/consultants, OQ-qualified headcount, contingent workforce size.
- **Supplier-diversity tiers** — MBE/WBE/DBE/SDVOSB/LGBTBE, NMSDC/WBENC, utility-specific Tier 1/2 supplier IDs.
- **Bonding & insurance** — single/aggregate bonding, GL/auto/umbrella, cyber, professional liability (E&O), pollution.
- **Labor posture** — union locals (IBEW, UA, LiUNA, Teamsters), prevailing-wage history, PLA experience.
- **Storm/emergency** — RMAG/SMAG/WRMAG membership, response SLA, staging.
- **Tech stack served / used** — GIS (Esri/Smallworld), ADMS/OMS, AMI vendor, SCADA, work-management (Maximo/Click), GPS telematics, ERP.
- **Delivery models offered** — MSA/alliance, EPC, design-build, T&M, unit-price, MSP/VMS, SOW staffing, fixed-fee consulting, equipment supply with stocking.

## 3. Always-flag rules (utility-specific, lane-aware)

Seeded per preset and merged when multiple lanes are active:

- NERC CIP medium/high impact BES Cyber System scope (IT/OT, engineering, construction touching CIP assets).
- PHMSA-regulated pipeline scope without DIMP/TIMP plan reference (gas).
- Lead service line work missing AWWA C810 / EPA LCRR alignment (water).
- Energized 1910.269 work without MAD / EEI 587 references (electric, staffing).
- Davis-Bacon / state prevailing wage triggers and PLA requirements (all construction, staffing).
- Buy America(n) / BABA on IIJA-funded grid and water work (equipment, construction, EPC).
- OT/ICS cybersecurity language (NIST 800-82, TSA SD) on engineering or IT scope.
- PE stamp required in jurisdictions where the client lacks registration (engineering).
- Prequal platform (ISN/Avetta/Veriforce/Browz) required but client not enrolled or below grade (all lanes).
- Outage-window or restoration-SLA liquidated damages (construction, field services).
- ESG / Scope 1-3 reporting obligations (all lanes).
- Contingent-workforce VMS/MSP rate-card constraints (staffing).
- Stocking, consignment, or VMI obligations (equipment & materials).

## 4. Knowledge Library — utility-supplier document taxonomy

Extend the `KnowledgeTab` tag picker (no schema change) with utility-native types covering all lanes:

- Past MSA / alliance / unit-price book proposals.
- Storm and mutual-aid after-action reports.
- Safety package (ISN, Avetta, Veriforce, Browz exports), EMR letters, OSHA 300A.
- Prequalification questionnaires for specific IOUs.
- Engineering QA/QC manuals, PE rosters by jurisdiction.
- IT/OT reference architectures, SOC 2 / ISO 27001 letters.
- Staffing MSP/VMS rate cards, bench rosters, OQ matrices.
- Equipment cut sheets, stocking program SOPs.
- IRP / RPS / decarbonization plans for buyer utilities.
- Rate-case filings, PUC orders, ISO/RTO market notices.
- Past performance / CPARS-equivalent commercial reference letters.

## 5. Analysis prompt additions (lane-aware)

Light, conditional nudges in the existing AI functions when one or more `utility_*` presets are active:

- `extract-requirements` — also extract: voltage class, pipe diameter/material, GPM/MGD, outage window, OQ tasks, CIP impact rating, AWWA standards, PE stamp jurisdictions, prequal platforms, VMS/MSP rate-card constraints, BABA/Buy America triggers.
- `identify-risks-opportunities` — apply the utility always-flag set; add risk dimensions for outage/SLA exposure, permitting (USACE 404, CWA 401, ROW), prequal grade, PE jurisdiction coverage, and rate-card margin compression (staffing).
- `generate-win-themes` — bias toward safety record, mutual-aid history, local crew/PE density, certification tiers, self-perform percentage, prequal grade, and buyer-specific reference work — the actual evaluation drivers in utility scorecards.
- `analyze-gaps` — compare requested certifications/territory/crew/PE/OQ counts against the new profile fields.
- `compare-solicitations` — surface delta in regulatory regime, prequal platform, and delivery model when a client straddles lanes.

## 6. New "Utility Bid Snapshot" report block (optional)

Add a block in `src/features/reports/templates/blocks.ts` rendering: regulatory regime, ISO/RTO, voltage/pressure/GPM class, safety requirement vs. client EMR/TRIR, bonding ask vs. capacity, prequal grade vs. requirement, PE jurisdiction coverage, certification tier vs. held, delivery model match, and outage/SLA exposure. Becomes the go/no-go-at-a-glance page proposal managers want.

## 7. Out of scope (call out, don't build)

- Live ISN / Avetta / Veriforce / Browz API integrations.
- PUC docket scraping or FERC eLibrary ingestion.
- Pricing/estimating engines and unit-price book authoring (stays as Knowledge docs).
- ISO/RTO market-notice ingestion.

## Technical summary

- **Code-only additions**: 11 new lens presets + additive optional fields on `client_profiles` + lens prompt block additions + tag taxonomy in `KnowledgeTab` + conditional prompt nudges + one new report block.
- **DB migration (additive only)**: new nullable columns on `client_profiles` — `service_categories text[]`, `regulatory_bodies text[]`, `iso_rto text`, `service_territory jsonb`, `buyer_relationships jsonb`, `safety_metrics jsonb`, `workforce_capacity jsonb`, `diversity_tiers jsonb`, `bonding jsonb`, `labor_posture jsonb`, `storm_response jsonb`, `tech_stack jsonb`, `delivery_models text[]`.
- **No breaking changes**: federal presets, federal lens prompt, federal analyses, and all existing RAG behavior are untouched. Utility behavior is gated on `preset_key LIKE 'utility_%'` or presence of utility fields.
- **Multi-lane clients** — a client can have multiple `service_categories` and even multiple presets; the lens block merges always-flag rules and discriminators across active lanes.

## Suggested phasing

1. Lens presets (all 11) + profile-field additions + lens prompt block (highest leverage, lowest risk).
2. Always-flag rules + analysis prompt nudges (lane-aware).
3. Knowledge taxonomy + Utility Bid Snapshot report block.

Tell me to proceed with Phase 1 (or all phases) and I'll implement.
