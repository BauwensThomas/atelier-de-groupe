import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { WorkspaceClient } from "@/components/WorkspaceClient";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { getProject } from "@/lib/projects";

type Params = { params: Promise<{ slug: string }> };

async function findProject(slug: string) {
  const store = await cookies();
  const projects = await readSession(store.get(SESSION_COOKIE)?.value);
  return projects.find((p) => p.s === slug) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = await findProject(decodeURIComponent(slug));
  return { title: project ? project.n : "Atelier de groupe" };
}

export default async function ProjectPage({ params }: Params) {
  const slug = decodeURIComponent((await params).slug);
  const project = await findProject(slug);
  if (!project) redirect(`/?projet=${encodeURIComponent(slug)}`);
  // Projet supprimé ou pas encore accepté : retour à l'accueil.
  const stored = await getProject(slug).catch(() => null);
  if (!stored || stored.status !== "active") redirect("/");
  return <WorkspaceClient roomId={project.s} projectName={project.n} />;
}
