import { SearchX, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type SamNotFoundDetails = {
  lookup?: { noticeId?: string | null; solicitationNumber?: string | null };
  triedStrategies?: string[];
  url?: string | null;
  onDismiss?: () => void;
  onLinkAsExternal?: () => void;
};

export function SamNotFoundAlert({
  lookup,
  triedStrategies,
  url,
  onDismiss,
  onLinkAsExternal,
}: SamNotFoundDetails) {
  const samSearchHref = lookup?.solicitationNumber
    ? `https://sam.gov/search/?index=opp&q=${encodeURIComponent(lookup.solicitationNumber)}`
    : url ?? "https://sam.gov/search/?index=opp";

  return (
    <Alert variant="default" className="border-destructive/40 bg-destructive/5">
      <SearchX className="h-4 w-4 text-destructive" />
      <AlertTitle>Notice not found on SAM.gov</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          We couldn&apos;t locate this notice on SAM.gov
          {lookup?.solicitationNumber && (
            <> for solicitation number <span className="font-mono">{lookup.solicitationNumber}</span></>
          )}
          {lookup?.noticeId && (
            <> (notice id <span className="font-mono">{lookup.noticeId}</span>)</>
          )}
          .
        </p>

        <div className="text-sm space-y-1">
          <p className="font-medium">Try one of these:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Double-check the solicitation number for typos or missing dashes (e.g. <span className="font-mono">W912DY-19-R-0001</span>).</li>
            <li>Paste the full SAM.gov URL from your browser address bar instead of just the number.</li>
            <li>The notice may be older than ~6 years or have been removed — confirm it&apos;s still public on SAM.gov.</li>
            <li>If it lives outside SAM.gov, link it as an external reference for a limited comparison.</li>
          </ul>
        </div>

        {triedStrategies && triedStrategies.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Show what we tried ({triedStrategies.length})
            </summary>
            <ul className="mt-2 list-disc pl-5 space-y-0.5">
              {triedStrategies.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </details>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <a href={samSearchHref} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Search SAM.gov
            </a>
          </Button>
          {onLinkAsExternal && (
            <Button size="sm" variant="outline" onClick={onLinkAsExternal}>
              Link as external reference
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
