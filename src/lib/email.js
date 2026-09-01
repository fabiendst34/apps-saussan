// Envoi d'e-mails transactionnels via l'API Mailjet v3.1.
import { esc } from './util.js';

const MAILJET_ENDPOINT = 'https://api.mailjet.com/v3.1/send';

/**
 * Envoie un e-mail. Si les cles Mailjet ne sont pas configurees, le contenu est
 * ecrit dans les logs (mode developpement) et l'appel n'est pas considere comme
 * une erreur metier : la creation d'un compte ne doit pas echouer a cause du mail.
 */
export async function sendEmail(env, { to, toName, subject, html, text }) {
  if (!env.MAILJET_API_KEY || !env.MAILJET_API_SECRET) {
    console.log(`[e-mail non envoyé — Mailjet non configuré] à ${to} : ${subject}\n${text}`);
    return { ok: false, skipped: true };
  }

  const payload = {
    Messages: [{
      From: { Email: env.MAIL_FROM, Name: env.MAIL_FROM_NAME || 'APPS Saussan' },
      To: [{ Email: to, Name: toName || to }],
      Subject: subject,
      TextPart: text,
      HTMLPart: html,
      ReplyTo: { Email: env.CONTACT_EMAIL },
    }],
  };

  try {
    const res = await fetch(MAILJET_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic ' + btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('mailjet: échec', res.status, await res.text());
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('mailjet: erreur réseau', err);
    return { ok: false, error: String(err) };
  }
}

/** Gabarit HTML commun a tous les e-mails de l'association. */
function wrap(env, title, bodyHtml) {
  return [
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:24px;background:#FBF7F0;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#22201D;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EFE4D2;">',
    '<tr><td style="background:#F2A93B;padding:22px 28px;">',
    '<span style="font-size:24px;font-weight:800;color:#1D1B19;letter-spacing:1px;">APPS</span>',
    '<span style="font-size:13px;color:#5C4A21;display:block;margin-top:2px;">Association des Parents des Pitchouns Saussannais</span>',
    '</td></tr><tr><td style="padding:28px;">',
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${esc(title)}</h1>`,
    bodyHtml,
    '</td></tr><tr><td style="padding:18px 28px;background:#FBF7F0;font-size:12px;color:#6B6257;line-height:1.6;">',
    'APPS — Centre Socio-culturel, Place de la Fontaine, 34570 Saussan<br>',
    `<a href="mailto:${esc(env.CONTACT_EMAIL)}" style="color:#8A6A1F;">${esc(env.CONTACT_EMAIL)}</a>`,
    '</td></tr></table></body></html>',
  ].join('');
}

function button(url, label) {
  return `<p style="margin:26px 0;"><a href="${esc(url)}" style="display:inline-block;background:#1D1B19;color:#FFD489;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:700;font-size:15px;">${esc(label)}</a></p>`
    + `<p style="font-size:12px;color:#6B6257;margin:0;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>`
    + `<span style="word-break:break-all;color:#8A6A1F;">${esc(url)}</span></p>`;
}

export function activationEmail(env, user, link) {
  const prenom = esc(user.first_name || '');
  const title = 'Activez votre compte APPS';
  const html = wrap(env, title,
    `<p style="margin:0 0 14px;line-height:1.6;">Bonjour ${prenom},</p>`
    + `<p style="margin:0 0 14px;line-height:1.6;">Un compte vient d'être créé pour vous sur l'espace membres de l'APPS. Il vous donne accès au calendrier partagé de l'association.</p>`
    + `<p style="margin:0;line-height:1.6;">Pour choisir votre mot de passe et activer votre accès :</p>`
    + button(link, 'Activer mon compte')
    + `<p style="font-size:12px;color:#6B6257;margin:18px 0 0;">Ce lien est valable 7 jours. Si ce message ne vous concerne pas, vous pouvez l'ignorer.</p>`);
  const text = `Bonjour ${user.first_name || ''},\n\nUn compte vient d'être créé pour vous sur l'espace membres de l'APPS.\nActivez-le et choisissez votre mot de passe ici :\n${link}\n\nCe lien est valable 7 jours.\n\nAPPS — ${env.CONTACT_EMAIL}`;
  return { subject: title, html, text };
}

export function resetEmail(env, user, link) {
  const title = 'Réinitialisation de votre mot de passe';
  const html = wrap(env, title,
    `<p style="margin:0 0 14px;line-height:1.6;">Bonjour ${esc(user.first_name || '')},</p>`
    + `<p style="margin:0;line-height:1.6;">Vous avez demandé à réinitialiser le mot de passe de votre compte APPS.</p>`
    + button(link, 'Choisir un nouveau mot de passe')
    + `<p style="font-size:12px;color:#6B6257;margin:18px 0 0;">Ce lien est valable 2 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.</p>`);
  const text = `Bonjour,\n\nPour choisir un nouveau mot de passe APPS :\n${link}\n\nCe lien est valable 2 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\nAPPS — ${env.CONTACT_EMAIL}`;
  return { subject: title, html, text };
}

export function contactNotificationEmail(env, message) {
  const title = 'Nouveau message depuis le site';
  const html = wrap(env, title,
    `<p style="margin:0 0 6px;"><strong>De :</strong> ${esc(message.name)} &lt;${esc(message.email)}&gt;</p>`
    + `<p style="margin:0 0 6px;"><strong>Sujet :</strong> ${esc(message.subject || '(aucun)')}</p>`
    + `<div style="margin-top:16px;padding:16px;background:#FBF7F0;border-radius:10px;line-height:1.6;white-space:pre-wrap;">${esc(message.body)}</div>`);
  const text = `Nouveau message depuis le site APPS\n\nDe : ${message.name} <${message.email}>\nSujet : ${message.subject}\n\n${message.body}`;
  return { subject: `[Site APPS] ${message.subject || 'Nouveau message'}`, html, text };
}

/**
 * Envoi groupe : un seul appel a l'API pour plusieurs destinataires.
 *
 * Le plan Workers gratuit limite une requete a 50 sous-requetes ; envoyer un
 * message par membre les epuiserait. Mailjet accepte jusqu'a 50 messages par
 * appel, ce qui ramene la notification de tout le bureau a une seule.
 */
export async function sendEmailGroupe(env, destinataires, { subject, html, text }) {
  if (!destinataires.length) return { ok: true, envoyes: 0 };

  if (!env.MAILJET_API_KEY || !env.MAILJET_API_SECRET) {
    console.log(`[${destinataires.length} e-mail(s) non envoyé(s) — Mailjet non configuré] ${subject}`);
    return { ok: false, skipped: true, envoyes: 0 };
  }

  let envoyes = 0;
  // Par tranches de 50, la limite de l'API.
  for (let i = 0; i < destinataires.length; i += 50) {
    const tranche = destinataires.slice(i, i + 50);
    const payload = {
      Messages: tranche.map((d) => ({
        From: { Email: env.MAIL_FROM, Name: env.MAIL_FROM_NAME || 'APPS Saussan' },
        To: [{ Email: d.email, Name: d.nom || d.email }],
        Subject: subject,
        TextPart: text,
        HTMLPart: html,
        ReplyTo: { Email: env.CONTACT_EMAIL },
      })),
    };
    try {
      const res = await fetch(MAILJET_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Basic ' + btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) envoyes += tranche.length;
      else console.error('mailjet: envoi groupé refusé', res.status, await res.text());
    } catch (err) {
      console.error('mailjet: erreur réseau sur l’envoi groupé', err);
    }
  }
  return { ok: envoyes > 0, envoyes };
}

/** Previent les membres qu'un article vient de paraitre. */
export function nouvelArticleEmail(env, article, auteurNom) {
  const lien = `${env.SITE_URL}/actualites/${article.slug}`;
  const title = `Nouvel article : ${article.title}`;
  const html = wrap(env, esc(article.title),
    `<p style="margin:0 0 14px;line-height:1.6;">${esc(auteurNom)} vient de publier un article sur le site de l'association.</p>`
    + (article.chapo ? `<p style="margin:0 0 14px;line-height:1.6;color:#5C5348;">${esc(article.chapo)}</p>` : '')
    + button(lien, "Lire l'article")
    + `<p style="font-size:12px;color:#6B6257;margin:18px 0 0;">Vous recevez ce message parce que vous êtes membre de l'APPS.</p>`);
  const text = `${auteurNom} vient de publier un article sur le site de l'association.\n\n${article.title}\n${article.chapo || ''}\n\n${lien}\n\nAPPS — ${env.CONTACT_EMAIL}`;
  return { subject: title, html, text };
}
