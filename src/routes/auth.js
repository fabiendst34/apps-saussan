// Parcours d'authentification : connexion, deconnexion, activation, mot de passe oublie.
import { esc, html, redirect, field, isEmail, nowIso, withQuery } from '../lib/util.js';
import { page, messagesFlash, bandeau } from '../lib/layout.js';
import { logAudit } from '../lib/audit.js';
import {
  verifyPassword, hashPassword, passwordProblem, createSession, destroySession,
  destroyUserSessions, issueToken, consumeToken, markTokenUsed, tooManyAttempts,
} from '../lib/auth.js';
import { sendEmail, activationEmail, resetEmail } from '../lib/email.js';
import { clientIp } from '../lib/util.js';

/** Coquille commune aux ecrans d'authentification. */
function ecran(env, url, { titre, sousTitre, corps, chemin, lienBas = '' }) {
  const contenu = `
<section class="section"><div class="conteneur conteneur--forme">
  <div class="centre" style="margin-bottom:1.5rem">
    <h1 style="font-size:2rem;margin-bottom:.25rem">${esc(titre)}</h1>
    ${sousTitre ? `<p class="muet">${sousTitre}</p>` : ''}
  </div>
  <div class="carte">${messagesFlash(url)}${corps}</div>
  ${lienBas ? `<p class="centre petit muet" style="margin-top:1.25rem">${lienBas}</p>` : ''}
</div></section>`;
  return html(page({ titre, contenu, chemin, env, variante: 'public' }));
}

function erreurBloc(texte) {
  return texte ? bandeau('erreur', texte) : '';
}

const AIDE_MDP = 'Au moins 10 caractères, dont une lettre et un chiffre.';

// --- Connexion -------------------------------------------------------

export function connexionPage(env, url, erreur = null, email = '') {
  const corps = `${erreurBloc(erreur)}
<form method="post" action="/espace/connexion">
  <div class="champ">
    <label class="champ__label" for="email">Adresse e-mail</label>
    <input type="email" id="email" name="email" required autocomplete="username" autofocus value="${esc(email)}">
  </div>
  <div class="champ">
    <label class="champ__label" for="password">Mot de passe</label>
    <input type="password" id="password" name="password" required autocomplete="current-password">
  </div>
  <button class="btn btn--principal btn--bloc" type="submit">Se connecter</button>
</form>
<p class="centre petit" style="margin-top:1rem"><a href="/espace/mot-de-passe-oublie">Mot de passe oublié&nbsp;?</a></p>`;

  return ecran(env, url, {
    titre: 'Espace membres',
    sousTitre: "Réservé aux membres de l'association.",
    corps,
    chemin: '/espace/connexion',
    lienBas: `Pas encore de compte&nbsp;? Les accès sont créés par le bureau. <a href="/contact">Contactez-nous</a>.`,
  });
}

