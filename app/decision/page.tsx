import type { Metadata } from "next";
import { DecisionButtons } from "@/components/DecisionButtons";
import { readDecisionToken } from "@/lib/decision";
import { getProject } from "@/lib/projects";

export const metadata: Metadata = { title: "Demande de projet", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ t?: string | string[] }> };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">{children}</div>
    </main>
  );
}

export default async function DecisionPage({ searchParams }: Props) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : "";
  const slug = await readDecisionToken(token);
  if (!slug) {
    return (
      <Card>
        <p className="text-sm">Ce lien est invalide ou a expiré.</p>
      </Card>
    );
  }

  const project = await getProject(slug).catch(() => null);
  if (!project) {
    return (
      <Card>
        <p className="text-sm">Cette demande n&apos;existe plus (elle a peut-être déjà été refusée).</p>
      </Card>
    );
  }

  const r = project.request;
  const rows: Array<[string, string]> = [
    ["Projet", project.name],
    ["Adresse", `/p/${project.slug}`],
    ["Demandé par", r?.requester ?? ""],
    ["E-mail", r?.email ?? ""],
    ["École", r?.school ?? ""],
    ["Classe", r?.className ?? ""],
    ["Cours", r?.course || "(non indiqué)"],
    ["Message", r?.message || "(aucun)"],
    ["Date", r?.requestedAt ? new Date(r.requestedAt).toLocaleString("fr-FR") : ""],
  ];

  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold">Demande de projet</h1>
      <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-neutral-500">{k}</dt>
            <dd className="break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {project.status === "pending" ? (
        <DecisionButtons token={token} />
      ) : (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Cette demande est déjà acceptée.</p>
      )}
    </Card>
  );
}
