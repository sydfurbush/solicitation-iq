import type { ReactNode } from "react";
import type { PhaseType } from "@/lib/validators/solicitation";

export interface PhaseSubStep {
  key: string;
  label: string;
}

interface Props {
  solicitationId?: string;
  phase?: PhaseType;
  currentPhase?: PhaseType;
  subSteps?: PhaseSubStep[];
  activeStep?: string;
  onStepChange?: (key: string) => void;
  children: ReactNode;
}

/**
 * Passthrough wrapper. Phase identity, sub-step navigation, and advance/approval
 * controls now live in the left rail and top bar of SolicitationDetail, so this
 * component no longer renders its own header or tab strip.
 */
export function PhaseShell({ children }: Props) {
  return <div>{children}</div>;
}
