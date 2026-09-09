// Administration : reservee au role « admin ».
// Gestion des comptes, consultation du journal d'audit, messages de contact.
import {
  esc, html, redirect, uuid, nowIso, field, isEmail, fullName, initials,
  formatDateTime, formatDateShort, todayKey, withQuery,
} from '../lib/util.js';
import { page, messagesFlash, bandeau } from '../lib/layout.js';
import { icone } from '../lib/icones.js';
import { logAudit, diff, ACTION_LABELS, actionTone, FIELD_LABELS } from '../lib/audit.js';
import { issueToken, destroyUserSessions, checkCsrf } from '../lib/auth.js';
import { sendEmail, activationEmail, resetEmail } from '../lib/email.js';
import { csrfInput, ligneAudit } from './espace.js';
import { INSTANCES, INSTANCES_COURT, ROLES, STATUTS, instanceLabel, normaliserInstance } from '../lib/instances.js';

/** Etiquette d'appartenance. Un simple membre n'en porte pas : c'est le cas par defaut. */
function badgeInstance(i, court = false) {
  if (i !== 'ca' && i !== 'bureau') return '';
  const texte = court ? INSTANCES_COURT[i] : instanceLabel(i);
  return `<span class="etiquette etiquette--${i}">${esc(texte)}</span>`;
}

function badgeStatut(s) {
  const classes = { invite: 'etiquette--bleu', actif: 'etiquette--vert', suspendu: 'etiquette--rouge' };
  return `<span class="etiquette ${classes[s] || 'etiquette--gris'}">${esc(STATUTS[s] || s)}</span>`;
}

// =====================================================================
//  Tableau de bord
// =====================================================================

