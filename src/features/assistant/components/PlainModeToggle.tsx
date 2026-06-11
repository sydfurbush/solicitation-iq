import { Languages } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function PlainModeToggle({ value, onChange, disabled }: Props) {
  return (
    <Toggle
      size="sm"
      pressed={value}
      onPressedChange={onChange}
      disabled={disabled}
      aria-label="Toggle plain English mode"
      title="Plain English: no jargon, short sentences"
      className="h-8 px-2 text-xs gap-1.5"
    >
      <Languages className="h-3.5 w-3.5" />
      Plain
    </Toggle>
  );
}
