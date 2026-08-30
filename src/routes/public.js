// Pages accessibles a tous : accueil, association, evenements, adhesion, contact, mentions.
import { esc, richText, html, redirect, uuid, nowIso, field, isEmail, clientIp,
         formatDateLong, formatRange, parseDate, todayKey, MOIS_COURTS } from '../lib/util.js';
import { page, messagesFlash, LOGO_SVG } from '../lib/layout.js';
import { logAudit } from '../lib/audit.js';
import { sendEmail, contactNotificationEmail } from '../lib/email.js';

export const CATEGORIES = {
  reunion: 'Réunion',
  ecole: 'Vie de l’école',
  vente: 'Vente / collecte',
  fete: 'Fête',
  sortie: 'Sortie',
  autre: 'Autre',
};

export function categorieLabel(c) {
  return CATEGORIES[c] || CATEGORIES.autre;
}

/** Carte d'evenement utilisee sur le site public et dans l'espace membres. */
export function carteEvenement(ev, href, passe = false) {
  const d = parseDate(ev.start_date);
  const balise = href ? 'a' : 'div';
  const attrs = href ? ` href="${esc(href)}"` : '';
  return `<${balise} class="evenement cat-${esc(ev.category)}${passe ? ' evenement--passe' : ''}"${attrs}>
    <div class="pastille-date">
      <span class="pastille-date__jour">${d.getDate()}</span>
      <span class="pastille-date__mois">${esc(MOIS_COURTS[d.getMonth()])}</span>
      <span class="pastille-date__annee">${d.getFullYear()}</span>
    </div>
    <div>
      <h3 class="evenement__titre">${esc(ev.title)}</h3>
      <div class="evenement__meta">
        <span>🕒 ${esc(formatRange(ev))}</span>
        ${ev.location ? `<span>📍 ${esc(ev.location)}</span>` : ''}
        <span class="etiquette etiquette-cat">${esc(categorieLabel(ev.category))}</span>
        ${ev.is_public ? '' : '<span class="etiquette etiquette--gris">🔒 Interne</span>'}
      </div>
      ${ev.description ? `<p class="evenement__desc">${esc(String(ev.description).slice(0, 190))}${String(ev.description).length > 190 ? '…' : ''}</p>` : ''}
    </div>
  </${balise}>`;
}

async function evenementsPublics(env, { limit = 100, passes = false } = {}) {
  const today = todayKey();
  const sql = passes
    ? `SELECT * FROM events WHERE deleted_at IS NULL AND is_public = 1 AND end_date < ?
        ORDER BY start_date DESC LIMIT ?`
    : `SELECT * FROM events WHERE deleted_at IS NULL AND is_public = 1 AND end_date >= ?
        ORDER BY start_date ASC, start_time ASC LIMIT ?`;
  const { results } = await env.DB.prepare(sql).bind(today, limit).all();
  return results || [];
}

// --- Accueil ---------------------------------------------------------

