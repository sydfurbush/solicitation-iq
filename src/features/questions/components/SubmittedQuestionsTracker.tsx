import { format } from "date-fns";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { questionsToCsv, type QuestionRow } from "../utils/questionHelpers";

interface Props {
  questions: QuestionRow[];
  onSelect: (q: QuestionRow) => void;
}

function downloadCsv(rows: QuestionRow[]) {
  const csv = questionsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "submitted-questions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function SubmittedQuestionsTracker({ questions, onSelect }: Props) {
  const submitted = questions.filter((q) => q.is_submitted);

  if (submitted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No questions have been marked as submitted yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{submitted.length} submitted</p>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(submitted)}>
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submitted.map((q) => (
              <TableRow key={q.id} className="cursor-pointer" onClick={() => onSelect(q)}>
                <TableCell className="max-w-md truncate">{q.question_text}</TableCell>
                <TableCell><Badge variant="outline">{q.category}</Badge></TableCell>
                <TableCell className="text-xs">
                  {q.submitted_at ? format(new Date(q.submitted_at), "PP") : "—"}
                </TableCell>
                <TableCell>
                  {q.agency_response ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Answered</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
