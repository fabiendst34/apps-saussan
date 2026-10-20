# Spécification — APPS Saussan

Site de l'**APPS**, Association des Parents des Pitchouns Saussannais (parents d'élèves de Saussan, Hérault) : site public, espace membres avec calendrier partagé et administration auditée.

- **En ligne** : https://apps-saussan.fr (`www` redirigé vers l'apex par le Worker), indexable depuis le 09/09/2026.
- **Hébergement** : Worker `apps-saussan` + D1 sur le compte perso de Fabien ; `workers_dev` gardé ouvert le temps de la bascule.
- **Dépôt** : `fabiendst34/apps-saussan`.

## Objectifs

1. Informer les familles : actualités, événements, rôle de l'association.
2. Permettre l'adhésion en ligne (HelloAsso).
3. Donner au bureau et au comité un outil commun : calendrier de l'année et rédaction d'articles.
4. Tracer chaque action des membres (responsabilité associative).

## Publics

- Familles de Saussan (public).
- Membres du bureau et du comité d'administration (espace membres).
- Administrateur (gestion des comptes et audit).

## Partie publique

- Accueil avec section « À la une ».
- Actualités, l'association, événements, adhésion (widget **HelloAsso** en iframe), contact, mentions légales, confidentialité.
- Flux d'abonnement :
  - `/calendrier.ics` : tous les événements publics, fuseau `Europe/Paris` embarqué ; les événements internes n'y figurent jamais.
  - `/evenements/<id>.ics` : un événement (« Ajouter à mon agenda »).
  - `/actualites.rss` : les trente derniers articles.
- Mesure d'audience soumise au consentement (`public/consentement.js`).

## Espace membres

- Connexion e-mail et mot de passe ; **pas d'inscription libre**.
- Calendrier de l'année : création, modification, suppression d'événements, avec instances et responsables (migration 002), catégories colorées.
- Rédaction d'articles « À la une » avec image mise en avant.
- Chaque action est inscrite au journal d'audit.
- Guide de prise en main PDF pour le bureau et le comité (`docs/Guide-membres-APPS.pdf`, généré par `docs/guide-membres.py`).

## Administration (rôle `admin`)

- Création et gestion des comptes, envoi des e-mails d'activation (lien valable 7 jours, usage unique).
- Journal d'audit complet avec filtres et export CSV.
- Messages reçus par le formulaire de contact.

## Architecture technique

- Worker Cloudflare, rendu HTML côté serveur, **aucune dépendance applicative** (seul `wrangler` en outil de développement), JavaScript minimal côté client.
- D1 `apps-saussan` : schéma, migrations, seed de démonstration, import des dates du CA du 08/09/2026.
- E-mails via **Mailjet** depuis `no-reply@apps-saussan.fr` ; sans clés, le contenu (lien d'activation compris) est écrit dans la console de `wrangler dev`.
- **Mots de passe** : PBKDF2-SHA256, 50 000 itérations (calé sur la limite de 10 ms de CPU du plan gratuit) ; passer à 210 000 sur le plan payant, sans invalider les empreintes existantes.
- **Images des articles** stockées en base (table `medias`) faute de R2 : redimensionnées à 1600 px et recompressées dans le navigateur, refus au-delà de 1,2 Mo. Seul `src/lib/medias.js` est à réécrire pour passer à R2. Piège : D1 renvoie les BLOB en tableau de nombres, à convertir en `Uint8Array`.
- **En-têtes de sécurité** : CSP avec nonce de script régénéré à chaque réponse, `font-src 'self'` (polices servies par le Worker, aucun appel à Google Fonts), seul HelloAsso autorisé en `frame-src`.
- Purge automatique des sessions et jetons expirés ; script de sauvegarde `scripts/sauvegarde.mjs`.

## Commandes

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:init
npm run db:seed
npm run dev
node scripts/premier-admin.mjs vous@exemple.fr Prénom Nom   # amorçage du premier compte
npm run deploy
```

## Hors périmètre

Paiement des adhésions (HelloAsso), inscriptions libres, application mobile.
