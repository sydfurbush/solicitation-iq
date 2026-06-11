import { useAssistantAttachments, useSignedAttachmentUrl, type AssistantAttachment } from "../hooks/useAssistantAttachments";

type Props = {
  threadId: string;
  messageId: string;
};

export function MessageAttachments({ threadId, messageId }: Props) {
  const { data } = useAssistantAttachments(threadId);
  const items = data?.byMessage.get(messageId) ?? [];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-1.5">
      {items.map((a) => (
        <AttachmentThumb key={a.id} att={a} />
      ))}
    </div>
  );
}

function AttachmentThumb({ att }: { att: AssistantAttachment }) {
  const url = useSignedAttachmentUrl(att.storage_path);
  if (!url) {
    return <div className="h-20 w-20 rounded-md border bg-muted animate-pulse" aria-label={att.file_name} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-20 w-20 rounded-md overflow-hidden border bg-muted hover:opacity-90"
      title={att.file_name}
    >
      <img src={url} alt={att.file_name} className="h-full w-full object-cover" loading="lazy" />
    </a>
  );
}