export async function accueil(env, url, user) {
  const prochains = await evenementsPublics(env, { limit: 3 });

  const listeEvenements = prochains.length
    ? `<div class="pile">${prochains.map((e) => carteEvenement(e, `/evenements#ev-${e.id}`)).join('')}</div>`
    : `<div class="vide"><span class="vide__icone">🗓️</span>
        <h3>Rien de prévu pour le moment</h3>
        <p>Le calendrier de l'année se remplit peu à peu. Revenez bientôt&nbsp;!</p></div>`;

  const contenu = `
<section class="hero"><div class="conteneur hero__inner">
  <div>
    <span class="hero__accroche">🎒 Écoles de Saussan · Association loi 1901</span>
    <h1>Des parents qui donnent du temps, des enfants qui <em>en profitent</em>.</h1>
    <p class="hero__texte">L'APPS réunit les parents d'élèves des écoles maternelle et élémentaire de Saussan pour organiser des moments de fête, financer les projets pédagogiques et faire entendre la voix des familles.</p>
    <div class="rang">
      <a class="btn btn--principal" href="/adherer">Rejoindre l'association</a>
      <a class="btn btn--fantome" href="/evenements">Voir les événements</a>
    </div>
  </div>
  <div class="hero__visuel">${LOGO_SVG.replace('class="marque__logo"', '')}</div>
</div></section>

<section class="section section--blanc">
  <div class="conteneur">
    <div class="centre" style="max-width:62ch;margin:0 auto 2.5rem">
      <h2>Ce que nous faisons</h2>
      <p class="muet">Tout ce que l'association organise sert un seul objectif&nbsp;: améliorer le quotidien scolaire des enfants de Saussan.</p>
    </div>
    <div class="grille grille--3">
      <div class="carte">
        <span class="carte-icone">🎉</span>
        <h3 class="carte__titre">Animer la vie de l'école</h3>
        <p class="carte__meta">Kermesse, carnaval, fête de fin d'année, marché de Noël&nbsp;: des rendez-vous qui rassemblent les familles du village.</p>
      </div>
      <div class="carte">
        <span class="carte-icone">💶</span>
        <h3 class="carte__titre">Financer les projets</h3>
        <p class="carte__meta">Les bénéfices de nos actions financent sorties scolaires, spectacles, matériel et classes découvertes.</p>
      </div>
      <div class="carte">
        <span class="carte-icone">🗣️</span>
        <h3 class="carte__titre">Représenter les parents</h3>
        <p class="carte__meta">Nos élus siègent au conseil d'école et portent les questions des familles auprès de l'équipe enseignante et de la mairie.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="titre-page">
      <div><h2>Prochains rendez-vous</h2><p>Les dates ouvertes à toutes les familles.</p></div>
      <a class="btn btn--fantome btn--petit" href="/evenements">Tout l'agenda →</a>
    </div>
    ${listeEvenements}
  </div>
</section>

<section class="section section--jaune">
  <div class="conteneur">
    <div class="grille grille--2" style="align-items:center;gap:2.5rem">
      <div>
        <h2>Donner un coup de main, même une heure</h2>
        <p>Pas besoin d'être disponible toute l'année. Tenir un stand une matinée, préparer des gâteaux, prêter une table&nbsp;: chaque contribution compte, et c'est aussi une bonne façon de rencontrer les autres parents.</p>
        <div class="rang" style="margin-top:1.25rem">
          <a class="btn btn--principal" href="/adherer#adhesion">Adhérer en ligne</a>
          <a class="btn btn--fantome" href="/contact">Poser une question</a>
        </div>
      </div>
      <div class="chiffres">
        <div class="chiffre"><div class="chiffre__valeur">2</div><div class="chiffre__label">écoles soutenues</div></div>
        <div class="chiffre"><div class="chiffre__valeur">1901</div><div class="chiffre__label">association loi 1901</div></div>
        <div class="chiffre"><div class="chiffre__valeur">100%</div><div class="chiffre__label">bénévole</div></div>
      </div>
    </div>
  </div>
</section>`;

  return html(page({
    titre: 'Accueil',
    description: "Association des Parents des Pitchouns Saussannais : événements, projets et vie des écoles de Saussan (34570).",
    contenu, user, chemin: '/', env,
  }));
}

// --- L'association ---------------------------------------------------

