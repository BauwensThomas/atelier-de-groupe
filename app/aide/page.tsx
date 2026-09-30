import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowLeft, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Mode d'emploi : Atelier de groupe",
  description: "Comment créer, rejoindre et utiliser un projet de groupe",
};

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

function Points({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export default function HelpPage() {
  const year = new Date().getFullYear();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <a href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={15} aria-hidden />
        Retour à l&apos;accueil
      </a>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
          <Users size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Mode d&apos;emploi</h1>
          <p className="text-sm text-neutral-500">
            Travailler à plusieurs sur le même document, en même temps. Chacun écrit dans sa couleur.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Section n={1} title="Créer le projet du groupe (une seule personne par groupe)">
          <Steps>
            <li>
              Sur l&apos;accueil, clique sur <strong>« Demander un projet »</strong>.
            </li>
            <li>
              Remplis le formulaire : nom du projet, prénom, nom, e-mail, école, classe, cours, et un{" "}
              <strong>mot de passe</strong> (deux fois).
            </li>
            <li>
              Coche <strong>« Vérifiez que vous êtes humain »</strong>, puis clique sur{" "}
              <strong>« Envoyer la demande »</strong>.
            </li>
            <li>
              Quand la demande est acceptée, tu reçois un e-mail avec le <strong>nom du projet</strong>, le{" "}
              <strong>mot de passe</strong> et un bouton <strong>« Se connecter »</strong>. Pense à regarder les spams.
            </li>
          </Steps>
        </Section>

        <Section n={2} title="Rejoindre le projet (tout le groupe)">
          <Steps>
            <li>
              Sur l&apos;accueil, onglet <strong>« Rejoindre un projet »</strong> : nom du projet et mot de passe, puis{" "}
              <strong>« Entrer »</strong>.
            </li>
            <li>
              Choisis ton <strong>prénom</strong> et ta <strong>couleur</strong>. Les couleurs déjà prises sont grisées.
            </li>
            <li>
              Pour inviter le groupe : bouton <strong>« Partager »</strong> en haut à droite, qui copie le lien. Le mot de
              passe reste demandé.
            </li>
          </Steps>
        </Section>

        <Section n={3} title="Écrire ensemble">
          <Points>
            <li>
              Tout ce que tu écris apparaît <strong>dans ta couleur</strong>, en direct chez les autres. Tu vois aussi le
              curseur et le prénom de chacun.
            </li>
            <li>
              Survole un texte pour savoir <strong>qui l&apos;a écrit</strong>.
            </li>
            <li>
              En haut du document : <strong>« Titre du projet »</strong> et <strong>« Auteurs »</strong>.
            </li>
            <li>La barre d&apos;outils permet de faire des titres, du gras, de l&apos;italique, des listes et des tableaux.</li>
          </Points>
        </Section>

        <Section n={4} title="Questions et sujets">
          <Points>
            <li>
              <strong>« Question »</strong> (ou Ctrl+Alt+Q) et <strong>« Sujet »</strong> (ou Ctrl+Alt+S) ajoutent un
              bloc gris à l&apos;endroit du curseur. Colle-y l&apos;énoncé.
            </li>
            <li>
              Le bloc <strong>se verrouille</strong> dès que tu en sors, pour que personne ne l&apos;abîme par erreur.
              Pour corriger, clique sur le <strong>cadenas</strong> en haut à droite du bloc.
            </li>
            <li>
              Écris ta réponse <strong>sous</strong> le bloc.
            </li>
          </Points>
        </Section>

        <Section n={5} title="Effacer et corriger">
          <Points>
            <li>Ton propre texte s&apos;efface normalement.</li>
            <li>
              Le texte d&apos;un autre <strong>reste visible, barré</strong>. Son auteur peut l&apos;effacer pour de bon,
              ou cliquer dedans puis sur <strong>« Restaurer »</strong> pour annuler la rature.
            </li>
            <li>Le texte barré n&apos;apparaît pas dans l&apos;export final.</li>
          </Points>
        </Section>

        <Section n={6} title="Ne rien perdre">
          <Points>
            <li>
              Une copie du document est faite <strong>automatiquement</strong> toutes les 10 minutes.
            </li>
            <li>
              Bouton <strong>« Versions »</strong> : voir les copies, en enregistrer une, ou{" "}
              <strong>revenir à une version précédente</strong>.
            </li>
            <li>
              Le panneau <strong>« Activité »</strong> montre qui a fait quoi, et à quelle heure.
            </li>
          </Points>
        </Section>

        <Section n={7} title="Rendre le travail">
          <Points>
            <li>
              <strong>« Exporter en Word »</strong> : un fichier .docx tout en noir, avec le titre, les auteurs et les
              numéros de page.
            </li>
            <li>
              <strong>« Imprimer / PDF »</strong> : pour imprimer, ou enregistrer en PDF.
            </li>
          </Points>
        </Section>

        <section className="rounded-xl bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-200">
          <h2 className="mb-3 text-base font-semibold text-white">Bon à savoir</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-white">Pas d&apos;e-mail ?</strong> Regarde dans le courrier indésirable (et
              l&apos;onglet « Autres » dans Outlook), puis ajoute{" "}
              <strong className="text-white">noreply@atelier.belgacai.com</strong> à tes expéditeurs approuvés pour
              recevoir les prochains.
            </li>
            <li>
              <strong className="text-white">Inactivité</strong> : après 5 minutes sans rien faire, tu es déconnecté.
              Clique sur « Reprendre », pas besoin du mot de passe.
            </li>
            <li>
              <strong className="text-white">Mot de passe oublié</strong> : sur l&apos;accueil, clique sur « Mot de passe
              oublié ? » et indique l&apos;e-mail de la personne qui a créé le projet. Elle le recevra.
            </li>
            <li>
              <strong className="text-white">Quitter le projet</strong> : en bas du panneau de droite. Il faudra le mot
              de passe pour revenir.
            </li>
            <li>Le mot de passe du projet ne se partage qu&apos;avec ton groupe.</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <a
          href="/"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Aller à l&apos;accueil
        </a>
        <p className="text-xs text-neutral-400">© {year} Belgacai</p>
      </div>
    </main>
  );
}
