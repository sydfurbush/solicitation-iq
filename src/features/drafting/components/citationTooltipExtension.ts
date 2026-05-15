import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface CitationLookup {
  lookup: Record<string, string>;
}

export const citationPluginKey = new PluginKey<DecorationSet>("citationTooltip");

const TOKEN_RE = /\[(K\d+|Req-[A-Za-z0-9._-]+)\]/g;

function buildDecorations(doc: import("@tiptap/pm/model").Node, lookup: Record<string, string>) {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      const token = m[1];
      const tip = lookup[token] ?? `${token} — no reference found`;
      const from = pos + m.index;
      const to = from + m[0].length;
      decos.push(
        Decoration.inline(from, to, {
          class: "citation-token",
          title: tip,
          "data-citation": token,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

export const CitationTooltip = Extension.create<CitationLookup>({
  name: "citationTooltip",
  addOptions() {
    return { lookup: {} };
  },
  addProseMirrorPlugins() {
    const optionsRef = this.options;
    return [
      new Plugin({
        key: citationPluginKey,
        state: {
          init: (_c, { doc }) => buildDecorations(doc, optionsRef.lookup),
          apply: (tr, old) => {
            const updated = tr.getMeta(citationPluginKey) as Record<string, string> | undefined;
            if (updated) {
              optionsRef.lookup = updated;
              return buildDecorations(tr.doc, updated);
            }
            if (tr.docChanged) return buildDecorations(tr.doc, optionsRef.lookup);
            return old;
          },
        },
        props: {
          decorations(state) {
            return citationPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