export async function tableauDeBord(env, url, user) {
  const [comptes, evenements, messages, journal] = await env.DB.batch([
    env.DB.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'actif' THEN 1 ELSE 0 END) AS actifs,
        SUM(CASE WHEN status = 'invite' THEN 1 ELSE 0 END) AS invites,
        SUM(CASE WHEN status = 'suspendu' THEN 1 ELSE 0 END) AS suspendus
      FROM users`),
    env.DB.prepare(`SELECT
        SUM(CASE WHEN deleted_at IS NULL AND end_date >= ? THEN 1 ELSE 0 END) AS avenir,
        SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS total
      FROM events`).bind(todayKey()),
    env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE read_at IS NULL'),
    env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 12'),
  ]);

  const c = comptes.results[0] || {};
  const e = evenements.results[0] || {};
  const nonLus = messages.results[0]?.n || 0;

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--large">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Administration</h1><p>Vue d'ensemble de l'espace membres.</p></div>
    <a class="btn btn--principal" href="/admin/comptes/nouveau">${icone('plus', { taille: 18 })}Créer un compte</a>
  </div>

  <div class="tuiles">
    <a class="tuile" href="/admin/comptes">
      <div class="tuile__valeur">${c.actifs || 0}</div>
      <div class="tuile__label">comptes actifs</div>
    </a>
    <a class="tuile" href="/admin/comptes?statut=invite">
      <div class="tuile__valeur">${c.invites || 0}</div>
      <div class="tuile__label">invitations en attente</div>
    </a>
    <a class="tuile" href="/espace/evenements">
      <div class="tuile__valeur">${e.avenir || 0}</div>
      <div class="tuile__label">événements à venir</div>
    </a>
    <a class="tuile" href="/admin/messages">
      <div class="tuile__valeur">${nonLus}</div>
      <div class="tuile__label">message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}</div>
    </a>
  </div>

  <div class="grille" style="grid-template-columns:1.3fr .7fr;gap:1.5rem;align-items:start">
    <div class="carte">
      <div class="rang rang--entre" style="margin-bottom:.5rem">
        <h2 style="font-size:1.2rem;margin:0">Dernières actions</h2>
        <a class="lien-fleche" href="/admin/journal">Tout le journal ${icone('fleche_longue', { taille: 17 })}</a>
      </div>
      ${journal.results?.length ? journal.results.map(ligneAudit).join('')
        : '<p class="muet">Aucune action enregistrée.</p>'}
    </div>
    <div class="pile">
      <div class="carte carte--serre">
        <h3 style="font-size:1.05rem">Raccourcis</h3>
        <div class="pile pile--serre" style="margin-top:.75rem">
          <a class="btn btn--fantome btn--bloc" href="/admin/comptes/nouveau">Créer un compte</a>
          <a class="btn btn--fantome btn--bloc" href="/espace/evenements/nouveau">Ajouter un événement</a>
          <a class="btn btn--fantome btn--bloc" href="/admin/journal?export=csv">Exporter l'audit (CSV)</a>
        </div>
      </div>
      <div class="encart petit">
        <strong>Bon à savoir.</strong> Les comptes sont créés uniquement ici&nbsp;: il n'existe pas d'inscription libre sur le site. Chaque nouveau membre reçoit un e-mail d'activation valable 7 jours.
      </div>
    </div>
  </div>
</div></section>
<style>@media(max-width:900px){main .grille[style*="1.3fr"]{grid-template-columns:1fr!important}}</style>`;

  return html(page({ titre: 'Administration', contenu, user, chemin: '/admin', env, variante: 'espace' }));
}

// =====================================================================
//  Comptes
// =====================================================================

export async function listeComptes(env, url, user) {
  const statut = url.searchParams.get('statut') || '';
  const q = (url.searchParams.get('q') || '').trim();

  const conditions = [];
  const params = [];
  if (STATUTS[statut]) { conditions.push('status = ?'); params.push(statut); }
  if (q) { conditions.push('(email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `SELECT * FROM users ${where} ORDER BY status, last_name, first_name, email LIMIT 500`;
  const { results } = await (params.length ? env.DB.prepare(sql).bind(...params).all() : env.DB.prepare(sql).all());

  const lignes = (results || []).map((u) => `
    <tr>
      <td>
        <div class="rang" style="gap:.6rem;flex-wrap:nowrap">
          <span class="jeton" aria-hidden="true">${esc(initials(u))}</span>
          <div>
            <a href="/admin/comptes/${esc(u.id)}" style="font-weight:800;color:var(--noir);text-decoration:none">${esc(fullName(u) || u.email)}</a>
            <div class="petit muet">${esc(u.email)}</div>
          </div>
        </div>
      </td>
      <td class="serre">${u.title ? esc(u.title) : '<span class="muet">—</span>'}</td>
      <td class="serre">${badgeInstance(u.instance, true) || '<span class="muet">—</span>'}</td>
      <td class="serre">${u.role === 'admin'
        ? '<span class="etiquette etiquette--noir">Administrateur</span>'
        : '<span class="etiquette etiquette--gris">Membre</span>'}</td>
      <td class="serre">${badgeStatut(u.status)}</td>
      <td class="serre petit muet">${u.last_login_at ? esc(formatDateTime(u.last_login_at)) : 'jamais'}</td>
      <td class="serre"><a class="btn btn--petit btn--fantome" href="/admin/comptes/${esc(u.id)}">Gérer</a></td>
    </tr>`).join('');

  const onglet = (val, label) => {
    const actif = statut === val;
    return `<a class="btn btn--petit ${actif ? 'btn--principal' : 'btn--fantome'}" href="${withQuery('/admin/comptes', { statut: val, q })}">${label}</a>`;
  };

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--large">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Comptes</h1><p>${(results || []).length} compte${(results || []).length > 1 ? 's' : ''} affiché${(results || []).length > 1 ? 's' : ''}.</p></div>
    <a class="btn btn--principal" href="/admin/comptes/nouveau">${icone('plus', { taille: 18 })}Créer un compte</a>
  </div>

  <div class="rang" style="margin-bottom:1.25rem">
    ${onglet('', 'Tous')}${onglet('actif', 'Actifs')}${onglet('invite', 'Invitations')}${onglet('suspendu', 'Suspendus')}
    <form method="get" action="/admin/comptes" class="rang pousse" style="gap:.4rem">
      ${statut ? `<input type="hidden" name="statut" value="${esc(statut)}">` : ''}
      <input type="search" name="q" value="${esc(q)}" placeholder="Rechercher un nom, un e-mail…" style="width:260px">
      <button class="btn btn--petit btn--fantome" type="submit" data-garder="1">Rechercher</button>
    </form>
  </div>

  ${lignes ? `<div class="tableau-enveloppe"><table>
      <thead><tr><th>Membre</th><th>Fonction</th><th>Instance</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th></th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`
    : `<div class="vide">${icone('personnes', { taille: 34, classe: 'vide__icone' })}<h3>Aucun compte</h3>
       <p>${q || statut ? 'Aucun résultat pour ce filtre.' : 'Créez le premier compte membre.'}</p></div>`}
</div></section>`;

  return html(page({ titre: 'Comptes', contenu, user, chemin: '/admin/comptes', env, variante: 'espace' }));
}

/** Formulaire de creation / edition d'un compte. */
export function formulaireCompte(env, url, user, session, cible = null, erreur = null) {
  const edition = !!cible?.id;
  const v = (k, def = '') => esc(cible?.[k] ?? def);
  const action = edition ? `/admin/comptes/${cible.id}` : '/admin/comptes/nouveau';

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/admin">Administration</a> › <a href="/admin/comptes">Comptes</a> › ${edition ? esc(fullName(cible) || cible.email) : 'Nouveau'}</p>
  <h1>${edition ? 'Modifier le compte' : 'Créer un compte'}</h1>
  <p class="muet">${edition
    ? 'Toute modification est inscrite au journal d’audit.'
    : "Le membre recevra un e-mail l'invitant à choisir son mot de passe."}</p>

  <div class="carte" style="margin-top:1.5rem">
    ${erreur ? bandeau('erreur', erreur) : ''}
    <form method="post" action="${action}">
      ${csrfInput(session)}
      <div class="duo">
        <div class="champ">
          <label class="champ__label" for="first_name">Prénom</label>
          <input type="text" id="first_name" name="first_name" maxlength="60" value="${v('first_name')}" autofocus>
        </div>
        <div class="champ">
          <label class="champ__label" for="last_name">Nom</label>
          <input type="text" id="last_name" name="last_name" maxlength="60" value="${v('last_name')}">
        </div>
      </div>

      <div class="champ">
        <label class="champ__label" for="email">Adresse e-mail <span class="champ__requis">*</span></label>
        <input type="email" id="email" aria-describedby="aide-email" name="email" required maxlength="150" value="${v('email')}">
        <p class="champ__aide" id="aide-email">Elle sert d'identifiant de connexion et reçoit le lien d'activation.</p>
      </div>

      <div class="duo">
        <div class="champ">
          <label class="champ__label" for="title">Fonction dans l'association</label>
          <input type="text" id="title" name="title" maxlength="60" value="${v('title')}" placeholder="Ex. : Trésorière">
        </div>
        <div class="champ">
          <label class="champ__label" for="phone">Téléphone</label>
          <input type="tel" id="phone" name="phone" maxlength="25" value="${v('phone')}">
        </div>
      </div>

      <div class="champ">
        <label class="champ__label" for="instance">Instance</label>
        <select id="instance" aria-describedby="aide-instance" name="instance">
          ${Object.entries(INSTANCES).map(([k, l]) =>
            `<option value="${k}"${(cible?.instance || 'membre') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        <p class="champ__aide" id="aide-instance">Les membres du bureau siègent aussi au comité d'administration&nbsp;: choisir «&nbsp;Bureau&nbsp;» leur donne accès aux événements des deux instances.</p>
      </div>

      <div class="duo">
        <div class="champ">
          <label class="champ__label" for="role">Rôle</label>
          <select id="role" aria-describedby="aide-role" name="role">
            ${Object.entries(ROLES).map(([k, l]) =>
              `<option value="${k}"${(cible?.role || 'membre') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <p class="champ__aide" id="aide-role">Un administrateur peut gérer les comptes et consulter le journal d'audit.</p>
        </div>
        ${edition ? `
        <div class="champ">
          <label class="champ__label" for="status">Statut</label>
          <select id="status" aria-describedby="aide-status" name="status">
            ${Object.entries(STATUTS).map(([k, l]) =>
              `<option value="${k}"${cible.status === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <p class="champ__aide" id="aide-status">Un compte suspendu ne peut plus se connecter.</p>
        </div>` : '<div></div>'}
      </div>

      ${edition ? '' : `
      <div class="champ">
        <label class="case">
          <input type="checkbox" name="envoyer" value="1" checked>
          <span>Envoyer immédiatement l'e-mail d'activation</span>
        </label>
      </div>`}

      <div class="rang" style="margin-top:1.5rem">
        <button class="btn btn--principal" type="submit">${edition ? 'Enregistrer' : 'Créer le compte'}</button>
        <a class="btn btn--fantome" href="${edition ? `/admin/comptes/${cible.id}` : '/admin/comptes'}">Annuler</a>
      </div>
    </form>
  </div>
</div></section>`;

  return html(page({
    titre: edition ? 'Modifier un compte' : 'Créer un compte',
    contenu, user, chemin: '/admin/comptes', env, variante: 'espace',
  }));
}

/** Fiche detaillee d'un compte, avec les actions d'administration. */
export async function ficheCompte(env, url, user, session, id) {
  const cible = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!cible) return null;

  const [sessions, journal, contributions] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?').bind(id, nowIso()),
    env.DB.prepare(`SELECT * FROM audit_log WHERE actor_id = ? OR (entity_type = 'user' AND entity_id = ?)
                     ORDER BY created_at DESC LIMIT 25`).bind(id, id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE created_by = ? AND deleted_at IS NULL').bind(id),
  ]);

  const nbSessions = sessions.results[0]?.n || 0;
  const soiMeme = cible.id === user.id;

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  ${messagesFlash(url)}
  <p class="fil"><a href="/admin">Administration</a> › <a href="/admin/comptes">Comptes</a> › ${esc(fullName(cible) || cible.email)}</p>

  <div class="rang" style="margin-bottom:1.5rem">
    <span class="jeton jeton--grand">${esc(initials(cible))}</span>
    <div>
      <h1 style="margin:0;font-size:1.8rem">${esc(fullName(cible) || cible.email)}</h1>
      <p class="muet" style="margin:0">${esc(cible.email)}</p>
    </div>
    <div class="pousse rang">
      ${badgeStatut(cible.status)}
      ${badgeInstance(cible.instance)}
      ${cible.role === 'admin' ? '<span class="etiquette etiquette--noir">Administrateur</span>' : ''}
    </div>
  </div>

  <div class="carte" style="margin-bottom:1.5rem">
    <ul class="detail-liste">
      <li><span class="cle">Fonction</span><span>${cible.title ? esc(cible.title) : '<span class="muet">non renseignée</span>'}</span></li>
      <li><span class="cle">Instance</span><span>${badgeInstance(cible.instance) || '<span class="muet">simple membre</span>'}</span></li>
      <li><span class="cle">Téléphone</span><span>${cible.phone ? esc(cible.phone) : '<span class="muet">non renseigné</span>'}</span></li>
      <li><span class="cle">Créé le</span><span>${esc(formatDateTime(cible.created_at))}</span></li>
      <li><span class="cle">Dernière connexion</span><span>${cible.last_login_at ? esc(formatDateTime(cible.last_login_at)) : '<span class="muet">jamais connecté</span>'}</span></li>
      <li><span class="cle">Sessions ouvertes</span><span>${nbSessions}</span></li>
      <li><span class="cle">Événements créés</span><span>${contributions.results[0]?.n || 0}</span></li>
    </ul>
  </div>

  <div class="carte" style="margin-bottom:1.5rem">
    <h2 style="font-size:1.2rem">Actions</h2>
    <div class="rang" style="margin-top:.75rem">
      <a class="btn btn--principal btn--petit" href="/admin/comptes/${esc(cible.id)}/modifier">Modifier</a>

      <form method="post" action="/admin/comptes/${esc(cible.id)}/invitation" class="forme-inline">
        ${csrfInput(session)}
        <button class="btn btn--fantome btn--petit" type="submit">
          ${cible.status === 'invite' ? "Renvoyer l'invitation" : "Renvoyer un lien d'activation"}
        </button>
      </form>

      <form method="post" action="/admin/comptes/${esc(cible.id)}/reinitialisation" class="forme-inline">
        ${csrfInput(session)}
        <button class="btn btn--fantome btn--petit" type="submit">Envoyer une réinitialisation</button>
      </form>

      ${nbSessions > 0 ? `
      <form method="post" action="/admin/comptes/${esc(cible.id)}/sessions" class="forme-inline"
            data-confirmer="Fermer toutes les sessions de ce compte ?">
        ${csrfInput(session)}
        <button class="btn btn--fantome btn--petit" type="submit">Fermer les sessions</button>
      </form>` : ''}
    </div>

    <hr>
    ${soiMeme
      ? `<p class="petit muet">Vous ne pouvez pas supprimer votre propre compte depuis cette page.</p>`
      : `<form method="post" action="/admin/comptes/${esc(cible.id)}/supprimer"
              data-confirmer="Supprimer définitivement le compte de ${esc(fullName(cible) || cible.email)} ? Les événements qu'il a créés sont conservés.">
          ${csrfInput(session)}
          <button class="btn btn--danger btn--petit" type="submit">Supprimer ce compte</button>
          <span class="petit muet" style="margin-left:.5rem">Le journal d'audit conserve la trace de ses actions passées.</span>
        </form>`}
  </div>

  <div class="carte">
    <h2 style="font-size:1.2rem">Activité de ce compte</h2>
    ${journal.results?.length ? journal.results.map(ligneAudit).join('') : '<p class="muet">Aucune activité enregistrée.</p>'}
  </div>
</div></section>`;

  return html(page({
    titre: fullName(cible) || cible.email,
    contenu, user, chemin: '/admin/comptes', env, variante: 'espace',
  }));
}

/** Envoie l'invitation d'activation et journalise. */
async function envoyerInvitation(env, request, acteur, cible) {
  const token = await issueToken(env, cible.id, 'activation');
  const lien = `${env.SITE_URL}/espace/activation?token=${token}`;
  const envoi = await sendEmail(env, {
    to: cible.email, toName: cible.first_name, ...activationEmail(env, cible, lien),
  });
  await logAudit(env, request, {
    actor: acteur, action: 'user.activation_envoyee', entityType: 'user',
    entityId: cible.id, entityLabel: cible.email,
  });
  if (envoi.skipped) console.log(`Lien d'activation pour ${cible.email} : ${lien}`);
  return envoi;
}

export async function creerComptePost(env, request, url, user, session) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/admin/comptes/nouveau?err=csrf');

  const data = {
    email: field(form, 'email', 150).toLowerCase(),
    first_name: field(form, 'first_name', 60),
    last_name: field(form, 'last_name', 60),
    title: field(form, 'title', 60),
    instance: normaliserInstance(field(form, 'instance', 10)),
    phone: field(form, 'phone', 25),
    role: ROLES[field(form, 'role', 10)] ? field(form, 'role', 10) : 'membre',
  };
  const envoyer = form.get('envoyer') === '1';

  if (!isEmail(data.email)) return formulaireCompte(env, url, user, session, data, "L'adresse e-mail saisie n'est pas valide.");

  const existe = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(data.email).first();
  if (existe) return formulaireCompte(env, url, user, session, data, 'Un compte utilise déjà cette adresse e-mail.');

  const id = uuid();
  const maintenant = nowIso();
  await env.DB.prepare(
    `INSERT INTO users (id, email, first_name, last_name, title, phone, instance, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'invite', ?, ?)`
  ).bind(id, data.email, data.first_name, data.last_name, data.title, data.phone, data.instance, data.role, maintenant, maintenant).run();

  await logAudit(env, request, {
    actor: user, action: 'user.create', entityType: 'user', entityId: id, entityLabel: data.email,
    changes: diff({}, data, ['email', 'first_name', 'last_name', 'instance', 'role']),
  });

  let flash = 'compte-cree-sans-envoi';
  if (envoyer) {
    const envoi = await envoyerInvitation(env, request, user, { id, ...data });
    flash = envoi.ok ? 'compte-cree' : 'compte-cree-sans-mail';
  }

  return redirect(`/admin/comptes/${id}?ok=${flash}`);
}

export async function modifierComptePost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/admin/comptes/${id}/modifier?err=csrf`);

  const avant = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!avant) return redirect('/admin/comptes?err=introuvable');

  const data = {
    email: field(form, 'email', 150).toLowerCase(),
    first_name: field(form, 'first_name', 60),
    last_name: field(form, 'last_name', 60),
    title: field(form, 'title', 60),
    instance: normaliserInstance(field(form, 'instance', 10)),
    phone: field(form, 'phone', 25),
    role: ROLES[field(form, 'role', 10)] ? field(form, 'role', 10) : 'membre',
    status: STATUTS[field(form, 'status', 10)] ? field(form, 'status', 10) : avant.status,
  };

  if (!isEmail(data.email)) return formulaireCompte(env, url, user, session, { ...avant, ...data }, "L'adresse e-mail saisie n'est pas valide.");

  const doublon = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').bind(data.email, id).first();
  if (doublon) return formulaireCompte(env, url, user, session, { ...avant, ...data }, 'Un autre compte utilise déjà cette adresse e-mail.');

  // Garde-fou : ne pas se retirer soi-meme les droits d'administration.
  if (id === user.id && (data.role !== 'admin' || data.status !== 'actif')) {
    return formulaireCompte(env, url, user, session, { ...avant, ...data },
      'Vous ne pouvez pas retirer vos propres droits d’administration ni suspendre votre compte.');
  }

  await env.DB.prepare(
    `UPDATE users SET email = ?, first_name = ?, last_name = ?, title = ?, phone = ?, instance = ?, role = ?, status = ?, updated_at = ?
      WHERE id = ?`
  ).bind(data.email, data.first_name, data.last_name, data.title, data.phone, data.instance, data.role, data.status, nowIso(), id).run();

  // Une suspension ferme immediatement les sessions ouvertes.
  if (data.status !== 'actif' && avant.status === 'actif') await destroyUserSessions(env, id);

  const changements = diff(avant, data, ['email', 'first_name', 'last_name', 'title', 'phone', 'instance', 'role', 'status']);
  if (changements) {
    await logAudit(env, request, {
      actor: user, action: 'user.update', entityType: 'user', entityId: id,
      entityLabel: data.email, changes: changements,
    });
  }

  return redirect(`/admin/comptes/${id}?ok=compte-modifie`);
}

export async function supprimerComptePost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/admin/comptes/${id}?err=csrf`);
  if (id === user.id) return redirect(`/admin/comptes/${id}?err=acces-refuse`);

  const cible = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!cible) return redirect('/admin/comptes?err=introuvable');

  // La trace d'audit est ecrite AVANT la suppression, tant que les donnees existent.
  await logAudit(env, request, {
    actor: user, action: 'user.delete', entityType: 'user', entityId: id,
    entityLabel: `${fullName(cible)} <${cible.email}>`,
    changes: { email: [cible.email, null], role: [cible.role, null], status: [cible.status, null] },
  });

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return redirect('/admin/comptes?ok=compte-supprime');
}

export async function invitationPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/admin/comptes/${id}?err=csrf`);

  const cible = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!cible) return redirect('/admin/comptes?err=introuvable');

  await envoyerInvitation(env, request, user, cible);
  return redirect(`/admin/comptes/${id}?ok=invitation-envoyee`);
}

export async function reinitialisationPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/admin/comptes/${id}?err=csrf`);

  const cible = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!cible) return redirect('/admin/comptes?err=introuvable');

  const token = await issueToken(env, cible.id, 'reinitialisation');
  const lien = `${env.SITE_URL}/espace/reinitialisation?token=${token}`;
  const envoi = await sendEmail(env, { to: cible.email, toName: cible.first_name, ...resetEmail(env, cible, lien) });
  if (envoi.skipped) console.log(`Lien de réinitialisation pour ${cible.email} : ${lien}`);

  await logAudit(env, request, {
    actor: user, action: 'user.reinit_envoyee', entityType: 'user', entityId: id, entityLabel: cible.email,
  });

  return redirect(`/admin/comptes/${id}?ok=reinit-envoyee`);
}

