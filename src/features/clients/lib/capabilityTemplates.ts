export type CapabilityTemplate = {
  id: string;
  name: string;
  description: string;
  data: {
    core_capabilities?: string;
    naics_codes?: string[];
    certifications?: string[];
    differentiators?: string;
    past_performance?: string;
    key_personnel?: string;
    teaming_partners?: string;
    notes?: string;
  };
};

export const CAPABILITY_TEMPLATES: CapabilityTemplate[] = [
  {
    id: "it-services",
    name: "IT Services",
    description: "Managed IT, cloud migration, helpdesk, infrastructure modernization.",
    data: {
      core_capabilities:
        "Managed IT services, cloud migration (AWS/Azure/GCP), infrastructure modernization, network engineering, Tier 1-3 helpdesk, IT service management (ITIL/ITSM), virtualization, and end-user computing.",
      naics_codes: ["541512", "541513", "541519", "541511"],
      certifications: ["ISO 9001", "ISO 20000", "ITIL v4", "AWS Partner", "Microsoft Gold Partner"],
      differentiators:
        "24/7 NOC, US-based engineers, FedRAMP-aligned cloud delivery, proven zero-downtime migration playbook.",
      past_performance:
        "Modernized legacy data centers for federal civilian agencies; migrated 5,000+ workloads to AWS GovCloud with 99.99% uptime.",
      key_personnel: "PMP-certified Program Manager, Cloud Solutions Architect (AWS/Azure), ITIL Service Delivery Manager.",
      teaming_partners: "AWS, Microsoft, ServiceNow, Cisco, VMware",
    },
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    description: "RMF, SOC, zero trust, incident response, CMMC compliance.",
    data: {
      core_capabilities:
        "Risk Management Framework (RMF) ATO support, 24/7 SOC, zero trust architecture, vulnerability management, incident response & forensics, penetration testing, CMMC/NIST 800-171 compliance, SIEM engineering (Splunk/Sentinel), and cybersecurity workforce training.",
      naics_codes: ["541512", "541519", "541690", "541611"],
      certifications: ["CMMC L2", "ISO 27001", "SOC 2 Type II", "FedRAMP Moderate", "CISSP staff", "CEH staff"],
      differentiators:
        "Cleared (TS/SCI) cyber workforce, accredited 3PAO experience, in-house red team, repeatable RMF eMASS package delivery.",
      past_performance:
        "Delivered ATO packages for DoD and IC systems; sustained 24/7 SOC operations protecting 50K+ endpoints; led IR for nation-state intrusions.",
      key_personnel: "CISSP-certified Cyber Lead, RMF/ISSE/ISSO, IR Lead (GCFA/GCIH), Red Team Lead (OSCP).",
      teaming_partners: "Splunk, CrowdStrike, Palo Alto Networks, Microsoft Security, Tenable",
    },
  },
  {
    id: "engineering",
    name: "Engineering Services",
    description: "Systems engineering, mechanical/electrical, T&E, modeling & simulation.",
    data: {
      core_capabilities:
        "Systems engineering & integration (SE&I), mechanical & electrical engineering, model-based systems engineering (MBSE), test & evaluation (T&E), modeling & simulation, configuration management, and lifecycle sustainment.",
      naics_codes: ["541330", "541715", "541712", "541614"],
      certifications: ["ISO 9001", "AS9100", "CMMI-DEV L3", "INCOSE CSEP staff"],
      differentiators:
        "Integrated digital engineering practice (DOORS, Cameo, Jira), DoD 5000.02 acquisition fluency, hardware-in-the-loop labs.",
      past_performance:
        "Supported weapon system SE&I for DoD programs of record; delivered MBSE artifacts and T&E plans across multiple Milestone B/C events.",
      key_personnel: "Chief Systems Engineer (INCOSE ESEP), Lead T&E Engineer, MBSE Architect.",
      teaming_partners: "Lockheed Martin, Northrop Grumman, Raytheon, SAIC",
    },
  },
  {
    id: "software-dev",
    name: "Software Development",
    description: "Custom software, DevSecOps, agile delivery, modernization.",
    data: {
      core_capabilities:
        "Full-stack custom software development, DevSecOps, cloud-native application development (Kubernetes, microservices), API design, legacy modernization, Agile/SAFe delivery, and human-centered design.",
      naics_codes: ["541511", "541512", "541519"],
      certifications: ["CMMI-DEV L3", "ISO 27001", "SAFe certified staff", "AWS DevOps Professional"],
      differentiators:
        "Cleared agile pods, ATO-ready CI/CD pipelines, 508-compliant UX practice, open-source-first delivery.",
      past_performance:
        "Delivered citizen-facing portals for federal agencies; modernized mainframe-era systems to cloud-native microservices on AWS GovCloud.",
      key_personnel: "Agile Release Train Engineer, DevSecOps Lead, Principal UX Researcher, Lead Solutions Architect.",
      teaming_partners: "GitHub, GitLab, HashiCorp, Red Hat, AWS",
    },
  },
  {
    id: "data-ai",
    name: "Data Analytics & AI",
    description: "Data engineering, ML/AI, decision support, GenAI integration.",
    data: {
      core_capabilities:
        "Data engineering & governance, advanced analytics, machine learning & AI model development, MLOps, decision-support dashboards (Tableau/Power BI), generative AI integration, and responsible AI evaluation.",
      naics_codes: ["541511", "541512", "541690"],
      certifications: ["ISO 27001", "AWS Machine Learning Specialty", "Databricks Partner"],
      differentiators:
        "End-to-end MLOps platform, mission-tuned LLM evaluation harness, data-mesh delivery model, cleared data scientists.",
      past_performance:
        "Built predictive analytics for logistics readiness; deployed NLP pipelines processing 10M+ records/day; stood up DoD-accredited data lakes.",
      key_personnel: "Chief Data Scientist (PhD), MLOps Lead, Data Governance Lead, GenAI Solutions Architect.",
      teaming_partners: "Databricks, Snowflake, NVIDIA, AWS, Microsoft",
    },
  },
  {
    id: "professional-services",
    name: "Management Consulting",
    description: "Strategy, program management, business process, change management.",
    data: {
      core_capabilities:
        "Strategic planning, program & project management (PMO), business process reengineering, organizational change management, financial management support, and acquisition/procurement support.",
      naics_codes: ["541611", "541612", "541618", "541990"],
      certifications: ["ISO 9001", "PMP staff", "Lean Six Sigma Black Belt staff", "Prosci Change Management"],
      differentiators:
        "Federal acquisition fluency (FAR/DFARS), embedded change-management practice, outcomes-based delivery model.",
      past_performance:
        "Stood up PMOs for federal transformation programs >$500M; led enterprise change initiatives across 10K+ employee organizations.",
      key_personnel: "PMP Program Director, Lean Six Sigma MBB, Senior Change Management Lead.",
      teaming_partners: "Deloitte, Accenture Federal, Booz Allen alumni network",
    },
  },
];
