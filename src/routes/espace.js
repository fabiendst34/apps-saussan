// Espace membres : calendrier partage, gestion des evenements, compte personnel.
import {
  esc, richText, html, redirect, uuid, nowIso, field,
  parseDate, toDateKey, todayKey, jourParis, formatDateShort, formatDateTime,
  formatRange, fullName, MOIS_NOMS, JOURS_COURTS, JOURS_LONGS,
} from '../lib/util.js';
import { page, messagesFlash, bandeau } from '../lib/layout.js';
import { icone, ICONE_CATEGORIE } from '../lib/icones.js';
import { logAudit, diff, ACTION_LABELS, actionTone, FIELD_LABELS } from '../lib/audit.js';
import { hashPassword, verifyPassword, passwordProblem, destroyUserSessions, checkCsrf } from '../lib/auth.js';
import { CATEGORIES, categorieLabel, carteEvenement } from './public.js';
import {
  AUDIENCES, INSTANCES, ROLES, STATUTS, audienceLabel, audiencesVisibles,
  badgeAudience, filtreAudience, peutVoirEvenement,
} from '../lib/instances.js';

const CHAMPS_AUDITES = ['title', 'description', 'location', 'category', 'audience',
  'start_date', 'start_time', 'end_date', 'end_time', 'all_day', 'is_public', 'leaders'];

// ---------------------------------------------------------------------
//  Equipe de leaders
// ---------------------------------------------------------------------

/** Comptes proposables comme leaders : tous sauf les comptes suspendus. */
async function membresSelectionnables(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, first_name, last_name, email, instance FROM users
      WHERE status <> 'suspendu' ORDER BY last_name, first_name, email`
  ).all();
  return results || [];
}

/** Equipe d'un evenement, fiches completes et triees. */
async function equipeDe(env, eventId) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.first_name, u.last_name, u.email
       FROM event_leaders l JOIN users u ON u.id = l.user_id
      WHERE l.event_id = ? ORDER BY u.last_name, u.first_name, u.email`
  ).bind(eventId).all();
  return results || [];
}

/** Liste de noms lisible, telle qu'elle sera figee dans le journal d'audit. */
function libelleEquipe(membres) {
  return membres.map((m) => fullName(m) || m.email).join(', ');
}

/**
 * Remplace l'equipe d'un evenement et renvoie son libelle.
 * Les identifiants recus du formulaire sont recroises avec la liste des
 * comptes selectionnables : un id forge n'entre jamais en base.
 */
async function enregistrerEquipe(env, eventId, ids, membres) {
  const retenus = membres.filter((m) => ids.includes(m.id));
  const ops = [env.DB.prepare('DELETE FROM event_leaders WHERE event_id = ?').bind(eventId)];
  for (const m of retenus) {
    ops.push(env.DB.prepare('INSERT INTO event_leaders (event_id, user_id) VALUES (?, ?)').bind(eventId, m.id));
  }
  await env.DB.batch(ops);
  return libelleEquipe(retenus);
}

/** Champ cache portant le jeton anti-CSRF de la session. */
export function csrfInput(session) {
  return `<input type="hidden" name="csrf" value="${esc(session.csrf)}">`;
}

// =====================================================================
//  Calendrier
// =====================================================================

/** Construit la grille du mois demande (semaines du lundi au dimanche). */
function grilleMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7;       // 0 = lundi
  const debut = new Date(annee, mois, 1 - decalage);
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cases = Math.ceil((decalage + nbJours) / 7) * 7;
  return Array.from({ length: cases }, (_, i) => new Date(annee, mois, 1 - decalage + i))
    .map((d) => ({ date: d, cle: toDateKey(d), horsMois: d.getMonth() !== mois }));
}

