import type { Metadata } from "next";
import Link from "next/link";
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
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={15} aria-hidden />
        Retour à l&apos;accueil
      </Link>

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
              Remplis le formulaire : nom du projet, prénom, nom, <strong>e-mail personnel</strong>, école, classe,
              cours, et un <strong>mot de passe</strong> (deux fois). Utilise ton adresse personnelle (Gmail,
              Outlook.com…) : les adresses de l&apos;école bloquent nos e-mails.
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
            <li>
              Les boutons <strong>−</strong> et <strong>+</strong>, au bout de la barre d&apos;outils, zooment la page. Clique sur
              le pourcentage pour revenir à 100 %.
            </li>
            <li>
              <strong>« Rechercher »</strong> (ou Ctrl+F) trouve un mot dans tout le document. Entrée passe au résultat
              suivant.
            </li>
            <li>
              Le <strong>« Sommaire »</strong> du panneau de droite liste les sujets et les questions : un clic t&apos;y emmène.
            </li>
            <li>
              Le nombre de <strong>mots</strong> et de <strong>pages</strong> est affiché au bout de la barre d&apos;outils.
            </li>
            <li>
              Dans la carte <strong>« Projet »</strong>, ajoute la <strong>date de rendu</strong> : le compte à rebours
              (J-5) est visible par tout le groupe.
            </li>
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
              <strong>« Exporter en Word »</strong> : un fichier .docx avec le titre, les auteurs et les numéros de page.
            </li>
            <li>
              <strong>« Imprimer / PDF »</strong> : pour imprimer, ou enregistrer en PDF.
            </li>
            <li>
              Pour les deux, tu choisis : <strong>« En couleur »</strong> (chaque texte dans la couleur de son auteur,
              pour voir qui a écrit quoi) ou <strong>« Tout en noir »</strong> (version propre pour le rendu final). Le
              texte barré n&apos;apparaît jamais.
            </li>
          </Points>
        </Section>

        <Section n={8} title="Tâches, commentaires, images">
          <Points>
            <li>
              <strong>« Tâches »</strong> (panneau de droite) : ajoute une tâche, clique dessus pour choisir qui s&apos;en
              charge et pour quand. Le rond change l&apos;état : à faire, en cours, fini. « Ouvrir le tableau » montre
              les trois colonnes en grand.
            </li>
            <li>
              <strong>Commenter</strong> : sélectionne un passage, puis <strong>« Commenter »</strong> dans la barre
              d&apos;outils (ou Ctrl+Alt+M). Le passage est surligné en jaune, avec une pastille : clique dessus pour lire,
              répondre ou marquer « résolu ».
            </li>
            <li>
              Dans un commentaire, tape <strong>@</strong> puis choisis un prénom pour <strong>citer quelqu&apos;un</strong>.
              La personne voit en bas de son écran « Tu as été cité dans un commentaire », jusqu&apos;à ce qu&apos;elle
              l&apos;ouvre.
            </li>
            <li>
              <strong>Images</strong> : bouton image de la barre d&apos;outils, ou colle (Ctrl+V) ou glisse une image dans
              la page. Clique sur une image pour choisir sa taille (petite, moyenne, grande, pleine largeur). Les images restent
              privées au groupe.
            </li>
          </Points>
        </Section>

        <Section n={9} title="Feuilles et fichiers">
          <Points>
            <li>
              <strong>« Nouvelle feuille »</strong>, au-dessus de la barre d&apos;outils, ajoute une page blanche au projet.
              Chaque feuille a son texte, ses versions et ses commentaires. Double-clic sur un onglet pour le renommer.
            </li>
            <li>
              Carte <strong>« Fichiers »</strong> (panneau de droite) : ajoute une image, un PDF, un Word, un Excel ou un
              PowerPoint (50 Mo maximum), ou glisse-le dans la carte. Tout le groupe le retrouve sans le renvoyer.
            </li>
            <li>
              Clique sur un fichier pour l&apos;<strong>ouvrir à côté du document</strong>. Le bouton à double flèche le
              passe de l&apos;autre côté. Word, Excel et PowerPoint s&apos;affichent comme dans Office grâce à la visionneuse
              de Microsoft (le fichier passe par Microsoft le temps de l&apos;affichage) ; « Aperçu simplifié » les affiche
              sans quitter le site. Les boutons − et + zooment, le bouton plein écran agrandit le fichier, et la bordure entre
              le document et le fichier se fait glisser pour changer les largeurs.
            </li>
          </Points>
        </Section>

        <Section n={10} title="Le professeur">
          <Points>
            <li>
              Dans la carte « Projet », <strong>« Lien professeur »</strong> donne un lien à envoyer à ton professeur. Il
              n&apos;a pas besoin du mot de passe.
            </li>
            <li>
              Avec ce lien, il <strong>lit le document sans pouvoir le modifier</strong>, et y laisse des{" "}
              <strong>notes en rose</strong>. Réponds-lui, puis clique sur « Marquer corrigé » une fois la correction
              faite.
            </li>
            <li>« Nouveau lien » coupe l&apos;accès de l&apos;ancien lien.</li>
          </Points>
        </Section>

        <section className="rounded-xl bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-200">
          <h2 className="mb-3 text-base font-semibold text-white">Bon à savoir</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-white">Pas d&apos;e-mail ?</strong> Vérifie que tu as donné ton adresse
              personnelle (pas celle de l&apos;école). Regarde aussi dans le courrier indésirable (et l&apos;onglet
              « Autres » dans Outlook), puis ajoute{" "}
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
              <strong className="text-white">Se déconnecter</strong> : en bas du panneau de droite. Sur un ordinateur de
              l&apos;école ou partagé, pense à cliquer dessus en partant : fermer la page ne suffit pas, le navigateur
              resterait connecté. Tu restes membre du projet, le mot de passe sera redemandé.
            </li>
            <li>
              <strong className="text-white">Quitter le projet</strong> : sous « Se déconnecter ». Tu sors du groupe
              (retiré des membres). Il faudra le mot de passe pour revenir.
            </li>
            <li>Le mot de passe du projet ne se partage qu&apos;avec ton groupe.</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Aller à l&apos;accueil
        </Link>
        <p className="text-xs text-neutral-400">© {year} Belgacai</p>
      </div>
    </main>
  );
}