export async function sessionsPost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/admin/comptes/${id}?err=csrf`);

  const cible = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!cible) return redirect('/admin/comptes?err=introuvable');

  await destroyUserSessions(env, id);
  await logAudit(env, request, {
    actor: user, action: 'user.sessions_revoquees', entityType: 'user', entityId: id, entityLabel: cible.email,
  });

  return redirect(`/admin/comptes/${id}?ok=sessions-revoquees`);
}

// =====================================================================
//  Journal d'audit
// =====================================================================

const PAR_PAGE = 40;

export async function journalAudit(env, url, user) {
  const action = url.searchParams.get('action') || '';
  const acteur = url.searchParams.get('acteur') || '';
  const depuis = url.searchParams.get('depuis') || '';
  const jusqua = url.searchParams.get('jusqua') || '';
  const q = (url.searchParams.get('q') || '').trim();
  const p = Math.max(1, parseInt(url.searchParams.get('p') || '1', 10) || 1);

  const conditions = [];
  const params = [];
  if (action) { conditions.push('action = ?'); params.push(action); }
  if (acteur) { conditions.push('actor_id = ?'); params.push(acteur); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(depuis)) { conditions.push('created_at >= ?'); params.push(`${depuis}T00:00:00.000Z`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(jusqua)) { conditions.push('created_at <= ?'); params.push(`${jusqua}T23:59:59.999Z`); }
  if (q) { conditions.push('(entity_label LIKE ? OR actor_email LIKE ? OR ip LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Export CSV : meme filtrage, sans pagination.
  if (url.searchParams.get('export') === 'csv') {
    const sql = `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT 5000`;
    const { results } = await (params.length ? env.DB.prepare(sql).bind(...params).all() : env.DB.prepare(sql).all());
    const echapCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const entetes = ['Date', 'Auteur', 'E-mail', 'Action', 'Type', 'Identifiant', 'Libellé', 'Modifications', 'IP'];
    const lignes = (results || []).map((e) => [
      e.created_at, e.actor_name, e.actor_email, ACTION_LABELS[e.action] || e.action,
      e.entity_type, e.entity_id, e.entity_label, e.changes, e.ip,
    ].map(echapCsv).join(';'));
    // BOM UTF-8 pour qu'Excel ouvre correctement les accents.
    const csv = '﻿' + [entetes.join(';'), ...lignes].join('\r\n');
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="audit-apps-${todayKey()}.csv"`,
      },
    });
  }

  const sqlCount = `SELECT COUNT(*) AS n FROM audit_log ${where}`;
  const total = (await (params.length ? env.DB.prepare(sqlCount).bind(...params).first() : env.DB.prepare(sqlCount).first()))?.n || 0;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const pageCourante = Math.min(p, pages);

  const sql = `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...params, PAR_PAGE, (pageCourante - 1) * PAR_PAGE).all();

  const { results: acteurs } = await env.DB.prepare(
    'SELECT id, first_name, last_name, email FROM users ORDER BY last_name, first_name'
  ).all();

  const lienPage = (n) => withQuery('/admin/journal', { action, acteur, depuis, jusqua, q, p: n > 1 ? n : '' });

  const lignes = (results || []).map((e) => `
    <tr>
      <td class="serre petit muet" style="white-space:nowrap">${esc(formatDateTime(e.created_at))}</td>
      <td>
        <div class="rang" style="gap:.35rem">
          <span class="point point--${actionTone(e.action)}"></span>
          <strong>${esc(ACTION_LABELS[e.action] || e.action)}</strong>
        </div>
        ${e.entity_label ? `<div class="petit muet">${esc(e.entity_label)}</div>` : ''}
        ${blocChangements(e.changes)}
      </td>
      <td class="serre">
        ${esc(e.actor_name || '—')}
        <div class="petit muet">${esc(e.actor_email)}</div>
      </td>
      <td class="serre petit muet">${esc(e.ip || '—')}</td>
    </tr>`).join('');

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--large">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Journal d'audit</h1><p>${total} entrée${total > 1 ? 's' : ''} — toutes les actions sensibles du site.</p></div>
    <a class="btn btn--fantome" href="${withQuery('/admin/journal', { action, acteur, depuis, jusqua, q, export: 'csv' })}">${icone('telecharger', { taille: 17 })}Exporter en CSV</a>
  </div>

  <form method="get" action="/admin/journal" class="filtres">
    <div class="champ">
      <label class="champ__label" for="f-action">Action</label>
      <select id="f-action" name="action">
        <option value="">Toutes</option>
        ${Object.entries(ACTION_LABELS).map(([k, l]) =>
          `<option value="${k}"${action === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    <div class="champ">
      <label class="champ__label" for="f-acteur">Auteur</label>
      <select id="f-acteur" name="acteur">
        <option value="">Tous</option>
        ${(acteurs || []).map((a) =>
          `<option value="${esc(a.id)}"${acteur === a.id ? ' selected' : ''}>${esc(fullName(a) || a.email)}</option>`).join('')}
      </select>
    </div>
    <div class="champ">
      <label class="champ__label" for="f-depuis">Du</label>
      <input type="date" id="f-depuis" name="depuis" value="${esc(depuis)}">
    </div>
    <div class="champ">
      <label class="champ__label" for="f-jusqua">Au</label>
      <input type="date" id="f-jusqua" name="jusqua" value="${esc(jusqua)}">
    </div>
    <div class="champ">
      <label class="champ__label" for="f-q">Recherche</label>
      <input type="search" id="f-q" name="q" value="${esc(q)}" placeholder="Libellé, e-mail, IP…">
    </div>
    <div class="rang">
      <button class="btn btn--principal btn--petit" type="submit" data-garder="1">Filtrer</button>
      <a class="btn btn--fantome btn--petit" href="/admin/journal">Réinitialiser</a>
    </div>
  </form>

  ${lignes ? `<div class="tableau-enveloppe"><table>
      <thead><tr><th>Date</th><th>Action</th><th>Auteur</th><th>IP</th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`
    : `<div class="vide">${icone('journal', { taille: 34, classe: 'vide__icone' })}<h3>Aucune entrée</h3><p>Aucune action ne correspond à ces filtres.</p></div>`}

  ${pages > 1 ? `<nav class="pagination" aria-label="Pagination">
    <a class="${pageCourante <= 1 ? 'inactif' : ''}" href="${lienPage(pageCourante - 1)}">${icone('fleche_gauche', { taille: 16 })}Précédent</a>
    <span class="actuel">${pageCourante} / ${pages}</span>
    <a class="${pageCourante >= pages ? 'inactif' : ''}" href="${lienPage(pageCourante + 1)}">Suivant${icone('fleche_droite', { taille: 16 })}</a>
  </nav>` : ''}
</div></section>`;

  return html(page({ titre: "Journal d'audit", contenu, user, chemin: '/admin/journal', env, variante: 'espace' }));
}

function blocChangements(changes) {
  if (!changes) return '';
  try {
    const obj = JSON.parse(changes);
    return `<div class="diff">${Object.entries(obj).slice(0, 6).map(([champ, [avant, apres]]) => {
      const nom = FIELD_LABELS[champ] || champ;
      if (champ === 'password_hash') return `<div><span class="diff__champ">${esc(nom)}</span> : <span class="diff__apres">modifié</span></div>`;
      const fmt = (v) => v === null || v === '' ? '<span class="muet">vide</span>' : esc(String(v).slice(0, 60));
      return `<div><span class="diff__champ">${esc(nom)}</span> :
        <span class="diff__avant">${fmt(avant)}</span><span class="diff__fleche">→</span><span class="diff__apres">${fmt(apres)}</span></div>`;
    }).join('')}</div>`;
  } catch { return ''; }
}

// =====================================================================
//  Messages de contact
// =====================================================================

export async function listeMessages(env, url, user, session) {
  const { results } = await env.DB.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200').all();

  // Consulter la page marque les messages comme lus.
  await env.DB.prepare('UPDATE messages SET read_at = ? WHERE read_at IS NULL').bind(nowIso()).run();

  const cartes = (results || []).map((m) => `
    <div class="carte" style="${m.read_at ? '' : 'border-color:var(--jaune)'}">
      <div class="rang rang--entre">
        <div>
          <h3 style="margin:0;font-size:1.1rem">${esc(m.subject || 'Sans sujet')}</h3>
          <p class="petit muet" style="margin:0">${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>
        </div>
        <div class="rang">
          ${m.read_at ? '' : '<span class="etiquette">Nouveau</span>'}
          <span class="petit muet">${esc(formatDateTime(m.created_at))}</span>
        </div>
      </div>
      <div style="margin-top:.85rem;padding:.9rem 1rem;background:var(--creme);border-radius:var(--r-sm);white-space:pre-wrap">${esc(m.body)}</div>
      <div class="rang" style="margin-top:.85rem">
        <a class="btn btn--petit btn--fantome" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Votre message'))}">Répondre</a>
        <form method="post" action="/admin/messages/${esc(m.id)}/supprimer" class="forme-inline" data-confirmer="Supprimer ce message ?">
          ${csrfInput(session)}
          <button class="btn btn--petit btn--danger" type="submit">Supprimer</button>
        </form>
        <span class="petit muet pousse">IP ${esc(m.ip || '—')}</span>
      </div>
    </div>`).join('');

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Messages</h1><p>Reçus via le formulaire de contact du site.</p></div>
  </div>
  ${cartes ? `<div class="pile">${cartes}</div>`
    : `<div class="vide">${icone('enveloppe', { taille: 34, classe: 'vide__icone' })}<h3>Aucun message</h3><p>Les messages envoyés depuis la page Contact arriveront ici.</p></div>`}
</div></section>`;

  return html(page({ titre: 'Messages', contenu, user, chemin: '/admin/messages', env, variante: 'espace' }));
}

export async function supprimerMessagePost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/admin/messages?err=csrf');

  const m = await env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
  if (!m) return redirect('/admin/messages?err=introuvable');

  await logAudit(env, request, {
    actor: user, action: 'message.delete', entityType: 'message', entityId: id,
    entityLabel: `${m.name} — ${m.subject || 'sans sujet'}`,
  });
  await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();

  return redirect('/admin/messages?ok=message-supprime');
}
