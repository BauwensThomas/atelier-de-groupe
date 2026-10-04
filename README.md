# Atelier de groupe

Document collaboratif pour un groupe de 4. On colle les questions d'un PDF d'exercices dans des blocs "Question", et chacun écrit ses réponses dans sa couleur, en même temps que les autres.

Stack : Next.js 16 (App Router, TypeScript, Tailwind), TipTap + Yjs, Liveblocks (temps réel et sauvegarde du document), Vercel Blob (images et fichiers, en privé), Resend (e-mails), Cloudflare Turnstile (anti-robot), docx (export Word), docx-preview, SheetJS et JSZip (aperçus de fichiers).

En ligne : https://ateliergroup.vercel.app (mode d'emploi sur `/aide`).

## Fonctionnement

- L'accueil (`/`) est ouvert à tous : on y rejoint un projet (nom + mot de passe) ou on demande un nouveau projet.
- Une demande de projet envoie un e-mail à l'administrateur (`ADMIN_EMAIL`), qui accepte ou refuse depuis le lien reçu. Le projet est réservé "en attente" jusque-là.
- Chaque projet a son adresse (`/p/nom-du-projet`) et son mot de passe. Pas de base de données : chaque projet est un salon Liveblocks, avec son nom et l'empreinte (scrypt) de son mot de passe dans les informations privées du salon.
- Le bouton "Partager" copie le lien du projet (le mot de passe reste demandé).
- Après connexion, chacun choisit son prénom et sa couleur (les couleurs déjà prises sont grisées).
- Tout le texte tapé ou collé prend la couleur de son auteur. Le survol d'un texte affiche le prénom de l'auteur.
- Les blocs "Question" restent en noir. Ils se verrouillent dès qu'on en sort. Le cadenas en haut à droite permet de les déverrouiller pour corriger.
- Le texte d'un autre n'est pas effacé mais barré (son auteur peut l'effacer ou le restaurer). Le texte barré n'apparaît pas à l'export.
- Export : "Exporter en Word" (.docx) et "Imprimer / PDF", au choix "En couleur" (couleur de chaque auteur) ou "Tout en noir".
- Versions : copie automatique de chaque feuille toutes les 10 minutes, "Enregistrer une version", restauration (une ligne par enregistrement, une ou toutes les feuilles).
- Feuilles : plusieurs pages blanches par projet ("Nouvelle feuille"), chacune avec son texte, ses versions et ses commentaires.
- Barre d'outils : titres, gras, italique, listes, tableaux, images (bouton, coller ou glisser ; taille réglable), "Rechercher" (Ctrl+F), "Commenter", compteur de mots et de pages.
- Panneau de droite (repliable) : projet et date de rendu (compte à rebours "J-5"), membres en ligne, fichiers, commentaires, tâches, sommaire (sujets et questions), activité.
- Fichiers du projet (50 Mo) : image, PDF, Word, Excel, PowerPoint, envoyés une fois pour tout le groupe et ouverts à côté du document (bordure réglable, zoom, plein écran). Word, Excel et PowerPoint passent par la visionneuse Office de Microsoft (lien secret de 10 minutes) ; un "Aperçu simplifié" les affiche sans quitter le site.
- Commentaires sur un passage, avec réponses, "résolu" et mentions @prénom (rappel à l'écran pour la personne citée).
- Tâches du groupe (qui, pour quand, à faire, en cours, fini), en liste et en tableau.
- Lien professeur : lecture seule (imposée par Liveblocks), notes en rose sur des passages, couleur réservée ; le professeur ne voit ni les fichiers, ni les tâches, ni l'activité.

## Variables d'environnement

Les secrets sont lus uniquement côté serveur. Aucune variable secrète ne commence par `NEXT_PUBLIC_` : la seule variable `NEXT_PUBLIC_` est la clé de site Turnstile, publique par conception.

| Nom | Rôle |
| --- | --- |
| `LIVEBLOCKS_SECRET_KEY` | Clé secrète Liveblocks (commence par `sk_`) |
| `AUTH_SECRET` | Clé qui signe les cookies et les liens de décision (32 caractères minimum) |
| `RESEND_API_KEY` | Clé Resend pour envoyer les e-mails de demande de projet |
| `ADMIN_EMAIL` | Adresse qui reçoit les demandes de projet |
| `MAIL_FROM` | Facultatif : expéditeur d'un domaine vérifié chez Resend (permet de prévenir aussi le demandeur) |
| `TURNSTILE_SECRET_KEY` | Facultatif : clé secrète Cloudflare Turnstile (anti-robot) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Facultatif : clé de site Turnstile (pas secrète) |
| `BLOB_READ_WRITE_TOKEN` | Jeton du stockage Vercel Blob (images et fichiers). Sans lui, images et fichiers sont désactivés |
| `BLOB_STORE_ID` | Identifiant du stockage Vercel Blob (ajouté par Vercel avec le jeton) |

En local sans `RESEND_API_KEY`, le lien de décision d'une demande s'affiche dans le terminal de `npm run dev`.

Le fichier `.env.example` liste ces noms sans valeur. Le vrai fichier `.env.local` est ignoré par Git.

## 1. Créer le projet Liveblocks et récupérer la clé secrète

1. Aller sur https://liveblocks.io et cliquer sur "Sign up" (ou "Get started").
2. Créer un compte (GitHub, Google ou e-mail).
3. Dans le tableau de bord, ouvrir le projet créé par défaut (ou cliquer sur "Create project", lui donner un nom, puis valider).
4. Dans le menu de gauche du projet, cliquer sur "API keys".
5. Dans la partie "Secret key", cliquer sur l'icône de copie. La clé commence par `sk_`.
6. Ne pas la coller ailleurs que dans `.env.local` et dans Vercel.

Le plan gratuit suffit pour un groupe de 4.

## 2. Remplir les variables en local

1. Copier `.env.example` en `.env.local` à la racine du projet.
2. Générer `AUTH_SECRET` sans l'afficher : dans le terminal PowerShell de VS Code, lancer

   ```powershell
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | Set-Clipboard
   ```

   La clé est copiée dans le presse-papiers : la coller après `AUTH_SECRET=`.
3. Coller la clé Liveblocks après `LIVEBLOCKS_SECRET_KEY=`.
4. Resend (https://resend.com) : créer une clé "Sending access" et la coller après `RESEND_API_KEY=`. Mettre l'adresse du compte Resend après `ADMIN_EMAIL=`.
5. Facultatif, pour écrire aussi aux demandeurs : vérifier un domaine chez Resend (ici `atelier.belgacai.com`) et remplir `MAIL_FROM="Atelier de groupe <noreply@atelier.belgacai.com>"`.
6. Facultatif, anti-robot : créer un widget Cloudflare Turnstile (mode Managed) et remplir `TURNSTILE_SECRET_KEY` et `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. En local, on peut utiliser les clés de test officielles de Cloudflare (`1x00000000000000000000AA` et `1x0000000000000000000000000000000AA`).
7. Facultatif, images et fichiers : voir la partie "Stockage des images et fichiers" plus bas, puis coller le jeton après `BLOB_READ_WRITE_TOKEN=`.
8. Enregistrer le fichier, puis relancer `npm run dev`.

## 3. Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 : la page d'accueil permet de rejoindre ou de demander un projet.

## 4. Déployer sur Vercel

Le code est dans un dépôt GitHub privé. Vercel l'importe et redéploie automatiquement à chaque `git push` sur `main`.

1. Sur https://vercel.com : "Add New...", puis "Project", puis "Import" à côté du dépôt.
2. Project Name : `ateliergroupe`. Adresse principale : `ateliergroup.vercel.app` (avec `ateliergroupe-lemon.vercel.app`), à autoriser dans le widget Turnstile.
3. Section "Environment Variables" : coller tout le contenu de `.env.local` dans la première case "Key", Vercel crée une ligne par variable. Points importants :
   - `AUTH_SECRET` doit être identique à celui utilisé pour créer les projets : il chiffre aussi les mots de passe gardés pour les e-mails.
   - Mettre les vraies clés Turnstile (pas les clés de test).
4. Cliquer sur "Deploy".

Pour changer une variable plus tard : projet Vercel, onglet "Settings", puis "Environment Variables". Il faut ensuite relancer un déploiement (onglet "Deployments", menu "..." du dernier déploiement, "Redeploy").

## Stockage des images et fichiers (Vercel Blob)

1. Sur Vercel, projet `ateliergroupe` : onglet "Storage", puis "Create Database", puis "Blob".
2. Nom `atelier-images`, région Frankfurt (fra1), accès **Private**, et cocher "Add a read-write token env var to this connection". Cliquer sur "Create" : Vercel ajoute `BLOB_READ_WRITE_TOKEN` et `BLOB_STORE_ID` au projet.
3. Pour le local : la variable est "sensible", donc invisible dans "Settings". Copier la ligne `BLOB_READ_WRITE_TOKEN` depuis la page du stockage ("Copy Snippet") et la coller dans `.env.local`.
4. La visionneuse Microsoft ne marche qu'en ligne (elle ne peut pas joindre `localhost`) : en local, l'aperçu simplifié s'affiche.

## 5. Tester à deux

1. Sur l'accueil, onglet "Demander un projet" : remplir le formulaire. L'administrateur reçoit un e-mail et accepte la demande.
2. Ouvrir le site dans deux navigateurs différents (par exemple une fenêtre normale et une fenêtre privée), et rejoindre le projet dans les deux (nom + mot de passe).
3. Choisir un prénom et une couleur dans chacun : la couleur du premier doit être grisée dans le second.
4. Dans le panneau de droite, chacun doit voir l'autre dans "Membres".
5. Écrire dans le même paragraphe depuis les deux navigateurs : le texte apparaît en direct chez l'autre, chacun dans sa couleur, avec le curseur et le prénom de l'autre.
6. Ajouter une "Question" et un "Sujet", effacer le texte de l'autre (il reste barré), tester "Versions", "Exporter en Word" et "Imprimer / PDF".

## Sécurité

- Aucun secret dans le code : tout vient des variables d'environnement, lues côté serveur.
- `/api/projects/join` vérifie le mot de passe (empreinte scrypt), bloque pendant 10 minutes après 5 échecs par IP et par projet, demande Turnstile après 3 échecs si configuré, puis pose un cookie httpOnly signé (JWT) listant les projets rejoints.
- `/api/projects/request` exige Turnstile si configuré et limite à 3 demandes par heure et par IP.
- `/api/projects/forgot` envoie le mot de passe uniquement à l'adresse qui a créé le projet, avec la même réponse que l'adresse soit connue ou non.
- Les mots de passe sont stockés en empreinte scrypt (connexion) et chiffrés en AES-256-GCM (pour les e-mails), dans les informations privées des salons Liveblocks.
- `proxy.ts` (le middleware de Next.js 16) protège les pages de projet `/p/...` : il faut avoir rejoint le projet.
- `/api/liveblocks-auth` ne donne accès qu'aux salons des projets présents dans le cookie. Le professeur reçoit un accès en lecture seule au document et en écriture au seul salon des commentaires (`<projet>--notes`).
- Lien professeur : clé aléatoire chiffrée dans les informations privées du salon, placée après le `#` du lien (jamais envoyée au serveur dans l'adresse, effacée de la barre d'adresse). "Nouveau lien" coupe aussi l'accès des professeurs déjà connectés.
- Images et fichiers : stockage Vercel Blob **privé**, lisible seulement à travers l'application, qui vérifie la session (les fichiers sont refusés au professeur). Type vérifié d'après le contenu pour les images, liste fermée de types et 50 Mo maximum pour les fichiers, envoi autorisé seulement vers un emplacement précis du projet. Fichiers servis avec `nosniff` et, sauf PDF, en bac à sable.
- Visionneuse Microsoft : lien signé (HMAC, clé dérivée de `AUTH_SECRET`) valable 10 minutes, propre à un fichier, créé seulement pour un élève du projet.
- Nettoyage du stockage : les images et fichiers qui ne servent plus (ni dans les feuilles, ni dans les versions, ni dans la liste des fichiers) sont effacés après 7 jours ; tout est effacé quand un projet est refusé.
- En-têtes de sécurité sur tout le site : `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (pas de caméra, micro ni position).
- Pare-feu Vercel : 60 envois par minute et par IP au plus vers `/api/projects/`.