/** Repartit les evenements par jour, en couvrant les evenements sur plusieurs jours. */
function indexerParJour(evenements) {
  const index = new Map();
  for (const ev of evenements) {
    let cur = parseDate(ev.start_date);
    const fin = parseDate(ev.end_date);
    let garde = 0;
    while (cur <= fin && garde++ < 400) {
      const cle = toDateKey(cur);
      if (!index.has(cle)) index.set(cle, []);
      index.get(cle).push(ev);
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  }
  for (const liste of index.values()) {
    liste.sort((a, b) => (a.all_day ? 0 : 1) - (b.all_day ? 0 : 1) || String(a.start_time || '').localeCompare(String(b.start_time || '')));
  }
  return index;
}

export async function calendrier(env, url, user, session) {
  const param = url.searchParams.get('m') || '';
  const m = /^\d{4}-\d{2}$/.test(param) ? param : todayKey().slice(0, 7);
  const [annee, moisNum] = m.split('-').map(Number);
  const mois = moisNum - 1;

  const cases = grilleMois(annee, mois);
  const debut = cases[0].cle;
  const fin = cases[cases.length - 1].cle;

  // Un evenement reserve au bureau ne doit pas seulement etre etiquete : il
  // disparait du calendrier des membres qui n'y siegent pas.
  const filtre = filtreAudience(user);
  const { results } = await env.DB.prepare(
    `SELECT * FROM events
      WHERE deleted_at IS NULL AND end_date >= ? AND start_date <= ?
        ${filtre.sql ? `AND ${filtre.sql}` : ''}
      ORDER BY start_date, all_day DESC, start_time`
  ).bind(debut, fin, ...filtre.params).all();
  const parJour = indexerParJour(results || []);

  const precedent = new Date(annee, mois - 1, 1);
  const suivant = new Date(annee, mois + 1, 1);
  const lienMois = (d) => `/espace?m=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const aujourdhui = todayKey();

  const puce = (ev) => {
    const heure = ev.all_day ? '' : `${esc(String(ev.start_time || '').slice(0, 5))} `;
    const verrou = ev.is_public ? '' : icone('cadenas', { taille: 11 });
    const pour = ev.audience && ev.audience !== 'tous' ? ` — ${audienceLabel(ev.audience)}` : '';
    return `<a class="cal-puce cat-${esc(ev.category)}${ev.is_public ? '' : ' cal-puce--prive'}"
      href="/espace/evenements/${esc(ev.id)}" title="${esc(ev.title + pour)}">${verrou}<span>${heure}${esc(ev.title)}</span></a>`;
  };

  // Un vrai tableau : les lecteurs d'ecran annoncent alors le jour de la
  // semaine avec chaque case, ce qu'une grille de div ne permet pas.
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));

  const grille = `<table class="cal-grille">
    <caption class="sr-only">Calendrier de ${MOIS_NOMS[mois]} ${annee}</caption>
    <thead><tr>${JOURS_COURTS.map((j, i) =>
      `<th scope="col" class="cal-jour-nom"><abbr title="${esc(JOURS_LONGS[i])}">${j}</abbr></th>`).join('')}</tr></thead>
    <tbody>${semaines.map((semaine) => `<tr>${semaine.map((c) => {
      const evs = parJour.get(c.cle) || [];
      const visibles = evs.slice(0, 3);
      const reste = evs.length - visibles.length;
      const jour = c.date.getDay();
      const classes = ['cal-case'];
      if (c.horsMois) classes.push('cal-case--hors');
      else if (jour === 0 || jour === 6) classes.push('cal-case--weekend');
      if (c.cle === aujourdhui) classes.push('cal-case--aujourdhui');
      return `<td class="${classes.join(' ')}"${c.cle === aujourdhui ? ' aria-current="date"' : ''}>
        <span class="cal-numero">${c.date.getDate()}</span>
        ${visibles.map(puce).join('')}
        ${reste > 0 ? `<span class="cal-plus">+${reste} autre${reste > 1 ? 's' : ''}</span>` : ''}
      </td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table>`;

  // Sur mobile, la grille cede la place a une liste chronologique du mois.
  const duMois = (results || []).filter((e) => e.start_date.slice(0, 7) === m || e.end_date.slice(0, 7) === m);
  const listeMobile = `<div class="cal-liste-mobile">${
    duMois.length
      ? `<div class="pile">${duMois.map((e) => carteEvenement(e, `/espace/evenements/${e.id}`)).join('')}</div>`
      : `<div class="vide">${icone('calendrier', { taille: 34, classe: 'vide__icone' })}<h3>Aucun événement ce mois-ci</h3></div>`
  }</div>`;

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--large">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Calendrier de l'association</h1><p>Toutes les dates de l'année, publiques et internes.</p></div>
    <a class="btn btn--principal" href="/espace/evenements/nouveau">${icone('plus', { taille: 18 })}Nouvel événement</a>
  </div>

  <div class="cal-entete">
    <div class="cal-nav">
      <a href="${lienMois(precedent)}" aria-label="Mois précédent">${icone('fleche_gauche', { taille: 20 })}</a>
      <a href="${lienMois(suivant)}" aria-label="Mois suivant">${icone('fleche_droite', { taille: 20 })}</a>
    </div>
    <span class="cal-mois">${MOIS_NOMS[mois]} ${annee}</span>
    <a class="btn btn--fantome btn--petit" href="/espace">Aujourd'hui</a>
    <span class="pousse petit muet">
      ${Object.entries(CATEGORIES).map(([k, v]) =>
        `<span class="etiquette etiquette-cat cat-${k}" style="margin-left:.25rem">${esc(v)}</span>`).join('')}
    </span>
  </div>

  ${grille}
  ${listeMobile}

  <p class="legende-cal">${icone('cadenas', { taille: 15 })}<span>Les événements marqués d'un cadenas ne sont visibles que dans cet espace. Les autres apparaissent aussi sur le site public.</span></p>
</div></section>`;

  return html(page({ titre: 'Calendrier', contenu, user, chemin: '/espace', env, variante: 'espace' }));
}

// =====================================================================
//  Liste des evenements
// =====================================================================

export async function listeEvenements(env, url, user) {
  const filtre = url.searchParams.get('f') || 'avenir';
  const today = todayKey();

  let where = 'deleted_at IS NULL AND end_date >= ?';
  let ordre = 'start_date ASC, start_time ASC';
  let params = [today];
  if (filtre === 'passes') { where = 'deleted_at IS NULL AND end_date < ?'; ordre = 'start_date DESC'; }
  if (filtre === 'supprimes') { where = 'deleted_at IS NOT NULL'; ordre = 'deleted_at DESC'; params = []; }

  const portee = filtreAudience(user);
  if (portee.sql) { where += ` AND ${portee.sql}`; params = params.concat(portee.params); }

  const sql = `SELECT e.*, c.first_name AS c_prenom, c.last_name AS c_nom, c.email AS c_email
                 FROM events e LEFT JOIN users c ON c.id = e.created_by
                WHERE ${where} ORDER BY ${ordre} LIMIT 300`;
  const { results } = await (params.length
    ? env.DB.prepare(sql).bind(...params).all()
    : env.DB.prepare(sql).all());

  // Une seule requete pour toutes les equipes : la table de liaison reste
  // minuscule, la parcourir entierement coute moins qu'une requete par ligne.
  const equipes = new Map();
  if (results && results.length) {
    const { results: liens } = await env.DB.prepare(
      `SELECT l.event_id, u.first_name, u.last_name, u.email
         FROM event_leaders l JOIN users u ON u.id = l.user_id
        ORDER BY u.last_name, u.first_name, u.email`
    ).all();
    for (const l of liens || []) {
      if (!equipes.has(l.event_id)) equipes.set(l.event_id, []);
      equipes.get(l.event_id).push(fullName(l) || l.email);
    }
  }

  const onglet = (cle, label) =>
    `<a class="btn btn--petit ${filtre === cle ? 'btn--principal' : 'btn--fantome'}" href="/espace/evenements?f=${cle}">${label}</a>`;

  const lignes = (results || []).map((e) => `
    <tr>
      <td>
        <a href="/espace/evenements/${esc(e.id)}" style="font-weight:800;color:var(--noir);text-decoration:none">${esc(e.title)}</a>
        ${e.deleted_at ? '<span class="etiquette etiquette--rouge" style="margin-left:.4rem">Supprimé</span>' : ''}
        ${e.location ? `<div class="petit muet ligne-ico">${icone('lieu', { taille: 14 })}${esc(e.location)}</div>` : ''}
        ${equipes.has(e.id) ? `<div class="petit muet ligne-ico">${icone('personnes', { taille: 14 })}${esc(equipes.get(e.id).join(', '))}</div>` : ''}
      </td>
      <td class="serre">${esc(formatDateShort(e.start_date))}${e.all_day ? '' : `<div class="petit muet">${esc(String(e.start_time || '').slice(0, 5))}</div>`}</td>
      <td class="serre"><span class="etiquette etiquette-cat cat-${esc(e.category)}">${esc(categorieLabel(e.category))}</span></td>
      <td class="serre">${e.is_public
        ? '<span class="etiquette etiquette--vert">Public</span>'
        : '<span class="etiquette etiquette--gris">Interne</span>'}
        ${badgeAudience(e.audience)}</td>
      <td class="serre petit muet">${esc(e.c_prenom ? `${e.c_prenom} ${e.c_nom}`.trim() : (e.c_email || 'compte supprimé'))}</td>
      <td class="serre">
        <div class="actions-ligne">
          <a class="btn btn--petit btn--fantome" href="/espace/evenements/${esc(e.id)}">Voir</a>
          ${e.deleted_at ? '' : `<a class="btn btn--petit btn--fantome" href="/espace/evenements/${esc(e.id)}/modifier">Modifier</a>`}
        </div>
      </td>
    </tr>`).join('');

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--large">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Événements</h1><p>${(results || []).length} événement${(results || []).length > 1 ? 's' : ''} affiché${(results || []).length > 1 ? 's' : ''}.</p></div>
    <a class="btn btn--principal" href="/espace/evenements/nouveau">${icone('plus', { taille: 18 })}Nouvel événement</a>
  </div>
  <div class="rang" style="margin-bottom:1.25rem">
    ${onglet('avenir', 'À venir')}${onglet('passes', 'Passés')}${onglet('supprimes', 'Corbeille')}
  </div>
  ${lignes ? `<div class="tableau-enveloppe"><table>
      <thead><tr><th>Événement</th><th>Date</th><th>Catégorie</th><th>Visibilité</th><th>Créé par</th><th></th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`
    : `<div class="vide">${icone('calendrier', { taille: 34, classe: 'vide__icone' })}<h3>Aucun événement</h3>
       <p>${filtre === 'supprimes' ? 'La corbeille est vide.' : 'Commencez par en créer un.'}</p></div>`}
</div></section>`;

  return html(page({ titre: 'Événements', contenu, user, chemin: '/espace/evenements', env, variante: 'espace' }));
}

// =====================================================================
//  Detail d'un evenement
// =====================================================================

export async function detailEvenement(env, url, user, session, id) {
  const ev = await env.DB.prepare(
    `SELECT e.*,
            c.first_name AS c_prenom, c.last_name AS c_nom, c.email AS c_email,
            m.first_name AS m_prenom, m.last_name AS m_nom, m.email AS m_email
       FROM events e
       LEFT JOIN users c ON c.id = e.created_by
       LEFT JOIN users m ON m.id = e.updated_by
      WHERE e.id = ?`
  ).bind(id).first();

  // Meme regle qu'au calendrier : l'URL directe ne contourne pas l'audience.
  if (!ev || !peutVoirEvenement(user, ev)) return null;

  const equipe = await equipeDe(env, id);

  const { results: journal } = await env.DB.prepare(
    `SELECT * FROM audit_log WHERE entity_type = 'event' AND entity_id = ? ORDER BY created_at DESC LIMIT 30`
  ).bind(id).all();

  const auteur = (p, n, e) => (p || n) ? `${p || ''} ${n || ''}`.trim() : (e || 'compte supprimé');

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  ${messagesFlash(url)}
  <p class="fil"><a href="/espace">Calendrier</a> › <a href="/espace/evenements">Événements</a> › ${esc(ev.title)}</p>

  ${ev.deleted_at ? bandeau('erreur', `Cet événement a été supprimé le ${formatDateTime(ev.deleted_at)}. Il n'apparaît plus dans le calendrier.`) : ''}

  <div class="detail-bandeau cat-${esc(ev.category)}">
    <span class="etiquette etiquette-cat">${esc(categorieLabel(ev.category))}</span>
    <h1 style="margin:.5rem 0 .35rem">${esc(ev.title)}</h1>
    <p class="detail-quand">${icone('horloge', { taille: 18 })}${esc(formatRange(ev))}</p>
    ${ev.location ? `<p class="detail-ou">${icone('lieu', { taille: 18 })}${esc(ev.location)}</p>` : ''}
  </div>

  <div class="rang" style="margin-bottom:1.5rem">
    ${ev.deleted_at ? `
      <form method="post" action="/espace/evenements/${esc(ev.id)}/restaurer" class="forme-inline">
        ${csrfInput(session)}
        <button class="btn btn--jaune" type="submit">Restaurer l'événement</button>
      </form>`
    : `
      <a class="btn btn--principal" href="/espace/evenements/${esc(ev.id)}/modifier">Modifier</a>
      <form method="post" action="/espace/evenements/${esc(ev.id)}/supprimer" class="forme-inline"
            data-confirmer="Supprimer définitivement cet événement du calendrier ?">
        ${csrfInput(session)}
        <button class="btn btn--danger" type="submit">Supprimer</button>
      </form>`}
    <a class="btn btn--fantome pousse" href="/espace">${icone('fleche_gauche', { taille: 16 })}Retour au calendrier</a>
  </div>

  ${ev.description ? `<div class="carte" style="margin-bottom:1.5rem"><h2 style="font-size:1.15rem">Description</h2>${richText(ev.description)}</div>` : ''}

  <div class="carte" style="margin-bottom:1.5rem">
    <h2 style="font-size:1.15rem">Informations</h2>
    <ul class="detail-liste">
      <li><span class="cle">Visibilité</span><span>${ev.is_public
        ? '<span class="etiquette etiquette--vert">Public</span> — affiché sur le site'
        : '<span class="etiquette etiquette--gris">Interne</span> — visible uniquement ici'}</span></li>
      <li><span class="cle">Destinataires</span><span>${esc(audienceLabel(ev.audience))}${ev.audience && ev.audience !== 'tous'
        ? ' <span class="petit muet">— les autres membres ne le voient pas dans leur calendrier</span>' : ''}</span></li>
      <li><span class="cle">Équipe de leaders</span><span>${equipe.length
        ? `<ul class="equipe">${equipe.map((m) => `<li><span class="jeton" aria-hidden="true">${
            esc(((m.first_name?.[0] || m.email[0]) + (m.last_name?.[0] || '')).toUpperCase())
          }</span>${esc(fullName(m) || m.email)}</li>`).join('')}</ul>`
        : '<span class="muet">personne pour l’instant</span>'}</span></li>
      <li><span class="cle">Créé par</span><span>${esc(auteur(ev.c_prenom, ev.c_nom, ev.c_email))} · ${esc(formatDateTime(ev.created_at))}</span></li>
      <li><span class="cle">Modifié par</span><span>${ev.updated_at !== ev.created_at
        ? `${esc(auteur(ev.m_prenom, ev.m_nom, ev.m_email))} · ${esc(formatDateTime(ev.updated_at))}`
        : '<span class="muet">jamais modifié</span>'}</span></li>
    </ul>
  </div>

  <div class="carte">
    <h2 style="font-size:1.15rem">Historique</h2>
    <p class="petit muet">Chaque création, modification et suppression est tracée.</p>
    ${journal && journal.length ? `<div style="margin-top:1rem">${journal.map(ligneAudit).join('')}</div>`
      : '<p class="muet">Aucune entrée.</p>'}
  </div>
</div></section>`;

  return html(page({ titre: ev.title, contenu, user, chemin: '/espace/evenements', env, variante: 'espace' }));
}

/**
 * Le journal est lu par des benevoles, pas par des developpeurs : les valeurs
 * stockees en base y sont retraduites en francais courant.
 *
 * Les tables sont construites a l'appel et non une fois pour toutes : espace.js
 * et public.js s'importent mutuellement (via articles.js), et une constante
 * lue au chargement du module tomberait sur un CATEGORIES encore vide.
 */
function libelleValeur(champ, v) {
  const ouiNon = { 0: 'non', 1: 'oui' };
  const tables = {
    category: CATEGORIES,
    audience: AUDIENCES,
    instance: INSTANCES,
    role: ROLES,
    status: { ...STATUTS, brouillon: 'Brouillon', publie: 'Publié' },
    all_day: ouiNon,
    is_public: ouiNon,
    is_featured: ouiNon,
  };
  return tables[champ]?.[v] ?? v;
}

/**
 * Rend le detail des modifications d'une entree d'audit.
 * Partage par la fiche d'un objet et par le journal de l'administration :
 * deux rendus separes finissaient par diverger, et l'un des deux affichait
 * encore « date_cle » la ou l'autre disait « Date importante ».
 * @param {string} changes JSON stocke en base
 * @param {object} [o]
 * @param {number} [o.max] nombre de champs affiches
 * @param {number} [o.taille] longueur maximale d'une valeur
 */
export function blocDifferences(changes, { max = Infinity, taille = 90 } = {}) {
  if (!changes) return '';
  try {
    const entrees = Object.entries(JSON.parse(changes)).slice(0, max);
    return `<div class="diff">${entrees.map(([champ, [avant, apres]]) => {
      const nom = FIELD_LABELS[champ] || champ;
      if (champ === 'password_hash') return `<div><span class="diff__champ">${esc(nom)}</span> : <span class="diff__apres">modifié</span></div>`;
      const fmt = (v) => v === null || v === ''
        ? '<span class="muet">vide</span>'
        : esc(String(libelleValeur(champ, v)).slice(0, taille));
      return `<div><span class="diff__champ">${esc(nom)}</span> :
        <span class="diff__avant">${fmt(avant)}</span><span class="diff__fleche">→</span><span class="diff__apres">${fmt(apres)}</span></div>`;
    }).join('')}</div>`;
  } catch { return ''; }
}

/** Meme contenu en texte brut, pour l'export CSV du journal. */
export function texteDifferences(changes) {
  if (!changes) return '';
  try {
    return Object.entries(JSON.parse(changes)).map(([champ, [avant, apres]]) => {
      const nom = FIELD_LABELS[champ] || champ;
      if (champ === 'password_hash') return `${nom} : modifié`;
      const fmt = (v) => v === null || v === '' ? '(vide)' : String(libelleValeur(champ, v));
      return `${nom} : ${fmt(avant)} → ${fmt(apres)}`;
    }).join(' ; ');
  } catch { return ''; }
}

/** Rend une entree du journal d'audit (reutilise dans l'espace et l'admin). */
export function ligneAudit(e) {
  const changements = blocDifferences(e.changes);
  return `<div class="audit-ligne" style="padding:.7rem 0">
    <div class="rang" style="gap:.4rem">
      <span class="point point--${actionTone(e.action)}"></span>
      <strong>${esc(ACTION_LABELS[e.action] || e.action)}</strong>
      <span class="muet petit">par ${esc(e.actor_name || e.actor_email)}</span>
      <span class="muet petit pousse">${esc(formatDateTime(e.created_at))}</span>
    </div>
    ${e.entity_label ? `<div class="petit muet" style="margin-left:1rem">${esc(e.entity_label)}</div>` : ''}
    ${changements ? `<div style="margin-left:1rem">${changements}</div>` : ''}
  </div>`;
}

// =====================================================================
//  Formulaire de creation / modification
// =====================================================================

export async function formulaireEvenement(env, url, user, session, ev = null, erreur = null) {
  const modification = !!ev?.id;
  const v = (k, def = '') => esc(ev?.[k] ?? def);
  const action = modification ? `/espace/evenements/${ev.id}/modifier` : '/espace/evenements/nouveau';
  const demain = jourParis(1);

  const membres = await membresSelectionnables(env);
  // Apres une erreur de saisie, la selection vient du formulaire renvoye ;
  // sinon elle vient de la base.
  const choisis = new Set(ev?.leaders_ids || (modification ? (await equipeDe(env, ev.id)).map((m) => m.id) : []));

  // On ne propose que les audiences que l'auteur pourra lui-meme relire :
  // creer un evenement aussitot invisible pour son auteur n'a pas de sens.
  const audiencesOffertes = audiencesVisibles(user);

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/espace">Calendrier</a> › <a href="/espace/evenements">Événements</a> › ${modification ? 'Modifier' : 'Nouveau'}</p>
  <h1>${modification ? "Modifier l'événement" : 'Nouvel événement'}</h1>
  <p class="muet">${modification
    ? 'Toute modification est enregistrée dans l’historique avec votre nom.'
    : 'Il apparaîtra immédiatement dans le calendrier de l’espace membres.'}</p>

  <div class="carte" style="margin-top:1.5rem">
    ${erreur ? bandeau('erreur', erreur) : ''}
    <form method="post" action="${action}">
      ${csrfInput(session)}
      <div class="champ">
        <label class="champ__label" for="title">Titre <span class="champ__requis">*</span></label>
        <input type="text" id="title" name="title" required maxlength="120" value="${v('title')}" autofocus
               placeholder="Ex. : Marché de Noël de l'école">
      </div>

      <div class="duo">
        <div class="champ">
          <label class="champ__label" for="category">Catégorie</label>
          <select id="category" aria-describedby="aide-category" name="category">
            ${Object.entries(CATEGORIES).map(([k, label]) =>
              `<option value="${k}"${(ev?.category || 'ecole') === k ? ' selected' : ''}>${esc(label)}</option>`).join('')}
          </select>
          <p class="champ__aide" id="aide-category">«&nbsp;Date importante&nbsp;»&nbsp;: une échéance à noter, sans horaire ni lieu.</p>
        </div>
        <div class="champ" id="bloc-lieu">
          <label class="champ__label" for="location">Lieu</label>
          <input type="text" id="location" name="location" maxlength="150" value="${v('location')}"
                 placeholder="Ex. : Cour de l'école élémentaire">
        </div>
      </div>

      <div class="champ">
        <label class="champ__label" for="audience">Destinataires</label>
        <select id="audience" aria-describedby="aide-audience" name="audience">
          ${audiencesOffertes.map((k) =>
            `<option value="${k}"${(ev?.audience || 'tous') === k ? ' selected' : ''}>${esc(AUDIENCES[k])}</option>`).join('')}
        </select>
        <p class="champ__aide" id="aide-audience">Un événement réservé au bureau ou au comité d'administration n'apparaît que dans le calendrier de ses membres. Un événement publié sur le site reste, lui, visible de tous.</p>
      </div>

      <fieldset>
        <legend>Quand ?</legend>
        <div class="champ" id="bloc-journee">
          <label class="case">
            <input type="checkbox" name="all_day" value="1" id="all_day"${ev?.all_day ? ' checked' : ''}>
            <span>Journée entière (sans horaire précis)</span>
          </label>
        </div>
        <div class="duo">
          <div class="champ">
            <label class="champ__label" for="start_date">Date de début <span class="champ__requis">*</span></label>
            <input type="date" id="start_date" name="start_date" required value="${v('start_date', demain)}">
          </div>
          <div class="champ" data-horaire>
            <label class="champ__label" for="start_time">Heure de début</label>
            <input type="time" id="start_time" name="start_time" value="${v('start_time', '')}">
          </div>
        </div>
        <div class="duo">
          <div class="champ">
            <label class="champ__label" for="end_date">Date de fin</label>
            <input type="date" id="end_date" aria-describedby="aide-end_date" name="end_date" value="${v('end_date')}">
            <p class="champ__aide" id="aide-end_date">À laisser vide si l'événement tient sur une seule journée.</p>
          </div>
          <div class="champ" data-horaire>
            <label class="champ__label" for="end_time">Heure de fin</label>
            <input type="time" id="end_time" name="end_time" value="${v('end_time', '')}">
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Équipe de leaders</legend>
        <p class="champ__aide" style="margin:-.35rem 0 .8rem">Les membres qui portent l'organisation de cet événement. Plusieurs choix possibles.</p>
        ${membres.length ? `<div class="choix-multiple">${membres.map((m) => `
          <label class="case">
            <input type="checkbox" name="leaders" value="${esc(m.id)}"${choisis.has(m.id) ? ' checked' : ''}>
            <span>${esc(fullName(m) || m.email)}</span>
          </label>`).join('')}</div>`
        : '<p class="choix-multiple__vide">Aucun compte membre n’est encore actif.</p>'}
      </fieldset>

      <div class="champ">
        <label class="champ__label" for="description">Description</label>
        <textarea id="description" name="description" maxlength="4000" rows="6"
                  placeholder="Déroulé, matériel à prévoir, personnes à contacter…">${v('description')}</textarea>
      </div>

      <div class="champ">
        <label class="case">
          <input type="checkbox" name="is_public" value="1"${ev?.is_public ? ' checked' : ''}>
          <span><strong>Publier sur le site public</strong><br>
          <span class="petit muet">L'événement sera visible par tous les visiteurs, sur la page Événements et sur l'accueil.</span></span>
        </label>
      </div>

      <div class="rang" style="margin-top:1.5rem">
        <button class="btn btn--principal" type="submit">${modification ? 'Enregistrer les modifications' : 'Créer l’événement'}</button>
        <a class="btn btn--fantome" href="${modification ? `/espace/evenements/${ev.id}` : '/espace'}">Annuler</a>
      </div>
    </form>
  </div>
</div></section>
<script>
(function(){
  var jour=document.getElementById('all_day');
  var cat=document.getElementById('category');
  var lieu=document.getElementById('bloc-lieu');
  var blocJour=document.getElementById('bloc-journee');
  function sync(){
    // Une « date importante » n'a ni horaire ni lieu : les champs
    // correspondants disparaissent, le serveur les ignore de toute facon.
    var dateCle = cat && cat.value === 'date_cle';
    if(dateCle && jour) jour.checked = true;
    if(lieu) lieu.hidden = dateCle;
    if(blocJour) blocJour.hidden = dateCle;
    var sansHeure = dateCle || (jour && jour.checked);
    document.querySelectorAll('[data-horaire]').forEach(function(el){ el.hidden = sansHeure; });
  }
  if(jour) jour.addEventListener('change',sync);
  if(cat) cat.addEventListener('change',sync);
  sync();
})();
</script>`;

  return html(page({
    titre: modification ? 'Modifier un événement' : 'Nouvel événement',
    contenu, user, chemin: '/espace/evenements', env, variante: 'espace',
  }));
}

/**
 * Extrait et valide les champs d'un evenement.
 * @param {FormData} form
 * @param {object} user auteur, pour brider l'audience a ce qu'il peut relire
 */
function lireEvenement(form, user) {
  const brute = field(form, 'category', 20);
  const category = CATEGORIES[brute] ? brute : 'autre';

  // Une date importante n'est pas un rendez-vous : ni horaire, ni lieu.
  const dateCle = category === 'date_cle';
  const allDay = dateCle || form.get('all_day') === '1';

  const start_date = field(form, 'start_date', 10);
  let end_date = field(form, 'end_date', 10) || start_date;
  const start_time = allDay ? null : (field(form, 'start_time', 5) || null);
  const end_time = allDay ? null : (field(form, 'end_time', 5) || null);

  const permises = audiencesVisibles(user);
  const voulue = field(form, 'audience', 10);
  const audience = permises.includes(voulue) ? voulue : 'tous';

  const data = {
    title: field(form, 'title', 120),
    description: field(form, 'description', 4000),
    location: dateCle ? '' : field(form, 'location', 150),
    category,
    audience,
    start_date, start_time, end_date, end_time,
    all_day: allDay ? 1 : 0,
    is_public: form.get('is_public') === '1' ? 1 : 0,
  };
  const leaders = form.getAll('leaders').map(String).slice(0, 50);

  if (!data.title) return { erreur: "Le titre de l'événement est obligatoire." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) return { erreur: 'La date de début est obligatoire.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) return { erreur: 'La date de fin est invalide.' };
  if (end_date < start_date) return { erreur: 'La date de fin ne peut pas précéder la date de début.' };
  if (!allDay && start_time && end_time && start_date === end_date && end_time < start_time) {
    return { erreur: "L'heure de fin ne peut pas précéder l'heure de début." };
  }
  return { data, leaders };
}

/** Reconstruit l'etat saisi pour reafficher le formulaire apres une erreur. */
function saisie(form, base = {}) {
  return { ...base, ...Object.fromEntries(form), leaders_ids: form.getAll('leaders').map(String) };
}

export async function creerEvenementPost(env, request, url, user, session) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/espace/evenements/nouveau?err=csrf');

  const { data, leaders, erreur } = lireEvenement(form, user);
  if (erreur) return formulaireEvenement(env, url, user, session, saisie(form), erreur);

  const id = uuid();
  const maintenant = nowIso();
  await env.DB.prepare(
    `INSERT INTO events (id, title, description, location, category, audience, start_date, start_time,
                         end_date, end_time, all_day, is_public, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.title, data.description, data.location, data.category, data.audience, data.start_date, data.start_time,
    data.end_date, data.end_time, data.all_day, data.is_public, user.id, maintenant, user.id, maintenant).run();

  const equipe = await enregistrerEquipe(env, id, leaders, await membresSelectionnables(env));

  await logAudit(env, request, {
    actor: user, action: 'event.create', entityType: 'event', entityId: id, entityLabel: data.title,
    changes: diff({}, { ...data, leaders: equipe }, CHAMPS_AUDITES),
  });

  return redirect(`/espace/evenements/${id}?ok=event-cree`);
}

export async function modifierEvenementPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/evenements/${id}/modifier?err=csrf`);

  const avant = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!avant || !peutVoirEvenement(user, avant)) return redirect('/espace/evenements?err=introuvable');

  const { data, leaders, erreur } = lireEvenement(form, user);
  if (erreur) return formulaireEvenement(env, url, user, session, saisie(form, avant), erreur);

  await env.DB.prepare(
    `UPDATE events SET title = ?, description = ?, location = ?, category = ?, audience = ?, start_date = ?, start_time = ?,
                       end_date = ?, end_time = ?, all_day = ?, is_public = ?, updated_by = ?, updated_at = ?
      WHERE id = ?`
  ).bind(data.title, data.description, data.location, data.category, data.audience, data.start_date, data.start_time,
    data.end_date, data.end_time, data.all_day, data.is_public, user.id, nowIso(), id).run();

  // L'equipe se compare avant / apres comme n'importe quel autre champ : le
  // journal doit dire qui a ete ajoute ou retire, pas seulement « modifie ».
  const equipeAvant = libelleEquipe(await equipeDe(env, id));
  const equipeApres = await enregistrerEquipe(env, id, leaders, await membresSelectionnables(env));

  const changements = diff({ ...avant, leaders: equipeAvant }, { ...data, leaders: equipeApres }, CHAMPS_AUDITES);
  if (changements) {
    await logAudit(env, request, {
      actor: user, action: 'event.update', entityType: 'event', entityId: id,
      entityLabel: data.title, changes: changements,
    });
  }

  return redirect(`/espace/evenements/${id}?ok=event-modifie`);
}

export async function supprimerEvenementPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/evenements/${id}?err=csrf`);

  const ev = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!ev || !peutVoirEvenement(user, ev)) return redirect('/espace/evenements?err=introuvable');

  await env.DB.prepare('UPDATE events SET deleted_at = ?, deleted_by = ? WHERE id = ?')
    .bind(nowIso(), user.id, id).run();

  await logAudit(env, request, {
    actor: user, action: 'event.delete', entityType: 'event', entityId: id, entityLabel: ev.title,
    changes: { start_date: [ev.start_date, null], title: [ev.title, null] },
  });

  return redirect('/espace/evenements?ok=event-supprime');
}

export async function restaurerEvenementPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/evenements/${id}?err=csrf`);

  const ev = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NOT NULL').bind(id).first();
  if (!ev || !peutVoirEvenement(user, ev)) return redirect('/espace/evenements?err=introuvable');

  await env.DB.prepare('UPDATE events SET deleted_at = NULL, deleted_by = NULL, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind(user.id, nowIso(), id).run();

  await logAudit(env, request, {
    actor: user, action: 'event.restore', entityType: 'event', entityId: id, entityLabel: ev.title,
  });

  return redirect(`/espace/evenements/${id}?ok=event-restaure`);
}

// =====================================================================
//  Mon compte
// =====================================================================

export function monCompte(env, url, user, session, erreur = null) {
  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  ${messagesFlash(url)}
  <div class="rang" style="margin-bottom:1.5rem">
    <span class="jeton jeton--grand">${esc((user.first_name?.[0] || user.email[0]).toUpperCase() + (user.last_name?.[0] || ''))}</span>
    <div><h1 style="margin:0;font-size:1.8rem">${esc(fullName(user))}</h1>
      <p class="muet" style="margin:0">${esc(user.email)} ·
      ${user.role === 'admin' ? '<span class="etiquette etiquette--noir">Administrateur</span>' : '<span class="etiquette">Membre</span>'}</p>
    </div>
  </div>

  ${erreur ? bandeau('erreur', erreur) : ''}

  <div class="carte" style="margin-bottom:1.5rem">
    <h2 style="font-size:1.2rem">Mes informations</h2>
    <form method="post" action="/espace/compte/profil">
      ${csrfInput(session)}
      <div class="duo">
        <div class="champ">
          <label class="champ__label" for="first_name">Prénom</label>
          <input type="text" id="first_name" name="first_name" maxlength="60" value="${esc(user.first_name)}">
        </div>
        <div class="champ">
          <label class="champ__label" for="last_name">Nom</label>
          <input type="text" id="last_name" name="last_name" maxlength="60" value="${esc(user.last_name)}">
        </div>
      </div>
      <div class="champ">
        <label class="champ__label" for="phone">Téléphone <span class="muet petit">(facultatif)</span></label>
        <input type="tel" id="phone" aria-describedby="aide-phone" name="phone" maxlength="25" value="${esc(user.phone)}">
      </div>
      <p class="champ__aide" style="margin-bottom:1rem">Votre adresse e-mail sert d'identifiant&nbsp;: seule l'administration peut la modifier.</p>
      <button class="btn btn--principal" type="submit">Enregistrer</button>
    </form>
  </div>

  <div class="carte">
    <h2 style="font-size:1.2rem">Changer de mot de passe</h2>
    <form method="post" action="/espace/compte/mot-de-passe">
      ${csrfInput(session)}
      <div class="champ">
        <label class="champ__label" for="actuel">Mot de passe actuel</label>
        <input type="password" id="actuel" name="actuel" required autocomplete="current-password">
      </div>
      <div class="duo">
        <div class="champ">
          <label class="champ__label" for="nouveau">Nouveau mot de passe</label>
          <input type="password" id="nouveau" name="nouveau" required autocomplete="new-password" minlength="10">
        </div>
        <div class="champ">
          <label class="champ__label" for="nouveau2">Confirmation</label>
          <input type="password" id="nouveau2" aria-describedby="aide-nouveau2" name="nouveau2" required autocomplete="new-password">
        </div>
      </div>
      <p class="champ__aide" style="margin-bottom:1rem">Au moins 10 caractères, dont une lettre et un chiffre. Vos autres sessions seront fermées.</p>
      <button class="btn btn--principal" type="submit">Modifier le mot de passe</button>
    </form>
  </div>
</div></section>`;

  return html(page({ titre: 'Mon compte', contenu, user, chemin: '/espace/compte', env, variante: 'espace' }));
}

export async function profilPost(env, request, url, user, session) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/espace/compte?err=csrf');

  const data = {
    first_name: field(form, 'first_name', 60),
    last_name: field(form, 'last_name', 60),
    phone: field(form, 'phone', 25),
  };
  await env.DB.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = ? WHERE id = ?')
    .bind(data.first_name, data.last_name, data.phone, nowIso(), user.id).run();

  const changements = diff(user, data, ['first_name', 'last_name', 'phone']);
  if (changements) {
    await logAudit(env, request, {
      actor: user, action: 'compte.profil_modifie', entityType: 'user', entityId: user.id,
      entityLabel: user.email, changes: changements,
    });
  }
  return redirect('/espace/compte?ok=profil-modifie');
}

export async function motDePassePost(env, request, url, user, session) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/espace/compte?err=csrf');

  const actuel = String(form.get('actuel') || '');
  const nouveau = String(form.get('nouveau') || '');
  const nouveau2 = String(form.get('nouveau2') || '');

  if (!(await verifyPassword(actuel, user.password_hash))) {
    return monCompte(env, url, user, session, "Le mot de passe actuel est incorrect.");
  }
  if (nouveau !== nouveau2) return monCompte(env, url, user, session, 'Les deux nouveaux mots de passe ne correspondent pas.');
  const probleme = passwordProblem(nouveau);
  if (probleme) return monCompte(env, url, user, session, probleme);

  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(await hashPassword(nouveau, env), nowIso(), user.id).run();

  await logAudit(env, request, {
    actor: user, action: 'compte.mdp_modifie', entityType: 'user', entityId: user.id, entityLabel: user.email,
  });

  // Les autres sessions sont fermees, celle en cours est recreee.
  await destroyUserSessions(env, user.id);
  const { createSession } = await import('../lib/auth.js');
  const headers = await createSession(env, request, url, user.id);
  return redirect('/espace/compte?ok=mdp-modifie', headers);
}

// =====================================================================
//  Mon activité
// =====================================================================

export async function monJournal(env, url, user) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM audit_log WHERE actor_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  <div class="titre-page">
    <div><h1>Mon activité</h1><p>Les 100 dernières actions enregistrées sous votre compte.</p></div>
  </div>
  <div class="carte">
    ${results && results.length ? results.map(ligneAudit).join('')
      : `<div class="vide">${icone('journal', { taille: 34, classe: 'vide__icone' })}<h3>Aucune activité</h3><p>Vos actions apparaîtront ici.</p></div>`}
  </div>
  <p class="petit muet" style="margin-top:1rem">Ces informations sont conservées 24 mois à des fins de traçabilité. Voir la <a href="/confidentialite">politique de confidentialité</a>.</p>
</div></section>`;

  return html(page({ titre: 'Mon activité', contenu, user, chemin: '/espace/journal', env, variante: 'espace' }));
}
