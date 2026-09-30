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
| `SITE_PASSWORD` | Ancien mot de passe commun : sert seulement à la première connexion au projet d'origine `gestionprojet` |
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
4. Choisir un mot de passe commun et l'écrire après `SITE_PASSWORD=`.
5. Enregistrer le fichier.

Résultat attendu (avec vos valeurs, sans guillemets) :

```
LIVEBLOCKS_SECRET_KEY=sk_...
SITE_PASSWORD=...
AUTH_SECRET=...
```

## 3. Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 : la page d'accueil permet de rejoindre ou de demander un projet.

## 4. Déployer sur Vercel

1. Créer un dépôt GitHub vide (bouton "New" sur github.com), sans README.
2. Dans le terminal du projet :

   ```bash
   git init
   git status
   ```

   Vérifier que `.env.local` et le dossier `MD` n'apparaissent pas dans la liste. Puis :

   ```bash
   git add .
   git commit -m "Premier commit"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/VOTRE-DEPOT.git
   git push -u origin main
   ```

3. Aller sur https://vercel.com et se connecter avec GitHub.
4. Cliquer sur "Add New..." puis "Project".
5. Dans la liste, cliquer sur "Import" à côté du dépôt.
6. Ouvrir la section "Environment Variables" et ajouter les trois variables, une par une (Key, Value, puis "Add") : `LIVEBLOCKS_SECRET_KEY`, `SITE_PASSWORD`, `AUTH_SECRET`. On peut réutiliser les mêmes valeurs qu'en local, ou générer un autre `AUTH_SECRET`.
7. Cliquer sur "Deploy" et attendre la fin.
8. Cliquer sur l'aperçu ou sur "Continue to Dashboard" puis "Visit" : l'adresse est en `.vercel.app`.

Pour changer une variable plus tard : projet Vercel, onglet "Settings", puis "Environment Variables". Il faut ensuite relancer un déploiement (onglet "Deployments", menu "..." du dernier déploiement, "Redeploy").

## 5. Tester à deux

1. Ouvrir le site dans deux navigateurs différents (par exemple Chrome et Firefox, ou une fenêtre normale et une fenêtre privée).
2. Se connecter avec le mot de passe dans les deux.
3. Choisir un prénom et une couleur dans le premier, puis dans le second : la couleur du premier doit être grisée.
4. Dans le panneau de droite, chacun doit voir l'autre dans "En ligne".
5. Écrire dans le même paragraphe depuis les deux navigateurs : le texte apparaît en direct chez l'autre, chacun dans sa couleur, avec le curseur de l'autre et son prénom.
6. Cliquer sur "Question" (ou Ctrl+Alt+Q), écrire une question, puis cliquer en dessous : le bloc se verrouille. Essayer d'écrire dedans : le message "Question verrouillée" apparaît.
7. Recharger la page : le contenu est toujours là (sauvegardé par Liveblocks).
8. Tester "Exporter en Word" et "Imprimer / PDF".

## Sécurité

- Aucun secret dans le code : tout vient des variables d'environnement, lues côté serveur.
- `/api/projects/join` vérifie le mot de passe (empreinte scrypt), bloque pendant 10 minutes après 5 échecs par IP et par projet, demande Turnstile après 3 échecs si configuré, puis pose un cookie httpOnly signé (JWT) listant les projets rejoints.
- `/api/projects/request` exige Turnstile si configuré et limite à 3 demandes par heure et par IP.
- `proxy.ts` (le middleware de Next.js 16) protège les pages de projet `/p/...` : il faut avoir rejoint le projet.
- `/api/liveblocks-auth` ne donne accès qu'aux salons des projets présents dans le cookie.
