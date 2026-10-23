import { TextAlign } from "@tiptap/extension-text-align";

// Alignement des paragraphes et des titres (gauche, centré, droite), aussi dans les cases d'un tableau.
// Même réglage pour l'éditeur, les aperçus de versions et l'export : sinon l'alignement serait perdu.
export const ALIGNMENTS = ["left", "center", "right"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

export const Align = TextAlign.configure({ types: ["heading", "paragraph"], alignments: [...ALIGNMENTS], defaultAlignment: "left" });
