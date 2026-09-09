# Site de l'APPS — Association des Parents des Pitchouns Saussannais

Site public + espace membres avec calendrier partagé + back-office d'administration,
sur Cloudflare Workers et D1.

- **Partie publique** — accueil avec section « À la une », actualités, l'association, événements, adhésion en ligne (widget HelloAsso), contact, mentions légales, confidentialité. Flux d'abonnement iCalendar et RSS.
- **Espace membres** (connexion e-mail / mot de passe) — calendrier de l'année, création / modification / suppression d'événements, rédaction d'articles « À la une » avec image mise en avant, chaque action étant tracée.
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

## Images des articles

R2 n'étant pas activé sur le compte Cloudflare, les images sont stockées **en base**,
dans la table `medias`. Avant l'envoi, le navigateur les redimensionne à 1600 px de côté
au maximum et les recompresse en JPEG : une photo de téléphone de 4 Mo arrive à 200 ou
300 Ko. Le serveur refuse au-delà de 1,2 Mo.

Ce choix a été vérifié en production : un objet de 700 Ko s'insère et se ressert
correctement. Il convient à quelques centaines d'articles illustrés.

Pour passer à R2 le jour où il sera activé, seul `src/lib/medias.js` est à réécrire :
tout le reste du code passe par ses quatre fonctions (`enregistrerImage`, `lireImage`,
`supprimerImage`, `servirImage`).

Attention à un piège : D1 restitue les colonnes BLOB sous forme de **tableau de nombres**,
et non d'`ArrayBuffer`. Sans conversion en `Uint8Array`, la réponse HTTP part avec un corps
vide et un statut 200 — l'erreur est silencieuse.

---

## Flux d'abonnement

| Adresse | Contenu |
| --- | --- |
| `/calendrier.ics` | tous les événements publics, à ajouter dans un agenda |
| `/evenements/<id>.ics` | un seul événement (bouton « Ajouter à mon agenda ») |
| `/actualites.rss` | les trente derniers articles publiés |

Le calendrier embarque une définition du fuseau `Europe/Paris`, de sorte que les
heures restent justes de part et d'autre du changement d'heure. Les événements
internes n'y figurent jamais.

---

## Sécurité des en-têtes

Chaque page HTML est servie avec une `Content-Security-Policy`. Les scripts sont
autorisés par **nonce**, régénéré à chaque réponse et injecté dans les balises au
moment de l'envoi : un script introduit par une faille d'échappement n'en
porterait pas et ne s'exécuterait pas.

`style-src` conserve `'unsafe-inline'`, l'interface utilisant des attributs
`style` ponctuels. C'est un compromis assumé : le risque n'a pas de commune
mesure avec celui des scripts.

Les polices sont **servies par le Worker** et non par Google Fonts. Aucune
adresse IP de visiteur ne part vers un tiers, ce qui rend la page Confidentialité
exacte et permet un `font-src 'self'` strict. Seul le domaine HelloAsso est
autorisé, en `frame-src`, pour le formulaire d'adhésion.

---

## Entretien et sauvegarde

Les sessions et jetons expirés sont supprimés automatiquement, environ une
requête sur cinquante, après l'envoi de la réponse. Sans cela les deux tables
grossiraient indéfiniment.

### Migrations

`schema.sql` crée les tables manquantes mais ne touche pas à celles qui
existent déjà : une base en service ne gagnera donc jamais une colonne par ce
biais. Les évolutions du schéma vivent dans `db/migrations/`, numérotées, et
s'appliquent une seule fois, d'abord en local puis en production :

```bash
npx wrangler d1 execute apps-saussan --local --file=./db/migrations/002-instances-et-leaders.sql
```

```bash
npx wrangler d1 execute apps-saussan --remote --file=./db/migrations/002-instances-et-leaders.sql
```

Pour exporter la base hors de Cloudflare :

```bash
node scripts/sauvegarde.mjs
```

Le fichier obtenu est un script SQL rejouable avec
`wrangler d1 execute apps-saussan --remote --file=<fichier>`. Les images sont
exclues par défaut vu leur poids ; ajouter `--avec-images` pour les inclure.
La restauration a été vérifiée sur la base de développement.

