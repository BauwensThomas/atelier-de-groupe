import type { Transaction } from "@tiptap/pm/state";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";

// Meta posée sur nos propres transactions internes (verrouillage, nettoyage des couleurs).
export const internalKey = new PluginKey("gp-internal");

/** Vrai si la transaction vient de Yjs (modif d'un autre utilisateur, annuler/rétablir). */
export function isRemote(tr: Transaction): boolean {
  const meta = tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined;
  return Boolean(meta?.isChangeOrigin);
}

/** Trouve le bloc question qui contient cette position, s'il existe. */
export function findQuestion($pos: ResolvedPos): { pos: number; node: PMNode } | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "question") return { pos: $pos.before(depth), node };
  }
  return null;
}

export function isSafeColor(color: unknown): color is string {
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color);
}