export async function association(env, url, user) {
  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › L'association</p>
  <h1>L'association</h1>
  <p class="hero__texte" style="max-width:none">L'APPS — Association des Parents des Pitchouns Saussannais — regroupe les parents d'élèves bénévoles des écoles maternelle et élémentaire de Saussan.</p>

  <div class="carte" style="margin:2rem 0">
    <h2 style="font-size:1.35rem">Notre rôle</h2>
    <p>L'association poursuit trois missions complémentaires&nbsp;:</p>
    <ul>
      <li><strong>Organiser</strong> des événements conviviaux tout au long de l'année scolaire, ouverts à toutes les familles du village.</li>
      <li><strong>Financer</strong>, grâce aux bénéfices de ces actions, les projets proposés par les équipes enseignantes&nbsp;: sorties, spectacles, matériel pédagogique, voyages scolaires.</li>
      <li><strong>Représenter</strong> les parents auprès de l'école et de la municipalité, notamment au sein du conseil d'école.</li>
    </ul>
  </div>

  <h2>Le bureau</h2>
  <p class="muet">Élu chaque année en assemblée générale, le bureau assure le fonctionnement quotidien de l'association.</p>
  <div class="grille grille--3" style="margin:1.25rem 0 2rem">
    <div class="carte carte--serre"><h3 style="font-size:1.05rem;margin-bottom:.15rem">Présidence</h3><p class="carte__meta">Représente l'association et coordonne les actions.</p></div>
    <div class="carte carte--serre"><h3 style="font-size:1.05rem;margin-bottom:.15rem">Trésorerie</h3><p class="carte__meta">Suit les comptes et présente le bilan financier annuel.</p></div>
    <div class="carte carte--serre"><h3 style="font-size:1.05rem;margin-bottom:.15rem">Secrétariat</h3><p class="carte__meta">Rédige les comptes rendus et gère les adhésions.</p></div>
  </div>

  <div class="encart">
    <strong>Assemblée générale.</strong> Elle se tient chaque année en début d'année scolaire. Tous les parents adhérents y sont conviés&nbsp;: c'est le moment de faire le bilan, de voter le budget et d'élire le nouveau bureau.
  </div>

  <h2 style="margin-top:2.5rem">Nous trouver</h2>
  <div class="carte">
    <ul class="detail-liste">
      <li><span class="cle">Adresse</span><span>Centre Socio-culturel — Place de la Fontaine, 34570 Saussan</span></li>
      <li><span class="cle">E-mail</span><span><a href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a></span></li>
      <li><span class="cle">Statut</span><span>Association loi 1901, sans but lucratif</span></li>
    </ul>
  </div>
</div></section>`;

  return html(page({
    titre: "L'association",
    description: "Missions, bureau et fonctionnement de l'Association des Parents des Pitchouns Saussannais.",
    contenu, user, chemin: '/association', env,
  }));
}

// --- Evenements ------------------------------------------------------

export async function evenements(env, url, user) {
  const aVenir = await evenementsPublics(env, { limit: 60 });
  const passes = await evenementsPublics(env, { limit: 12, passes: true });

  const bloc = (liste, passe) => liste.length
    ? `<div class="pile">${liste.map((e) => `<div id="ev-${esc(e.id)}">${carteEvenement(e, null, passe)}</div>`).join('')}</div>`
    : `<div class="vide"><span class="vide__icone">🗓️</span><h3>Aucun événement</h3>
       <p>${passe ? "L'historique se remplira au fil de l'année." : 'Le programme sera publié prochainement.'}</p></div>`;

  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › Événements</p>
  <div class="titre-page">
    <div><h1>Événements</h1><p>Tous les rendez-vous ouverts aux familles.</p></div>
  </div>
  ${bloc(aVenir, false)}

  ${passes.length ? `<h2 style="margin-top:3rem">Déjà passés</h2>${bloc(passes, true)}` : ''}

  <div class="encart" style="margin-top:2.5rem">
    Vous êtes membre de l'association&nbsp;? Le <a href="/espace">calendrier interne</a> contient également les réunions et dates de préparation.
  </div>
</div></section>`;

  return html(page({
    titre: 'Événements',
    description: 'Agenda des événements de l’APPS : kermesse, marché de Noël, carnaval et rendez-vous des écoles de Saussan.',
    contenu, user, chemin: '/evenements', env,
  }));
}

// --- Adhérer ---------------------------------------------------------

