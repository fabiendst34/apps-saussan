// Espace membres : calendrier partage, gestion des evenements, compte personnel.
import {
  esc, richText, html, redirect, uuid, nowIso, field, withQuery,
  parseDate, toDateKey, todayKey, formatDateLong, formatDateShort, formatDateTime,
  formatRange, fullName, MOIS_NOMS, JOURS_COURTS,
} from '../lib/util.js';
import { page, messagesFlash, bandeau } from '../lib/layout.js';
import { icone, ICONE_CATEGORIE } from '../lib/icones.js';
import { logAudit, diff, ACTION_LABELS, actionTone, FIELD_LABELS } from '../lib/audit.js';
import { hashPassword, verifyPassword, passwordProblem, destroyUserSessions, checkCsrf } from '../lib/auth.js';
import { CATEGORIES, categorieLabel, carteEvenement } from './public.js';

const CHAMPS_AUDITES = ['title', 'description', 'location', 'category',
  'start_date', 'start_time', 'end_date', 'end_time', 'all_day', 'is_public'];

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

  const { results } = await env.DB.prepare(
    `SELECT * FROM events
      WHERE deleted_at IS NULL AND end_date >= ? AND start_date <= ?
      ORDER BY start_date, all_day DESC, start_time`
  ).bind(debut, fin).all();
  const parJour = indexerParJour(results || []);

  const precedent = new Date(annee, mois - 1, 1);
  const suivant = new Date(annee, mois + 1, 1);
  const lienMois = (d) => `/espace?m=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const aujourdhui = todayKey();

  const puce = (ev) => {
    const heure = ev.all_day ? '' : `${esc(String(ev.start_time || '').slice(0, 5))} `;
    const verrou = ev.is_public ? '' : icone('cadenas', { taille: 11 });
    return `<a class="cal-puce cat-${esc(ev.category)}${ev.is_public ? '' : ' cal-puce--prive'}"
      href="/espace/evenements/${esc(ev.id)}" title="${esc(ev.title)}">${verrou}<span>${heure}${esc(ev.title)}</span></a>`;
  };

  const grille = `<div class="cal-grille">
    ${JOURS_COURTS.map((j) => `<div class="cal-jour-nom">${j}</div>`).join('')}
    ${cases.map((c) => {
      const evs = parJour.get(c.cle) || [];
      const visibles = evs.slice(0, 3);
      const reste = evs.length - visibles.length;
      const jour = c.date.getDay();
      const classes = ['cal-case'];
      if (c.horsMois) classes.push('cal-case--hors');
      else if (jour === 0 || jour === 6) classes.push('cal-case--weekend');
      if (c.cle === aujourdhui) classes.push('cal-case--aujourdhui');
      return `<div class="${classes.join(' ')}">
        <span class="cal-numero">${c.date.getDate()}</span>
        ${visibles.map(puce).join('')}
        ${reste > 0 ? `<span class="cal-plus">+${reste} autre${reste > 1 ? 's' : ''}</span>` : ''}
      </div>`;
    }).join('')}
  </div>`;

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

  const sql = `SELECT e.*, c.first_name AS c_prenom, c.last_name AS c_nom, c.email AS c_email
                 FROM events e LEFT JOIN users c ON c.id = e.created_by
                WHERE ${where} ORDER BY ${ordre} LIMIT 300`;
  const { results } = await (params.length
    ? env.DB.prepare(sql).bind(...params).all()
    : env.DB.prepare(sql).all());

  const onglet = (cle, label) =>
    `<a class="btn btn--petit ${filtre === cle ? 'btn--principal' : 'btn--fantome'}" href="/espace/evenements?f=${cle}">${label}</a>`;

  const lignes = (results || []).map((e) => `
    <tr>
      <td>
        <a href="/espace/evenements/${esc(e.id)}" style="font-weight:800;color:var(--noir);text-decoration:none">${esc(e.title)}</a>
        ${e.deleted_at ? '<span class="etiquette etiquette--rouge" style="margin-left:.4rem">Supprimé</span>' : ''}
        ${e.location ? `<div class="petit muet ligne-ico">${icone('lieu', { taille: 14 })}${esc(e.location)}</div>` : ''}
      </td>
      <td class="serre">${esc(formatDateShort(e.start_date))}${e.all_day ? '' : `<div class="petit muet">${esc(String(e.start_time || '').slice(0, 5))}</div>`}</td>
      <td class="serre"><span class="etiquette etiquette-cat cat-${esc(e.category)}">${esc(categorieLabel(e.category))}</span></td>
      <td class="serre">${e.is_public
        ? '<span class="etiquette etiquette--vert">Public</span>'
        : '<span class="etiquette etiquette--gris">Interne</span>'}</td>
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

  if (!ev) return null;

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

