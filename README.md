# Site de l'APPS — Association des Parents des Pitchouns Saussannais

Site public + espace membres avec calendrier partagé + back-office d'administration,
sur Cloudflare Workers et D1.

- **Partie publique** — accueil, l'association, événements, adhésion en ligne (widget HelloAsso), contact, mentions légales, confidentialité.
- **Espace membres** (connexion e-mail / mot de passe) — calendrier de l'année, création / modification / suppression d'événements, chaque action étant tracée.
- **Administration** (réservée au rôle `admin`) — création et gestion des comptes, envoi des e-mails d'activation, journal d'audit complet avec filtres et export CSV, messages reçus.

Aucune dépendance applicative : rendu HTML côté serveur, JavaScript minimal côté client.
Seul `wrangler` est installé, en outil de développement.

---

## Démarrage local

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run db:init
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Le site est alors sur `http://localhost:8787`.

Comptes du jeu de démonstration (**local uniquement**) :

| Compte | Mot de passe | Rôle |
| --- | --- | --- |
| `admin@apps-saussan.fr` | `AppsSaussan2026` | administrateur |
| `membre@apps-saussan.fr` | `AppsSaussan2026` | membre |
| `invite@apps-saussan.fr` | — | invitation en attente |

Sans clés Mailjet, les e-mails ne sont pas envoyés : leur contenu — **lien d'activation compris** —
est écrit dans la console de `wrangler dev`. C'est ce qui permet de tester le parcours
d'activation en local.

---

## Mise en production

### 1. Créer la base D1

```bash
npx wrangler d1 create apps-saussan
```

Reporter le `database_id` retourné dans `wrangler.jsonc`, puis créer les tables :

```bash
npm run db:init:remote
```

### 2. Renseigner les clés Mailjet

```bash
npx wrangler secret put MAILJET_API_KEY
```

```bash
npx wrangler secret put MAILJET_API_SECRET
```

Le domaine expéditeur (`MAIL_FROM` dans `wrangler.jsonc`) doit être validé côté Mailjet,
avec les enregistrements SPF et DKIM publiés, faute de quoi les e-mails d'activation
partiront en indésirables.

### 3. Déployer

```bash
npx wrangler deploy
```

### 4. Créer le premier administrateur

Il n'y a pas d'inscription libre sur le site : le premier compte s'amorce en ligne de
commande. Le script ci-dessous génère le SQL du compte, son jeton d'activation, et le lien
à ouvrir pour choisir votre mot de passe.

```bash
node scripts/premier-admin.mjs vous@exemple.fr Prénom Nom
```

Le script affiche trois choses : le SQL à insérer, la commande `wrangler` toute faite, et
le lien d'activation. Exécuter la commande, puis ouvrir le lien pour choisir votre mot de
passe — il est valable 7 jours et à usage unique.

Une fois connecté, tous les comptes suivants se créent depuis **Administration › Comptes**,
avec envoi automatique de l'e-mail d'invitation.

Ajouter `--local` pour faire la même chose sur la base de développement.

### 5. Ouvrir l'indexation

Tant que `ALLOW_INDEXING` vaut `"false"` dans `wrangler.jsonc`, toutes les pages portent
`noindex`. Passer la variable à `"true"` puis redéployer quand le site est prêt à être
référencé, et mettre `SITE_URL` à jour avec le domaine définitif.

---

## Plan Cloudflare et hachage des mots de passe

Le plan **Workers gratuit limite chaque requête à 10 ms de CPU**. Or PBKDF2-SHA256 coûte
environ 1 ms pour 10 000 itérations. La variable `PBKDF2_ITERATIONS` de `wrangler.jsonc`
est donc réglée à **50 000** (~6 ms), ce qui tient dans cette limite.

Sur le **plan payant** (5 $/mois, limite portée à 30 s), passer la variable à `"210000"`,
valeur conforme aux recommandations actuelles, puis redéployer. Le nombre d'itérations est
inscrit dans chaque empreinte : le changement n'invalide aucun mot de passe existant, il
ne s'applique qu'aux suivants.

---

## Architecture

```
src/
  index.js            routeur : chaque URL est déclarée, le reste tombe en 404
  lib/
    util.js           échappement HTML, dates françaises, réponses HTTP
    auth.js           PBKDF2, sessions, CSRF, jetons à usage unique
    audit.js          écriture du journal, calcul des différences
    email.js          envoi Mailjet et gabarits des e-mails
    layout.js         squelette HTML, navigations, pied de page
  routes/
    public.js         site public
    auth.js           connexion, activation, mot de passe oublié
    espace.js         calendrier, CRUD événements, compte personnel
    admin.js          comptes, journal d'audit, messages
db/
  schema.sql          schéma D1 (idempotent)
  seed.sql            jeu de démonstration — local uniquement
  reset.sql           suppression de toutes les tables
public/               feuilles de style, logo, favicon, robots.txt
```

### Sécurité

- Mots de passe hachés en PBKDF2-SHA256 avec sel aléatoire ; jamais stockés en clair.
- Sessions opaques : le cookie ne contient qu'un jeton aléatoire, son empreinte SHA-256
  sert de clé en base. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS.
- Double protection CSRF : contrôle de l'en-tête `Origin` sur tous les POST, plus un jeton
  par session sur les formulaires authentifiés.
- Limitation des tentatives : blocage au-delà de 8 échecs par IP ou par e-mail sur 15 minutes.
- Jetons d'activation et de réinitialisation à usage unique, expirant respectivement en
  7 jours et 2 heures.
- Un changement de mot de passe ou une suspension ferme toutes les sessions du compte.
- Échappement systématique de toute valeur injectée dans le HTML.

### Audit

Chaque action sensible écrit une ligne dans `audit_log` : auteur, date, action, entité
concernée, différences champ par champ (`{"lieu": ["avant", "après"]}`), adresse IP et
navigateur.

L'auteur est enregistré **en double** — identifiant et adresse e-mail — pour que la trace
reste lisible après la suppression du compte. Les suppressions d'événements sont logiques
(`deleted_at`), ce qui permet de les consulter et de les restaurer depuis la corbeille.

Un membre consulte sa propre activité dans « Mon activité » ; un administrateur voit
l'ensemble dans le journal d'audit, avec filtres par action, auteur, période et recherche
libre, et peut l'exporter en CSV.

---

## Contenus à personnaliser

Le site est fonctionnel mais certains textes sont génériques et méritent d'être repris
avec les informations réelles de l'association :

- `src/routes/public.js` — page **L'association** : composition du bureau, date de
  l'assemblée générale, présentation.
- `src/routes/public.js` — page **Accueil** : les trois chiffres clés de la section jaune.
- `src/routes/public.js` — **mentions légales** : nom du directeur de la publication.
- Le lien du widget HelloAsso pointe sur la campagne « adhesion-2026-2027 » : il devra être
  mis à jour à chaque nouvelle année scolaire.