export async function adherer(env, url, user) {
  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › Nous rejoindre</p>
  <h1>Nous rejoindre</h1>
  <p class="hero__texte" style="max-width:none">Tous les parents d'élèves des écoles de Saussan peuvent adhérer à l'APPS. Aucune compétence particulière n'est requise&nbsp;: seulement l'envie de participer.</p>

  <div class="grille grille--3" style="margin:2rem 0">
    <div class="carte"><span class="carte-icone">1️⃣</span><h3 class="carte__titre">Adhérez en ligne</h3><p class="carte__meta">Quelques minutes suffisent, directement sur cette page via HelloAsso.</p></div>
    <div class="carte"><span class="carte-icone">2️⃣</span><h3 class="carte__titre">Recevez votre reçu</h3><p class="carte__meta">HelloAsso vous envoie automatiquement une confirmation par e-mail.</p></div>
    <div class="carte"><span class="carte-icone">3️⃣</span><h3 class="carte__titre">Participez</h3><p class="carte__meta">Selon vos disponibilités&nbsp;: une réunion, un stand, un coup de main ponctuel.</p></div>
  </div>

  <h2 id="adhesion">Adhérer en ligne</h2>
  <p class="muet">L'adhésion pour l'année scolaire 2026-2027 se fait via HelloAsso, notre plateforme de paiement sécurisée. Le formulaire ci-dessous est hébergé par HelloAsso&nbsp;: aucune coordonnée bancaire ne transite par ce site.</p>

  <div class="widget-helloasso">
    <iframe id="haWidget"
            title="Formulaire d'adhésion HelloAsso — APPS Saussan"
            allowtransparency="true"
            scrolling="auto"
            loading="lazy"
            src="https://www.helloasso.com/associations/association-des-parents-des-pitchouns-saussannais/adhesions/adhesion-2026-2027/widget"></iframe>
  </div>
  <p class="petit muet">Le formulaire ne s'affiche pas&nbsp;? <a href="https://www.helloasso.com/associations/association-des-parents-des-pitchouns-saussannais/adhesions/adhesion-2026-2027" target="_blank" rel="noopener noreferrer">Ouvrir la page d'adhésion sur HelloAsso</a>.</p>

  <div class="carte" style="margin-top:2.5rem">
    <h2 style="font-size:1.35rem">Les bonnes raisons de venir</h2>
    <ul>
      <li>Rencontrer les autres parents du village dans un cadre convivial.</li>
      <li>Savoir concrètement à quoi servent les fonds récoltés.</li>
      <li>Faire remonter les questions des familles au conseil d'école.</li>
      <li>Donner du temps quand vous en avez, sans engagement de calendrier.</li>
    </ul>
    <div class="rang" style="margin-top:1.25rem">
      <a class="btn btn--principal" href="/contact">Nous écrire</a>
      <a class="btn btn--fantome" href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a>
    </div>
  </div>
</div></section>
<script>
// HelloAsso publie la hauteur reelle de son formulaire : on ajuste l'iframe en consequence.
(function () {
  var cadre = document.getElementById('haWidget');
  if (!cadre) return;
  window.addEventListener('message', function (e) {
    // On n'accepte la consigne de redimensionnement que si elle vient bien de HelloAsso.
    if (e.origin !== 'https://www.helloasso.com' && !/\\.helloasso\\.com$/.test(e.origin)) return;
    var hauteur = parseFloat(e.data && e.data.height);
    if (hauteur && hauteur > parseFloat(cadre.style.height || 0)) {
      cadre.style.height = hauteur + 'px';
    }
  });
})();
</script>`;

  return html(page({
    titre: 'Nous rejoindre',
    description: "Comment adhérer à l'APPS et participer à la vie des écoles de Saussan.",
    contenu, user, chemin: '/adherer', env,
  }));
}

// --- Contact ---------------------------------------------------------

export function contact(env, url, user, erreurs = null, valeurs = {}) {
  const v = (k) => esc(valeurs[k] || '');
  const err = erreurs
    ? `<div class="message message--erreur"><span class="message__icone">⚠️</span><span>${esc(erreurs)}</span></div>`
    : '';

  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › Contact</p>
  <h1>Nous écrire</h1>
  <p class="muet">Une question sur l'association, un événement, une adhésion&nbsp;? Écrivez-nous, nous répondons sous quelques jours.</p>

  <div class="grille" style="grid-template-columns:1.4fr .9fr;gap:2rem;margin-top:2rem;align-items:start">
    <div class="carte">
      ${messagesFlash(url)}${err}
      <form method="post" action="/contact">
        <div class="duo">
          <div class="champ">
            <label class="champ__label" for="name">Votre nom <span class="champ__requis">*</span></label>
            <input type="text" id="name" name="name" required maxlength="80" value="${v('name')}" autocomplete="name">
          </div>
          <div class="champ">
            <label class="champ__label" for="email">Votre e-mail <span class="champ__requis">*</span></label>
            <input type="email" id="email" name="email" required maxlength="150" value="${v('email')}" autocomplete="email">
          </div>
        </div>
        <div class="champ">
          <label class="champ__label" for="subject">Sujet</label>
          <input type="text" id="subject" name="subject" maxlength="120" value="${v('subject')}">
        </div>
        <div class="champ">
          <label class="champ__label" for="body">Votre message <span class="champ__requis">*</span></label>
          <textarea id="body" name="body" required maxlength="4000" rows="7">${v('body')}</textarea>
        </div>
        <div class="champ" style="position:absolute;left:-9999px" aria-hidden="true">
          <label for="site">Ne pas remplir</label>
          <input type="text" id="site" name="site" tabindex="-1" autocomplete="off">
        </div>
        <button class="btn btn--principal btn--bloc" type="submit">Envoyer le message</button>
        <p class="champ__aide" style="margin-top:.75rem">Vos coordonnées servent uniquement à vous répondre et ne sont jamais transmises à des tiers.</p>
      </form>
    </div>
    <div class="pile">
      <div class="carte carte--serre">
        <h3 style="font-size:1.05rem">Par e-mail</h3>
        <p class="carte__meta"><a href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a></p>
      </div>
      <div class="carte carte--serre">
        <h3 style="font-size:1.05rem">Par courrier</h3>
        <p class="carte__meta">APPS<br>Centre Socio-culturel<br>Place de la Fontaine<br>34570 Saussan</p>
      </div>
    </div>
  </div>
</div></section>
<style>@media(max-width:820px){main .grille[style*="1.4fr"]{grid-template-columns:1fr!important}}</style>`;

  return html(page({
    titre: 'Contact',
    description: "Contacter l'Association des Parents des Pitchouns Saussannais.",
    contenu, user, chemin: '/contact', env,
  }));
}

