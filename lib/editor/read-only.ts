import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { isRemote } from "./shared";

// Éditeur non modifiable (professeur, ou prénom pas encore choisi) : aucune modification locale du document,
// même automatique (reverrouillage d'une question, couleurs). Les modifications des autres arrivent normalement.
export const ReadOnlyGuard = Extension.create({
  name: "readOnlyGuard",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("gp-read-only"),
        filterTransaction: (tr) => !tr.docChanged || isRemote(tr) || editor.isEditable,
      }),
    ];
  },
});
