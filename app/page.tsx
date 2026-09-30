import { cookies } from "next/headers";
import { HomeScreen } from "@/components/HomeScreen";
import { SESSION_COOKIE, readSession } from "@/lib/session";

type Props = { searchParams: Promise<{ projet?: string | string[] }> };

export default async function Home({ searchParams }: Props) {
  const store = await cookies();
  const projects = await readSession(store.get(SESSION_COOKIE)?.value);
  const params = await searchParams;
  const initialProject = typeof params.projet === "string" ? params.projet.slice(0, 40) : "";
  return (
    <HomeScreen
      projects={projects.map((p) => ({ slug: p.s, name: p.n }))}
      initialProject={initialProject}
      year={new Date().getFullYear()}
    />
  );
}
