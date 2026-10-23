import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DraftingWorkspace } from "./DraftingWorkspace";
import { ComplianceMatrix } from "./ComplianceMatrix";
import { CompilePanel } from "./CompilePanel";

interface Props { solicitationId: string }

const TABS = ["draft", "compliance", "compile"];

export function Phase5Workspace({ solicitationId }: Props) {
  const [params, setParams] = useSearchParams();
  const step = params.get("step") ?? "draft";
  const tab = TABS.includes(step) ? step : "draft";
  const gapsOnly = params.get("gaps") === "1";
  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set("step", t);
    next.delete("gaps");
    setParams(next);
  };
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList>
        <TabsTrigger value="draft">Draft</TabsTrigger>
        <TabsTrigger value="compliance">Compliance Matrix</TabsTrigger>
        <TabsTrigger value="compile">Compile & Package</TabsTrigger>
      </TabsList>
      <TabsContent value="draft" className="mt-4">
        <DraftingWorkspace solicitationId={solicitationId} />
      </TabsContent>
      <TabsContent value="compliance" className="mt-4">
        <ComplianceMatrix key={gapsOnly ? "gaps" : "all"} solicitationId={solicitationId} initialGapsOnly={gapsOnly} />
      </TabsContent>
      <TabsContent value="compile" className="mt-4">
        <CompilePanel solicitationId={solicitationId} />
      </TabsContent>
    </Tabs>
  );
}