/** Rend une entree du journal d'audit (reutilise dans l'espace et l'admin). */
export function ligneAudit(e) {
  let changements = '';
  if (e.changes) {
    try {
      const obj = JSON.parse(e.changes);
      changements = `<div class="diff">${Object.entries(obj).map(([champ, [avant, apres]]) => {
        const nom = FIELD_LABELS[champ] || champ;
        if (champ === 'password_hash') return `<div><span class="diff__champ">${esc(nom)}</span> : <span class="diff__apres">modifié</span></div>`;
        const fmt = (v) => v === null || v === '' ? '<span class="muet">vide</span>' : esc(String(v).slice(0, 90));
        return `<div><span class="diff__champ">${esc(nom)}</span> :
          <span class="diff__avant">${fmt(avant)}</span><span class="diff__fleche">→</span><span class="diff__apres">${fmt(apres)}</span></div>`;
      }).join('')}</div>`;
    } catch { changements = ''; }
  }
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

export function formulaireEvenement(env, url, user, session, ev = null, erreur = null) {
  const modification = !!ev;
  const v = (k, def = '') => esc(ev?.[k] ?? def);
  const action = modification ? `/espace/evenements/${ev.id}/modifier` : '/espace/evenements/nouveau';
  const demain = toDateKey(new Date(Date.now() + 86400000));

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
          <select id="category" name="category">
            ${Object.entries(CATEGORIES).map(([k, label]) =>
              `<option value="${k}"${(ev?.category || 'ecole') === k ? ' selected' : ''}>${esc(label)}</option>`).join('')}
          </select>
        </div>
        <div class="champ">
          <label class="champ__label" for="location">Lieu</label>
          <input type="text" id="location" name="location" maxlength="150" value="${v('location')}"
                 placeholder="Ex. : Cour de l'école élémentaire">
        </div>
      </div>

      <fieldset>
        <legend>Quand ?</legend>
        <div class="champ">
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
            <input type="date" id="end_date" name="end_date" value="${v('end_date')}">
            <p class="champ__aide">À laisser vide si l'événement tient sur une seule journée.</p>
          </div>
          <div class="champ" data-horaire>
            <label class="champ__label" for="end_time">Heure de fin</label>
            <input type="time" id="end_time" name="end_time" value="${v('end_time', '')}">
          </div>
        </div>
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
  var c=document.getElementById('all_day');
  if(!c)return;
  function sync(){ document.querySelectorAll('[data-horaire]').forEach(function(el){ el.style.display=c.checked?'none':''; }); }
  c.addEventListener('change',sync); sync();
})();
</script>`;

  return html(page({
    titre: modification ? 'Modifier un événement' : 'Nouvel événement',
    contenu, user, chemin: '/espace/evenements', env, variante: 'espace',
  }));
}

/** Extrait et valide les champs d'un evenement. */
function lireEvenement(form) {
  const allDay = form.get('all_day') === '1';
  const start_date = field(form, 'start_date', 10);
  let end_date = field(form, 'end_date', 10) || start_date;
  const start_time = allDay ? null : (field(form, 'start_time', 5) || null);
  const end_time = allDay ? null : (field(form, 'end_time', 5) || null);

  const data = {
    title: field(form, 'title', 120),
    description: field(form, 'description', 4000),
    location: field(form, 'location', 150),
    category: CATEGORIES[field(form, 'category', 20)] ? field(form, 'category', 20) : 'autre',
    start_date, start_time, end_date, end_time,
    all_day: allDay ? 1 : 0,
    is_public: form.get('is_public') === '1' ? 1 : 0,
  };

  if (!data.title) return { erreur: "Le titre de l'événement est obligatoire." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) return { erreur: 'La date de début est obligatoire.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) return { erreur: 'La date de fin est invalide.' };
  if (end_date < start_date) return { erreur: 'La date de fin ne peut pas précéder la date de début.' };
  if (!allDay && start_time && end_time && start_date === end_date && end_time < start_time) {
    return { erreur: "L'heure de fin ne peut pas précéder l'heure de début." };
  }
  return { data };
}

export async function creerEvenementPost(env, request, url, user, session) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/espace/evenements/nouveau?err=csrf');

  const { data, erreur } = lireEvenement(form);
  if (erreur) return formulaireEvenement(env, url, user, session, Object.fromEntries(form), erreur);

  const id = uuid();
  const maintenant = nowIso();
  await env.DB.prepare(
    `INSERT INTO events (id, title, description, location, category, start_date, start_time,
                         end_date, end_time, all_day, is_public, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.title, data.description, data.location, data.category, data.start_date, data.start_time,
    data.end_date, data.end_time, data.all_day, data.is_public, user.id, maintenant, user.id, maintenant).run();

  await logAudit(env, request, {
    actor: user, action: 'event.create', entityType: 'event', entityId: id, entityLabel: data.title,
    changes: diff({}, data, CHAMPS_AUDITES),
  });

  return redirect(`/espace/evenements/${id}?ok=event-cree`);
}

export async function modifierEvenementPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/evenements/${id}/modifier?err=csrf`);

  const avant = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!avant) return redirect('/espace/evenements?err=introuvable');

  const { data, erreur } = lireEvenement(form);
  if (erreur) return formulaireEvenement(env, url, user, session, { ...avant, ...Object.fromEntries(form) }, erreur);

  await env.DB.prepare(
    `UPDATE events SET title = ?, description = ?, location = ?, category = ?, start_date = ?, start_time = ?,
                       end_date = ?, end_time = ?, all_day = ?, is_public = ?, updated_by = ?, updated_at = ?
      WHERE id = ?`
  ).bind(data.title, data.description, data.location, data.category, data.start_date, data.start_time,
    data.end_date, data.end_time, data.all_day, data.is_public, user.id, nowIso(), id).run();

  const changements = diff(avant, data, CHAMPS_AUDITES);
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
  if (!ev) return redirect('/espace/evenements?err=introuvable');

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
  if (!ev) return redirect('/espace/evenements?err=introuvable');

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
        <input type="tel" id="phone" name="phone" maxlength="25" value="${esc(user.phone)}">
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
          <input type="password" id="nouveau2" name="nouveau2" required autocomplete="new-password">
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
