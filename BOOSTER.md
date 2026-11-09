# Kafé Booster — APPS Saussan

> Fiche lue par la routine Kafé Booster avant chaque proposition (cahier des charges :
> `KafeStudio-dev/seo-saas`, `docs/BOOSTER.md`). Premier jet rédigé par Claude le
> 2026-11-09 à partir du site, de `SPEC.md`, du `README.md` et de `src/routes/public.js` :
> **à relire par Fabien**. En cas de doute, `SPEC.md` fait foi.

## Le site en bref

- **Activité** : l'**APPS**, Association des Parents des Pitchouns Saussannais,
  association loi 1901 de parents d'élèves bénévoles des écoles **maternelle et
  élémentaire de Saussan** (Hérault, 34570). Siège : Centre Socio-culturel, Place de la
  Fontaine.
- **Trois missions**, toujours dans cet ordre : animer la vie de l'école (kermesse,
  carnaval, marché de Noël, fête de fin d'année), financer les projets des classes
  (sorties, spectacles, matériel pédagogique, séjours), porter la voix des parents
  (conseil d'école, mairie).
- **Ce que le site doit provoquer** : adhérer en ligne (`/adherer`, formulaire HelloAsso),
  venir aux événements, donner un coup de main ponctuel, écrire à l'association.
- **Public** : les familles de Saussan. Le site n'a rien à vendre et vise des requêtes
  locales de faible volume : l'enjeu est d'être trouvé sur le nom de l'association et sur
  « parents d'élèves Saussan », pas la course aux mots-clés (voir l'en-tête de
  `src/lib/seo.js`).
- **Le même dépôt porte une application** (espace membres, calendrier interne, rédaction
  d'articles, administration des comptes, journal d'audit). **Seules les pages publiques
  listées plus bas sont dans le périmètre du Booster.**

## Ton et voix

- **Vouvoiement**, ton chaleureux, simple et convivial : on parle à des parents du village,
  pas à des clients.
- « Pitchouns » est le mot de la marque (il est dans le nom) : on le garde, on ne le
  multiplie pas.
- Phrases courtes, concrètes (« Tenir un stand une matinée de kermesse », « Préparer un
  gâteau pour une vente »). Bénévolat présenté comme léger et sans engagement de calendrier.
- À éviter : registre commercial (« offre », « profitez », « ne manquez pas »), superlatifs,
  jargon associatif ou administratif, ton militant ou revendicatif envers l'école ou la
  mairie.

## Recherches visées

Le site reçoit peu d'impressions (118 sur 90 jours au 06/11/2026, d'après Kafé Insights) :
ces requêtes sont des **cibles raisonnées**, pas encore mesurées. À placer naturellement,
jamais en liste ni en répétition.

| Page | Requêtes principales |
|---|---|
| Accueil `/` | APPS Saussan, association parents d'élèves Saussan, parents d'élèves Saussan, école Saussan |
| `/association` | Association des Parents des Pitchouns Saussannais, bureau APPS Saussan, assemblée générale parents d'élèves |
| `/evenements` | kermesse Saussan, marché de Noël Saussan, carnaval école Saussan, agenda école Saussan |
| `/actualites` | actualités école Saussan, APPS Saussan actualités |
| `/adherer` | adhésion APPS Saussan, adhérer association parents d'élèves Saussan |
| `/contact` | contact APPS Saussan |

**« Saussan » reste dans le `<title>` et la meta description de chaque page qui le porte
aujourd'hui**, et le `<title>` de l'accueil garde « APPS Saussan » en tête : c'est la
requête que les parents tapent.

## Ce qu'il ne faut jamais écrire

- **Aucun montant** : ni prix de cotisation, ni sommes récoltées, ni budget. La cotisation
  est fixée sur HelloAsso, pas sur le site.
- **Aucun chiffre** (nombre d'adhérents, de familles, d'élèves, d'événements, de
  bénévoles), **aucun avis ni témoignage** : il n'en existe pas sur le site.
- **Aucun nom de personne** (membres du bureau, enseignants, élus) : le site présente les
  fonctions (présidence, trésorerie, secrétariat), jamais les personnes.
