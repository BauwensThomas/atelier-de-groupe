import { Extension } from "@tiptap/core";
import { columnResizing } from "@tiptap/pm/tables";

// Largeur des colonnes d'un tableau : on glisse la bordure entre deux colonnes.
// Ajouté ici plutôt qu'avec l'option "resizable" du tableau, qui ne l'active que si l'éditeur est modifiable
// à sa création (ici, il le devient quand le prénom est choisi). L'outil ne réagit que si l'éditeur est
// modifiable : rien pour le professeur. La dernière colonne prend la place qui reste, le tableau garde donc
// la largeur de la page.
export const TABLE_CELL_MIN_WIDTH = 40;

export const TableResize = Extension.create({
  name: "tableResize",
  addProseMirrorPlugins() {
    return [columnResizing({ handleWidth: 6, cellMinWidth: TABLE_CELL_MIN_WIDTH, defaultCellMinWidth: TABLE_CELL_MIN_WIDTH, lastColumnResizable: false })];
  },
});
