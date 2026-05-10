import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  type QuestionRow,
} from "../utils/questionHelpers";

interface Props {
  questions: QuestionRow[];
  onSelectCell: (filter: { category: typeof CATEGORIES[number]; recommendation: typeof RECOMMENDATIONS[number] }) => void;
}

export function QuestionsMatrix({ questions, onSelectCell }: Props) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) {
      const key = `${q.category}|${q.recommendation ?? "monitor"}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [questions]);

  const max = Math.max(0, ...Array.from(counts.values()));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribution</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Category \ Rec.</th>
              {RECOMMENDATIONS.map((r) => (
                <th key={r} className="p-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                  {RECOMMENDATION_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c}>
                <td className="p-2 font-medium">{CATEGORY_LABEL[c]}</td>
                {RECOMMENDATIONS.map((r) => {
                  const n = counts.get(`${c}|${r}`) ?? 0;
                  const intensity = max > 0 ? n / max : 0;
                  return (
                    <td key={r} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectCell({ category: c, recommendation: r })}
                        className={cn(
                          "w-full h-12 rounded border text-sm font-semibold transition hover:border-primary",
                          n === 0 ? "bg-muted/30 text-muted-foreground" : "text-primary-foreground"
                        )}
                        style={n > 0 ? { backgroundColor: `hsl(var(--primary) / ${0.25 + intensity * 0.55})` } : undefined}
                      >
                        {n}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