- **Aucune date d'événement, ni lieu, ni horaire** inventés : les événements viennent de la
  base, saisis par les membres. Les seuls événements nommables sont ceux déjà cités
  (kermesse, carnaval, marché de Noël, fête de fin d'année).
- Pas de nom d'école inventé : on écrit « les écoles maternelle et élémentaire de
  Saussan ».
- Ne pas dire que l'association **prélève** ou **reçoit** une commission HelloAsso, ni
  changer quoi que ce soit à l'encart sur la contribution volontaire (page `/adherer`).
- Pas d'adresse, d'e-mail ni de statut différents de ceux déjà affichés (adresse :
  Centre Socio-culturel, Place de la Fontaine, 34570 Saussan ; e-mail : `CONTACT_EMAIL`
  de `wrangler.jsonc`).
- Ne jamais parler de photos d'enfants, ni en promettre.
- Les **textes juridiques** (mentions légales, confidentialité, cookies) ne se réécrivent
  pas.

## Pages à ne jamais toucher

À reporter dans Kafé Insights, champ « Pages à ne jamais toucher » (un chemin exclut
aussi tout ce qui est en dessous) :

```
/espace
/admin
/sante
/medias
/calendrier.ics
/actualites.rss
/sitemap.xml
/mentions-legales
/confidentialite
```

- `/espace` couvre toute l'application des membres : connexion, déconnexion, activation
  de compte, mot de passe oublié et réinitialisation, calendrier interne, événements,
  articles, « Mon activité », compte personnel. Ces pages sont en `noindex` et n'ont rien
  à faire dans Google.
- `/admin` couvre l'administration : tableau de bord, comptes, journal d'audit, messages.
- `/sante` est la sonde technique (JSON), `/medias` sert les images des articles, les
  `.ics`, le RSS et le sitemap sont générés.
- Il n'y a **pas d'inscription libre** sur le site : les comptes sont créés par
  l'administrateur. Le **paiement de l'adhésion** se fait dans le formulaire HelloAsso
  embarqué dans `/adherer` (voir plus bas).

## Où vivent les textes

Le site est un **Worker Cloudflare qui rend les pages côté serveur**, sans générateur ni
build : on modifie directement les fichiers sources ci-dessous, et **seulement eux**.

| Page | Fonction | Fichier |
|---|---|---|
| `/` | `accueil` | `src/routes/public.js` |
| `/association` | `association` | `src/routes/public.js` |
| `/evenements` | `evenements` | `src/routes/public.js` |
| `/adherer` | `adherer` | `src/routes/public.js` |
| `/contact` | `contact` | `src/routes/public.js` |
| `/actualites` | `actualites` | `src/routes/articles.js` |

| Élément | Emplacement |
|---|---|
| `<title>` | champ `titre` de l'appel `page({ … })` à la fin de chaque fonction ; le suffixe ` · APPS Saussan` est ajouté par `src/lib/layout.js`. L'accueil utilise `titreComplet` (titre entier, suffixe compris). Les balises Open Graph reprennent automatiquement titre et description : rien à aligner. |
| Meta description | champ `description` du même appel `page({ … })` |
| H1 | premier `<h1>` de la constante `contenu` de la fonction. Accueil : H1 du bloc `hero`, dont la fin est en `<em>` : garder ce découpage. |
| Chapeau sous le H1 | `<p class="chapo">` (`/association`, `/adherer`), `<p class="hero__chapo">` (accueil), `<p>` à côté du H1 (`/evenements`, `/actualites`), `<p class="muet">` (`/contact`) |
| Textes de section | HTML de la constante `contenu` (missions de l'accueil, « Notre rôle », étapes d'adhésion, « Les bonnes raisons de venir »…) |
| Données structurées (JSON-LD) | `jsonLdAssociation` dans `src/lib/seo.js` : **ne pas modifier** |
| Articles `/actualites/<slug>` | titre, chapô et texte **en base D1**, rédigés par les membres dans l'espace : **hors périmètre**. Si un article mérite un meilleur titre ou chapô, le proposer dans la PR pour qu'un membre le saisisse dans l'espace. |
| Événements (titres, descriptions, dates) | **en base D1** : hors périmètre |
| En-tête, navigation, pied de page, bandeau cookies | `src/lib/layout.js`, `public/consentement.js` : **hors périmètre du Booster** |

Dans ces fichiers, **ne toucher qu'aux chaînes de texte** :
- jamais aux requêtes SQL, aux `${…}` interpolés, aux appels `icone(…)`, `esc(…)`,
  `carteEvenement(…)`, aux attributs `class`, `id`, `href` ni aux balises `<script>` ;
- sur `/adherer` : jamais l'`<iframe>` HelloAsso, son adresse, le lien de secours vers
  HelloAsso, le script de redimensionnement ni l'encart sur la contribution volontaire ;
  seuls le titre, la meta, le H1, le chapeau, les trois étapes et « Les bonnes raisons de
  venir » se retravaillent ;
- sur `/contact` : jamais le formulaire (champs, libellés, piège à robots) ni la fonction
  `contactPost` ;
- les apostrophes des chaînes entre `'…'` doivent rester typographiques (`’`) ou la
  chaîne doit passer entre `"…"` : une apostrophe droite non échappée casse le Worker.

Longueurs : `<title>` **60 caractères au plus** suffixe compris (le suffixe
` · APPS Saussan` en prend 15) ; meta description **140 à 155 caractères**, unique.
Aujourd'hui la plupart des metas font moins de 110 caractères : les allonger est le
premier levier.

## Avant d'ouvrir la pull request

Pas de tests dans le dépôt. Dans PowerShell 5.1 comme dans un shell Linux, une commande
par ligne :

```powershell
npm ci
node --check src/routes/public.js
node --check src/routes/articles.js
npx wrangler deploy --dry-run
```

`node --check` doit ne rien afficher ; `wrangler deploy --dry-run` assemble le Worker
**sans rien publier** et doit finir sur `--dry-run: exiting now.` Vérifier aussi à la
main, pour chaque page modifiée : un seul `<h1>`, le HTML bien fermé, et **aucune
modification hors des deux fichiers listés plus haut**.

## Publication

**Fusionner la PR publie aussitôt** : le workflow `.github/workflows/deploiement.yml`
lance `npm ci` puis `npx wrangler deploy` à chaque push sur `main` (Worker `apps-saussan`,
compte Cloudflare personnel de Fabien), sans aucun test préalable. Le dire en tête de PR.

Le Worker sert à la fois le site public et l'application des membres (connexion,
calendrier, administration, base D1) : une erreur de syntaxe dans `src/routes/public.js`
ou `src/routes/articles.js` met **tout le site hors ligne**, espace membres compris.
D'où la règle : seuls les textes des six pages publiques listées sont dans le périmètre,
et la commande de vérification passe avant toute PR.