export async function connexionPost(env, request, url) {
  const form = await request.formData();
  const email = field(form, 'email', 150).toLowerCase();
  const password = String(form.get('password') || '');
  const ip = clientIp(request);

  if (!isEmail(email) || !password) {
    return connexionPage(env, url, 'Merci de renseigner votre e-mail et votre mot de passe.', email);
  }

  if (await tooManyAttempts(env, ip, email)) {
    await logAudit(env, request, { action: 'auth.blocage', actorEmail: email, entityType: 'session' });
    return connexionPage(env, url, 'Trop de tentatives de connexion. Merci de réessayer dans quinze minutes.', email);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

  // Message identique dans tous les cas d'echec : on ne revele pas l'existence d'un compte.
  const echec = async (motif) => {
    await logAudit(env, request, { action: 'auth.echec', actorEmail: email, entityType: 'session', entityLabel: motif });
    return connexionPage(env, url, 'E-mail ou mot de passe incorrect.', email);
  };

  if (!user) return echec('compte inexistant');
  if (user.status === 'invite') {
    return connexionPage(env, url,
      "Ce compte n'est pas encore activé. Vérifiez l'e-mail d'invitation reçu, ou demandez au bureau de vous le renvoyer.", email);
  }
  if (user.status === 'suspendu') {
    await logAudit(env, request, { action: 'auth.echec', actorEmail: email, entityType: 'session', entityLabel: 'compte suspendu' });
    return connexionPage(env, url, 'Ce compte est désactivé. Contactez le bureau de l’association.', email);
  }
  if (!(await verifyPassword(password, user.password_hash))) return echec('mot de passe invalide');

  const headers = await createSession(env, request, url, user.id);
  await logAudit(env, request, { actor: user, action: 'auth.connexion', entityType: 'session', entityId: user.id });
  return redirect('/espace', headers);
}

export async function deconnexionPost(env, request, url, user) {
  const headers = await destroySession(env, request, url);
  if (user) {
    await logAudit(env, request, { actor: user, action: 'auth.deconnexion', entityType: 'session', entityId: user.id });
  }
  return redirect('/espace/connexion?ok=deconnecte', headers);
}

// --- Activation de compte --------------------------------------------

export async function activationPage(env, url, erreur = null) {
  const token = url.searchParams.get('token') || '';
  const info = await consumeToken(env, token, 'activation');
  if (!info) {
    return ecran(env, url, {
      titre: 'Lien expiré',
      corps: bandeau('erreur', "Ce lien d'activation n'est plus valable. Demandez au bureau de vous renvoyer une invitation.")
        + '<a class="btn btn--fantome btn--bloc" href="/contact">Contacter le bureau</a>' ,
      chemin: '/espace/activation',
    });
  }

  const corps = `${erreurBloc(erreur)}
<p class="petit muet">Compte&nbsp;: <strong>${esc(info.email)}</strong></p>
<form method="post" action="/espace/activation">
  <input type="hidden" name="token" value="${esc(token)}">
  <div class="champ">
    <label class="champ__label" for="password">Choisissez un mot de passe</label>
    <input type="password" id="password" aria-describedby="aide-password" name="password" required autocomplete="new-password" autofocus minlength="10">
    <p class="champ__aide" id="aide-password">${AIDE_MDP}</p>
  </div>
  <div class="champ">
    <label class="champ__label" for="password2">Confirmez le mot de passe</label>
    <input type="password" id="password2" name="password2" required autocomplete="new-password">
  </div>
  <button class="btn btn--principal btn--bloc" type="submit">Activer mon compte</button>
</form>`;

  return ecran(env, url, {
    titre: 'Activation de votre compte',
    sousTitre: 'Encore une étape avant de rejoindre l’espace membres.',
    corps, chemin: '/espace/activation',
  });
}

export async function activationPost(env, request, url) {
  const form = await request.formData();
  const token = field(form, 'token', 200);
  const password = String(form.get('password') || '');
  const password2 = String(form.get('password2') || '');

  const rejouer = (msg) => {
    const u = new URL(url);
    u.searchParams.set('token', token);
    return activationPage(env, u, msg);
  };

  const info = await consumeToken(env, token, 'activation');
  if (!info) return redirect('/espace/connexion?err=lien-invalide');
  if (password !== password2) return rejouer('Les deux mots de passe ne correspondent pas.');
  const probleme = passwordProblem(password);
  if (probleme) return rejouer(probleme);

  const hash = await hashPassword(password, env);
  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, status = 'actif', updated_at = ? WHERE id = ?"
  ).bind(hash, nowIso(), info.user_id).run();
  await markTokenUsed(env, info.tokenId);

  await logAudit(env, request, {
    actorEmail: info.email, action: 'auth.activation',
    entityType: 'user', entityId: info.user_id, entityLabel: info.email,
  });

  return redirect('/espace/connexion?ok=compte-active');
}

// --- Mot de passe oublié ---------------------------------------------

export function oubliPage(env, url, erreur = null) {
  const corps = `${erreurBloc(erreur)}
<form method="post" action="/espace/mot-de-passe-oublie">
  <div class="champ">
    <label class="champ__label" for="email">Votre adresse e-mail</label>
    <input type="email" id="email" aria-describedby="aide-email" name="email" required autocomplete="username" autofocus>
    <p class="champ__aide" id="aide-email">Si un compte existe, vous recevrez un lien de réinitialisation.</p>
  </div>
  <button class="btn btn--principal btn--bloc" type="submit">Recevoir un lien</button>
</form>`;
  return ecran(env, url, {
    titre: 'Mot de passe oublié',
    sousTitre: 'Nous vous envoyons un lien pour en choisir un nouveau.',
    corps, chemin: '/espace/mot-de-passe-oublie',
    lienBas: '<a class="lien-retour" href="/espace/connexion">Revenir à la connexion</a>',
  });
}

