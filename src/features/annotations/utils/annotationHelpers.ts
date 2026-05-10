import {
  CheckSquare,
  Flag,
  HelpCircle,
  Highlighter,
  MessageSquare,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type AnnotationType = Database["public"]["Enums"]["annotation_type"];
export type AnnotationRow = Database["public"]["Tables"]["annotations"]["Row"];

export const ANNOTATION_TYPES: AnnotationType[] = [
  "note",
  "flag",
  "question",
  "highlight",
  "action_item",
  "win_theme",
  "discriminator",
];

export const ANNOTATION_LABEL: Record<AnnotationType, string> = {
  note: "Note",
  flag: "Flag",
  question: "Question",
  highlight: "Highlight",
  action_item: "Action item",
  win_theme: "Win theme",
  discriminator: "Discriminator",
};

export const ANNOTATION_ICON: Record<AnnotationType, LucideIcon> = {
  note: MessageSquare,
  flag: Flag,
  question: HelpCircle,
  highlight: Highlighter,
  action_item: CheckSquare,
  win_theme: Trophy,
  discriminator: Star,
};

// Tailwind classes for badge color
export const ANNOTATION_BADGE: Record<AnnotationType, string> = {
  note: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  flag: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  question: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  highlight: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  action_item: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  win_theme: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  discriminator: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
};

export const ANNOTATION_DOT: Record<AnnotationType, string> = {
  note: "bg-blue-500",
  flag: "bg-red-500",
  question: "bg-purple-500",
  highlight: "bg-yellow-500",
  action_item: "bg-orange-500",
  win_theme: "bg-green-500",
  discriminator: "bg-amber-500",
};
