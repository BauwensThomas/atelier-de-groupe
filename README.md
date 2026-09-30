# Atelier de groupe

Document collaboratif pour un groupe de 4. On colle les questions d'un PDF d'exercices dans des blocs "Question", et chacun écrit ses réponses dans sa couleur, en même temps que les autres.

Stack : Next.js 16 (App Router, TypeScript, Tailwind), TipTap + Yjs, Liveblocks (temps réel et sauvegarde du document), docx (export Word).

## Fonctionnement

- L'accueil (`/`) est ouvert à tous : on y rejoint un projet (nom + mot de passe) ou on demande un nouveau projet.
- Une demande de projet envoie un e-mail à l'administrateur (`ADMIN_EMAIL`), qui accepte ou refuse depuis le lien reçu. Le projet est réservé "en attente" jusque-là.
- Chaque projet a son adresse (`/p/nom-du-projet`) et son mot de passe. Pas de base de données : chaque projet est un salon Liveblocks, avec son nom et l'empreinte (scrypt) de son mot de passe dans les informations privées du salon.
- Le bouton "Partager" copie le lien du projet (le mot de passe reste demandé).
- Après connexion, chacun choisit son prénom et sa couleur (les couleurs déjà prises sont grisées).
- Tout le texte tapé ou collé prend la couleur de son auteur. Le survol d'un texte affiche le prénom de l'auteur.
- Les blocs "Question" restent en noir. Ils se verrouillent dès qu'on en sort. Le cadenas en haut à droite permet de les déverrouiller pour corriger.
- Export : "Exporter en Word" (.docx tout en noir) et "Imprimer / PDF".

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
7. Enregistrer le fichier, puis relancer `npm run dev`.

## 3. Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 : la page d'accueil permet de rejoindre ou de demander un projet.

## 4. Déployer sur Vercel

Le code est dans un dépôt GitHub privé. Vercel l'importe et redéploie automatiquement à chaque `git push` sur `main`.

1. Sur https://vercel.com : "Add New...", puis "Project", puis "Import" à côté du dépôt.
2. Project Name : `ateliergroupe` (adresse `ateliergroupe.vercel.app`, à autoriser dans le widget Turnstile).
3. Section "Environment Variables" : coller tout le contenu de `.env.local` dans la première case "Key", Vercel crée une ligne par variable. Points importants :
   - `AUTH_SECRET` doit être identique à celui utilisé pour créer les projets : il chiffre aussi les mots de passe gardés pour les e-mails.
   - Mettre les vraies clés Turnstile (pas les clés de test).
4. Cliquer sur "Deploy".

Pour changer une variable plus tard : projet Vercel, onglet "Settings", puis "Environment Variables". Il faut ensuite relancer un déploiement (onglet "Deployments", menu "..." du dernier déploiement, "Redeploy").

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
- `/api/liveblocks-auth` ne donne accès qu'aux salons des projets présents dans le cookie.