export async function oubliPost(env, request, url) {
  const form = await request.formData();
  const email = field(form, 'email', 150).toLowerCase();
  if (!isEmail(email)) return oubliPage(env, url, "L'adresse e-mail saisie n'est pas valide.");

  const user = await env.DB.prepare(
    "SELECT * FROM users WHERE email = ? AND status = 'actif'"
  ).bind(email).first();

  // Reponse identique que le compte existe ou non.
  if (user) {
    const token = await issueToken(env, user.id, 'reinitialisation');
    const lien = `${env.SITE_URL}/espace/reinitialisation?token=${token}`;
    await sendEmail(env, { to: user.email, toName: user.first_name, ...resetEmail(env, user, lien) });
    await logAudit(env, request, {
      actorEmail: email, action: 'auth.mdp_oublie', entityType: 'user', entityId: user.id, entityLabel: email,
    });
  } else {
    await logAudit(env, request, {
      actorEmail: email, action: 'auth.mdp_oublie', entityType: 'user', entityLabel: 'compte inconnu',
    });
  }

  return ecran(env, url, {
    titre: 'Vérifiez votre boîte mail',
    corps: bandeau('succes', "Si un compte est associé à cette adresse, un lien de réinitialisation vient d'être envoyé. Il est valable 2 heures.")
      + '<a class="btn btn--fantome btn--bloc" href="/espace/connexion">Revenir à la connexion</a>' ,
    chemin: '/espace/mot-de-passe-oublie',
  });
}

export async function reinitPage(env, url, erreur = null) {
  const token = url.searchParams.get('token') || '';
  const info = await consumeToken(env, token, 'reinitialisation');
  if (!info) {
    return ecran(env, url, {
      titre: 'Lien expiré',
      corps: bandeau('erreur', "Ce lien de réinitialisation n'est plus valable. Les liens expirent au bout de 2 heures.")
        + '<a class="btn btn--principal btn--bloc" href="/espace/mot-de-passe-oublie">Demander un nouveau lien</a>' ,
      chemin: '/espace/reinitialisation',
    });
  }

  const corps = `${erreurBloc(erreur)}
<p class="petit muet">Compte&nbsp;: <strong>${esc(info.email)}</strong></p>
<form method="post" action="/espace/reinitialisation">
  <input type="hidden" name="token" value="${esc(token)}">
  <div class="champ">
    <label class="champ__label" for="password">Nouveau mot de passe</label>
    <input type="password" id="password" aria-describedby="aide-password" name="password" required autocomplete="new-password" autofocus minlength="10">
    <p class="champ__aide" id="aide-password">${AIDE_MDP}</p>
  </div>
  <div class="champ">
    <label class="champ__label" for="password2">Confirmez</label>
    <input type="password" id="password2" name="password2" required autocomplete="new-password">
  </div>
  <button class="btn btn--principal btn--bloc" type="submit">Enregistrer</button>
</form>`;
  return ecran(env, url, { titre: 'Nouveau mot de passe', corps, chemin: '/espace/reinitialisation' });
}

export async function reinitPost(env, request, url) {
  const form = await request.formData();
  const token = field(form, 'token', 200);
  const password = String(form.get('password') || '');
  const password2 = String(form.get('password2') || '');

  const info = await consumeToken(env, token, 'reinitialisation');
  if (!info) return redirect('/espace/connexion?err=lien-invalide');

  const rejouer = (msg) => {
    const u = new URL(url);
    u.searchParams.set('token', token);
    return reinitPage(env, u, msg);
  };
  if (password !== password2) return rejouer('Les deux mots de passe ne correspondent pas.');
  const probleme = passwordProblem(password);
  if (probleme) return rejouer(probleme);

  const hash = await hashPassword(password, env);
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(hash, nowIso(), info.user_id).run();
  await markTokenUsed(env, info.tokenId);
  // Un changement de mot de passe ferme les sessions ouvertes ailleurs.
  await destroyUserSessions(env, info.user_id);

  await logAudit(env, request, {
    actorEmail: info.email, action: 'auth.mdp_reinitialise',
    entityType: 'user', entityId: info.user_id, entityLabel: info.email,
  });

  return redirect('/espace/connexion?ok=mdp-reinitialise');
}
