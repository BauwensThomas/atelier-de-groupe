"use client";

import dynamic from "next/dynamic";
import { Loading } from "./Loading";

// L'éditeur (Yjs, Liveblocks) ne tourne que dans le navigateur : pas de rendu côté serveur.
export const WorkspaceClient = dynamic(() => import("./Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <Loading text="Chargement…" />,
});
