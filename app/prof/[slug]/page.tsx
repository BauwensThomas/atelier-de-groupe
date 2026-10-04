import type { Metadata } from "next";
import { TeacherJoin } from "@/components/TeacherJoin";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Accès professeur", robots: { index: false } };

// Lien professeur : /prof/<projet>#<clé>. La clé reste dans le navigateur (jamais envoyée dans l'adresse au serveur).
export default async function TeacherPage({ params }: Params) {
  const slug = decodeURIComponent((await params).slug).slice(0, 40);
  return <TeacherJoin slug={slug} />;
}
