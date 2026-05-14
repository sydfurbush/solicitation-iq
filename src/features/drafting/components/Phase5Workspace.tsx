import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DraftingWorkspace } from "./DraftingWorkspace";
import { ComplianceMatrix } from "./ComplianceMatrix";
import { CompilePanel } from "./CompilePanel";

interface Props { solicitationId: string }

export function Phase5Workspace({ solicitationId }: Props) {
  const [tab, setTab] = useState("draft");
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
        <ComplianceMatrix solicitationId={solicitationId} />
      </TabsContent>
      <TabsContent value="compile" className="mt-4">
        <CompilePanel solicitationId={solicitationId} />
      </TabsContent>
    </Tabs>
  );
}
