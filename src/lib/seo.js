// Referencement : plan du site, donnees structurees, adresses canoniques.
//
// Le site est petit et son nom de marque, « APPS Saussan », est ce que les
// parents taperont dans Google. L'enjeu n'est donc pas la course aux
// mots-cles mais l'evidence : que le moteur trouve toutes les pages, sache
// laquelle fait autorite, et comprenne de quelle association il s'agit.

import { esc } from './util.js';

/** Adresse absolue d'un chemin interne. */
export function urlAbsolue(env, chemin) {
  const base = String(env.SITE_URL || 'https://apps-saussan.fr').replace(/\/+$/, '');
  return `${base}${chemin.startsWith('/') ? chemin : `/${chemin}`}`;
}

/** Pages fixes du site public, avec leur importance relative. */
const PAGES = [
  { chemin: '/', priorite: '1.0', frequence: 'weekly' },
  { chemin: '/association', priorite: '0.8', frequence: 'monthly' },
  { chemin: '/actualites', priorite: '0.8', frequence: 'weekly' },
  { chemin: '/evenements', priorite: '0.9', frequence: 'weekly' },
  { chemin: '/adherer', priorite: '0.9', frequence: 'monthly' },
  { chemin: '/contact', priorite: '0.6', frequence: 'yearly' },
  { chemin: '/mentions-legales', priorite: '0.2', frequence: 'yearly' },
  { chemin: '/confidentialite', priorite: '0.2', frequence: 'yearly' },
];

/**
 * Plan du site : pages fixes plus chaque article publie.
 * Les evenements n'ont pas d'adresse propre cote public — ils sont des
 * ancres de /evenements — et n'y figurent donc pas.
 */
export async function sitemapXml(env) {
  const { results } = await env.DB.prepare(
    `SELECT slug, published_at, updated_at FROM articles
      WHERE status = 'publie' AND deleted_at IS NULL
      ORDER BY published_at DESC LIMIT 500`
  ).all();

  const entree = ({ chemin, priorite, frequence, date }) => `  <url>
    <loc>${esc(urlAbsolue(env, chemin))}</loc>${date ? `
    <lastmod>${esc(String(date).slice(0, 10))}</lastmod>` : ''}
    <changefreq>${frequence}</changefreq>
    <priority>${priorite}</priority>
  </url>`;

  const recent = (results || [])[0]?.updated_at;
  const lignes = [
    ...PAGES.map((p) => entree(p.chemin === '/actualites' ? { ...p, date: recent } : p)),
    ...(results || []).map((a) => entree({
      chemin: `/actualites/${a.slug}`,
      priorite: '0.7',
      frequence: 'monthly',
      date: a.updated_at || a.published_at,
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lignes.join('\n')}
</urlset>
`;
}

export async function reponseSitemap(env) {
  return new Response(await sitemapXml(env), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}

/**
 * Donnees structurees de l'association, posees sur l'accueil.
 * C'est ce qui permet a un moteur de relier la requete « apps saussan » a
 * une association de parents d'eleves precise, situee a Saussan.
 */
export function jsonLdAssociation(env) {
  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: 'APPS — Association des Parents des Pitchouns Saussannais',
    alternateName: ['APPS Saussan', 'Association des Parents des Pitchouns Saussannais'],
    url: urlAbsolue(env, '/'),
    logo: urlAbsolue(env, '/logo-apps.svg'),
    email: env.CONTACT_EMAIL || 'apps.saussan@gmail.com',
    description: "Association de parents d'élèves des écoles maternelle et élémentaire de Saussan (Hérault). "
      + 'Elle organise des événements et finance les projets des classes.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Saussan',
      postalCode: '34570',
      addressRegion: 'Hérault',
      addressCountry: 'FR',
    },
    areaServed: { '@type': 'Place', name: 'Saussan (34570)' },
    memberOf: { '@type': 'EducationalOrganization', name: 'Écoles publiques de Saussan' },
  };
  // Le JSON est serialise puis neutralise : une chaine contenant « </script> »
  // fermerait la balise au milieu des donnees.
  const brut = JSON.stringify(donnees).replace(/</g, '\u003c');
  return `<script type="application/ld+json">${brut}</script>`;
}
