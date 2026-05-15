import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import TurndownService from "turndown";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Heading3,
  Quote, Code, Undo, Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;            // markdown
  onChange: (md: string) => void;
  placeholder?: string;
  className?: string;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});
// Preserve [Req-X] / [K1] tokens verbatim
turndown.addRule("preserveBrackets", {
  filter: (node) => node.nodeName === "CODE" && /^\[(Req-|K)/i.test(node.textContent ?? ""),
  replacement: (content) => content,
});

marked.setOptions({ gfm: true, breaks: false });

function ToolbarBtn({
  active, onClick, children, title,
}: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      title={title}
      className="h-7 w-7 p-0"
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1 flex-wrap bg-muted/30">
      <ToolbarBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-3.5 w-3.5" />
      </ToolbarBtn>
    </div>
  );
}

export function MarkdownEditor({ value, onChange, placeholder, className }: Props) {
  const initialHtml = useMemo(() => marked.parse(value || "") as string, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastEmittedRef = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none p-6 min-h-full",
          "prose-headings:scroll-mt-4 prose-p:my-2 prose-li:my-0.5"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = turndown.turndown(html);
      lastEmittedRef.current = md;
      onChange(md);
    },
  });

  // Sync external value changes (e.g. selecting a different section, AI draft)
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    const html = marked.parse(value || "") as string;
    editor.commands.setContent(html, { emitUpdate: false });
    lastEmittedRef.current = value;
  }, [value, editor]);

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
