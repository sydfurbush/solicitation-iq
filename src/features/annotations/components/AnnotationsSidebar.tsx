import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useDocuments } from "@/features/documents/hooks/useDocuments";
import { AnnotationsList } from "./AnnotationsList";
import { AnnotationForm, type AnnotationFormValues } from "./AnnotationForm";
import { useCreateAnnotation } from "../hooks/useAnnotations";

interface Props {
  solicitationId: string;
  isAdmin?: boolean;
}

export function AnnotationsSidebar({ solicitationId, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data: documents = [] } = useDocuments(solicitationId);
  const create = useCreateAnnotation(solicitationId);

  const handleSubmit = async (v: AnnotationFormValues) => {
    try {
      await create.mutateAsync(v);
      toast({ title: "Annotation added" });
      setAdding(false);
    } catch (e) {
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="h-4 w-4 mr-2" /> Annotations
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Annotations</SheetTitle>
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              {adding ? "Close" : "Add"}
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {adding && (
            <div className="rounded-md border p-3 bg-muted/20">
              <AnnotationForm
                documents={documents.map((d) => ({ id: d.id, file_name: d.file_name }))}
                onSubmit={handleSubmit}
                onCancel={() => setAdding(false)}
                submitting={create.isPending}
              />
            </div>
          )}

          <Tabs defaultValue="all">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="open">Unresolved</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-3">
              <AnnotationsList solicitationId={solicitationId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="mine" className="mt-3">
              <AnnotationsList solicitationId={solicitationId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="open" className="mt-3">
              <AnnotationsList solicitationId={solicitationId} isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