export async function contactPost(env, request, url, user) {
  const form = await request.formData();

  // Piege a robots : un champ invisible qui ne doit jamais etre rempli.
  if (field(form, 'site')) return redirect('/contact?ok=message-envoye');

  const valeurs = {
    name: field(form, 'name', 80),
    email: field(form, 'email', 150),
    subject: field(form, 'subject', 120),
    body: field(form, 'body', 4000),
  };

  if (!valeurs.name || !valeurs.body) return contact(env, url, user, 'Merci de renseigner votre nom et votre message.', valeurs);
  if (!isEmail(valeurs.email)) return contact(env, url, user, "L'adresse e-mail saisie n'est pas valide.", valeurs);

  const id = uuid();
  await env.DB.prepare(
    'INSERT INTO messages (id, name, email, subject, body, created_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, valeurs.name, valeurs.email, valeurs.subject, valeurs.body, nowIso(), clientIp(request)).run();

  await logAudit(env, request, {
    action: 'message.recu', entityType: 'message', entityId: id,
    entityLabel: `${valeurs.name} — ${valeurs.subject || 'sans sujet'}`,
    actorEmail: valeurs.email,
  });

  const mail = contactNotificationEmail(env, valeurs);
  await sendEmail(env, { to: env.CONTACT_EMAIL, toName: 'APPS', ...mail });

  return redirect('/contact?ok=message-envoye');
}

// --- Pages légales ---------------------------------------------------

export function mentionsLegales(env, url, user) {
  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › Mentions légales</p>
  <h1>Mentions légales</h1>

  <h2>Éditeur du site</h2>
  <p>APPS — Association des Parents des Pitchouns Saussannais<br>
  Association régie par la loi du 1<sup>er</sup> juillet 1901<br>
  Centre Socio-culturel, Place de la Fontaine, 34570 Saussan<br>
  Courriel&nbsp;: <a href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a></p>
  <p class="petit muet">Directeur de la publication&nbsp;: le président ou la présidente de l'association en exercice.</p>

  <h2>Hébergement</h2>
  <p>Le site est hébergé par Cloudflare, Inc. — 101 Townsend St, San Francisco, CA 94107, États-Unis.</p>

  <h2>Propriété intellectuelle</h2>
  <p>Le logo et les contenus publiés sur ce site sont la propriété de l'association. Toute reproduction sans autorisation préalable est interdite.</p>

  <h2>Photographies</h2>
  <p>Aucune photographie d'enfant n'est publiée sans l'accord écrit préalable des représentants légaux. Pour demander le retrait d'un contenu, écrivez à <a href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a>.</p>
</div></section>`;
  return html(page({ titre: 'Mentions légales', contenu, user, chemin: '/mentions-legales', env }));
}

export function confidentialite(env, url, user) {
  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › Confidentialité</p>
  <h1>Protection des données</h1>
  <p class="muet">Cette page décrit les données personnelles traitées par le site de l'APPS et les droits dont vous disposez.</p>

  <h2>Données collectées</h2>
  <ul>
    <li><strong>Formulaire de contact</strong>&nbsp;: nom, adresse e-mail, message et adresse IP. Ces données servent uniquement à vous répondre.</li>
    <li><strong>Comptes de l'espace membres</strong>&nbsp;: nom, prénom, adresse e-mail, éventuellement un numéro de téléphone. Le mot de passe n'est jamais stocké en clair.</li>
    <li><strong>Journal d'activité</strong>&nbsp;: pour chaque action réalisée dans l'espace membres, l'association conserve l'auteur, la date, l'action et l'adresse IP, à des fins de traçabilité et de sécurité.</li>
  </ul>

  <h2>Cookies</h2>
  <p>Le site dépose un unique cookie technique, <code>apps_session</code>, lorsque vous vous connectez à l'espace membres. Il permet de maintenir votre session et expire au bout de 30 jours. Aucun cookie publicitaire ni outil de mesure d'audience tiers n'est utilisé.</p>

  <h2>Durée de conservation</h2>
  <ul>
    <li>Messages de contact&nbsp;: 12 mois.</li>
    <li>Comptes membres&nbsp;: le temps de l'appartenance à l'association, puis suppression sur demande.</li>
    <li>Journal d'activité&nbsp;: 24 mois.</li>
  </ul>

  <h2>Vos droits</h2>
  <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition sur vos données. Pour l'exercer, écrivez à <a href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a>. Vous pouvez également introduire une réclamation auprès de la CNIL.</p>
</div></section>`;
  return html(page({ titre: 'Confidentialité', contenu, user, chemin: '/confidentialite', env }));
}

export function page404(env, url, user) {
  const contenu = `
<section class="section"><div class="conteneur conteneur--etroit centre" style="padding:3rem 0">
  <div style="font-size:4rem">🎒</div>
  <h1>Page introuvable</h1>
  <p class="muet">Cette page n'existe pas ou plus. Elle a peut-être été rangée dans le mauvais cartable.</p>
  <div class="rang" style="justify-content:center;margin-top:1.5rem">
    <a class="btn btn--principal" href="/">Retour à l'accueil</a>
    <a class="btn btn--fantome" href="/evenements">Voir les événements</a>
  </div>
</div></section>`;
  return html(page({ titre: 'Page introuvable', contenu, user, chemin: url.pathname, env }), { status: 404 });
}