---

## Architecture

```
src/
  index.js            routeur : chaque URL est déclarée, le reste tombe en 404
  lib/
    util.js           échappement HTML, dates françaises, réponses HTTP
    auth.js           PBKDF2, sessions, CSRF, jetons à usage unique
    audit.js          écriture du journal, calcul des différences
    email.js          envoi Mailjet, gabarits, envoi groupé
    medias.js         stockage des images (voir « Images » ci-dessous)
    icones.js         jeu d'icônes SVG maison
    flux.js           calendrier iCalendar et flux RSS
    instances.js      bureau, comité d'administration, audience des événements
    entetes.js        en-têtes de sécurité et entretien de la base
    layout.js         squelette HTML, navigations, pied de page
  routes/
    public.js         site public
    auth.js           connexion, activation, mot de passe oublié
    espace.js         calendrier, CRUD événements, compte personnel
    articles.js       articles « À la une », côté membres et côté public
    admin.js          comptes, journal d'audit, messages
scripts/
  premier-admin.mjs   amorce le premier compte administrateur
  sauvegarde.mjs      export SQL de la base
db/
  schema.sql          schéma D1 (idempotent)
  seed.sql            jeu de démonstration — local uniquement
  reset.sql           suppression de toutes les tables
  migrations/         évolutions du schéma sur une base déjà en service
public/               feuilles de style, polices, logo, favicon, robots.txt
```

### Instances, audience et équipes

Chaque compte appartient à un cercle : simple **membre**, **comité
d'administration** ou **bureau**. Ces cercles sont emboîtés — un membre du
bureau siège aussi au CA, l'inverse n'est pas vrai — et la hiérarchie tient
dans `src/lib/instances.js`, pas dans la base.

Un événement porte symétriquement une **audience** : tous les membres, le CA,
ou le bureau. Un événement réservé à une instance n'est pas seulement étiqueté,
il **disparaît** du calendrier, des listes, de la fiche et du formulaire
d'édition des membres qui n'y siègent pas. Deux exceptions : un événement
publié sur le site public reste visible de tous, et l'administrateur technique
voit tout, pour pouvoir dépanner n'importe quelle fiche.

Le formulaire ne propose à son auteur que les audiences qu'il pourra lui-même
relire : on ne peut pas créer un événement aussitôt invisible pour soi.

Chaque événement peut aussi désigner une **équipe de leaders** — les membres
qui en portent l'organisation — et prendre la catégorie « date importante »,
réservée aux échéances à noter : ni horaire, ni lieu, juste une date.

### Sécurité

- Mots de passe hachés en PBKDF2-SHA256 avec sel aléatoire ; jamais stockés en clair.
- Sessions opaques : le cookie ne contient qu'un jeton aléatoire, son empreinte SHA-256
  sert de clé en base. Cookie `HttpOnly`, `SameSite=Lax`, et `Secure` dès que la requête passe par Cloudflare.
- Double protection CSRF : contrôle de l'en-tête `Origin` sur tous les POST, plus un jeton
  par session sur les formulaires authentifiés.
- Limitation des tentatives : blocage au-delà de 8 échecs par IP ou par e-mail sur 15 minutes.
- Jetons d'activation et de réinitialisation à usage unique, expirant respectivement en
  7 jours et 2 heures.
- Un changement de mot de passe ou une suspension ferme toutes les sessions du compte.
- Échappement systématique de toute valeur injectée dans le HTML.
- `Content-Security-Policy` par nonce, `Strict-Transport-Security`,
  `X-Frame-Options` et `Permissions-Policy` sur chaque réponse.

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
- Les articles de démonstration du jeu de test (`db/seed.sql`) sont fictifs : ils ne
  servent qu'au développement local et ne partent jamais en production.
- `src/routes/public.js` — **mentions légales** : nom du directeur de la publication.
- Le lien du widget HelloAsso pointe sur la campagne « adhesion-2026-2027 » : il devra être
  mis à jour à chaque nouvelle année scolaire.
