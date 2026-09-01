// Flux d'abonnement : calendrier iCalendar (RFC 5545) et actualites RSS 2.0.

import { esc, parseDate } from './util.js';

// --- iCalendar -------------------------------------------------------

/**
 * Definition du fuseau, pour que les heures restent justes au changement
 * d'heure. Sans elle, un client distant afficherait un decalage l'ete.
 */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Echappe une valeur texte selon la RFC 5545. */
function echapIcs(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Plie les lignes a 75 octets, comme l'exige la norme. Le decoupage se fait
 * sur les octets et non les caracteres : couper un caractere accentue en deux
 * produirait un fichier illisible.
 */
function plier(ligne) {
  const octets = new TextEncoder().encode(ligne);
  if (octets.length <= 75) return ligne;

  const morceaux = [];
  let debut = 0;
  let limite = 75;
  while (debut < octets.length) {
    let fin = Math.min(debut + limite, octets.length);
    // Ne pas couper au milieu d'une sequence UTF-8.
    while (fin > debut && fin < octets.length && (octets[fin] & 0xc0) === 0x80) fin--;
    morceaux.push(new TextDecoder().decode(octets.slice(debut, fin)));
    debut = fin;
    limite = 74;   // les lignes suivantes commencent par une espace
  }
  return morceaux.join('\r\n ');
}

function horodatageUtc(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** 'AAAA-MM-JJ' + 'HH:MM' -> '20261212T100000' */
function dateIcs(jour, heure) {
  const j = String(jour).replace(/-/g, '');
  if (!heure) return j;
  return `${j}T${String(heure).replace(':', '')}00`;
}

/** Le lendemain, au format date : DTEND d'un evenement en journee entiere est exclusif. */
function lendemain(jour) {
  const d = parseDate(jour);
  d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function vevent(ev, siteUrl) {
  const lignes = [
    'BEGIN:VEVENT',
    `UID:${ev.id}@apps-saussan`,
    `DTSTAMP:${horodatageUtc(new Date(ev.updated_at || ev.created_at))}`,
  ];

  if (ev.all_day) {
    lignes.push(`DTSTART;VALUE=DATE:${dateIcs(ev.start_date)}`);
    lignes.push(`DTEND;VALUE=DATE:${lendemain(ev.end_date)}`);
  } else {
    lignes.push(`DTSTART;TZID=Europe/Paris:${dateIcs(ev.start_date, ev.start_time || '09:00')}`);
    lignes.push(`DTEND;TZID=Europe/Paris:${dateIcs(ev.end_date, ev.end_time || ev.start_time || '10:00')}`);
  }

  lignes.push(`SUMMARY:${echapIcs(ev.title)}`);
  if (ev.description) lignes.push(`DESCRIPTION:${echapIcs(ev.description)}`);
  if (ev.location) lignes.push(`LOCATION:${echapIcs(ev.location)}`);
  lignes.push(`URL:${siteUrl}/evenements`);
  lignes.push('END:VEVENT');
  return lignes;
}

/** Construit le fichier .ics pour une liste d'evenements. */
export function calendrierIcs(evenements, { siteUrl, nom }) {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APPS Saussan//Calendrier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapIcs(nom)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    ...VTIMEZONE,
    ...evenements.flatMap((ev) => vevent(ev, siteUrl)),
    'END:VCALENDAR',
  ];
  return lignes.map(plier).join('\r\n') + '\r\n';
}

export function reponseIcs(contenu, nomFichier) {
  return new Response(contenu, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `inline; filename="${nomFichier}"`,
      // Les agendas rechargent l'abonnement regulierement : une heure suffit.
      'cache-control': 'public, max-age=3600',
    },
  });
}

// --- RSS -------------------------------------------------------------

/** Date au format RFC 822, seul accepte par les lecteurs RSS. */
function dateRss(iso) {
  return new Date(iso).toUTCString();
}

export function fluxRss(articles, { siteUrl, titre, description }) {
  const items = articles.map((a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${siteUrl}/actualites/${esc(a.slug)}</link>
      <guid isPermaLink="true">${siteUrl}/actualites/${esc(a.slug)}</guid>
      <pubDate>${dateRss(a.published_at || a.created_at)}</pubDate>
      ${a.chapo ? `<description>${esc(a.chapo)}</description>` : ''}
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(titre)}</title>
    <link>${siteUrl}/actualites</link>
    <description>${esc(description)}</description>
    <language>fr</language>
    <atom:link href="${siteUrl}/actualites.rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export function reponseRss(contenu) {
  return new Response(contenu, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=1800',
    },
  });
}
