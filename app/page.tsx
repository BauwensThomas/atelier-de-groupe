import { cookies } from "next/headers";
import { HomeScreen } from "@/components/HomeScreen";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { getProject } from "@/lib/projects";

type Props = { searchParams: Promise<{ projet?: string | string[] }> };

export default async function Home({ searchParams }: Props) {
  const store = await cookies();
  const remembered = await readSession(store.get(SESSION_COOKIE)?.value);
  // "Mes projets" : seulement ceux qui existent encore (un projet supprimé disparaît de la liste).
  const checks = await Promise.all(
    remembered.map(async (p) => {
      const project = await getProject(p.s).catch(() => undefined);
      return project === undefined || (project && project.status === "active") ? p : null;
    }),
  );
  const projects = checks.filter((p) => p !== null);
  const params = await searchParams;
  const initialProject = typeof params.projet === "string" ? params.projet.slice(0, 40) : "";
  return (
    <HomeScreen
      projects={projects.map((p) => ({ slug: p.s, name: p.n, prof: p.r === "prof" }))}
      initialProject={initialProject}
      year={new Date().getFullYear()}
    />
  );
}
