import { useCallback, useMemo } from "react";
import { useUpdateThread, type AssistantThread, type PinnedEntity } from "./useAssistantThreads";

const LIMIT = 5;

export function usePinnedEntities(thread: AssistantThread | null) {
  const update = useUpdateThread();
  const entities = useMemo<PinnedEntity[]>(
    () => (thread?.pinned_entity?.entities ?? []) as PinnedEntity[],
    [thread?.pinned_entity],
  );
  const atLimit = entities.length >= LIMIT;

  const persist = useCallback(
    async (next: PinnedEntity[]) => {
      if (!thread) return;
      await update.mutateAsync({
        id: thread.id,
        patch: { pinned_entity: { entities: next.slice(0, LIMIT) } },
      });
    },
    [thread, update],
  );

  const isPinned = useCallback(
    (kind: PinnedEntity["kind"], id: string) =>
      entities.some((e) => e.kind === kind && e.id === id),
    [entities],
  );

  const add = useCallback(
    (e: PinnedEntity) => {
      if (atLimit || isPinned(e.kind, e.id)) return;
      return persist([...entities, e]);
    },
    [atLimit, isPinned, entities, persist],
  );

  const remove = useCallback(
    (kind: PinnedEntity["kind"], id: string) =>
      persist(entities.filter((e) => !(e.kind === kind && e.id === id))),
    [entities, persist],
  );

  return { entities, add, remove, isPinned, atLimit, limit: LIMIT, isPending: update.isPending };
}
