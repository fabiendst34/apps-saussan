// Gabarits HTML : squelette de page, en-tetes de navigation, pied de page.
import { esc, fullName, initials } from './util.js';
import { icone } from './icones.js';
import { urlAbsolue as absolu } from './seo.js';

/** Icone inline du logo (evite une requete reseau supplementaire). */
export const LOGO_SVG = `<svg class="marque__logo" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
  <rect x="27" y="4" width="15" height="20" rx="5" fill="#F2A93B"/>
  <rect x="78" y="4" width="15" height="20" rx="5" fill="#F2A93B"/>
  <rect x="8" y="16" width="104" height="88" rx="18" fill="#F2A93B"/>
  <g fill="none" stroke="#1D1B19" stroke-width="7" stroke-linecap="round">
    <path d="M32 58 Q42 44 52 58"/><path d="M68 58 Q78 44 88 58"/>
  </g>
  <rect x="22" y="86" width="20" height="24" rx="5" fill="#FFFFFF"/>
  <rect x="78" y="86" width="20" height="24" rx="5" fill="#FFFFFF"/>
</svg>`;

const NAV_PUBLIQUE = [
  ['/', 'Accueil'],
  ['/association', "L'association"],
  ['/actualites', 'Actualités'],
  ['/evenements', 'Événements'],
  ['/adherer', 'Nous rejoindre'],
  ['/contact', 'Contact'],
];

const NAV_ESPACE = [
  ['/espace', 'Calendrier'],
  ['/espace/evenements', 'Événements'],
  ['/espace/articles', 'Articles'],
  ['/espace/journal', 'Mon activité'],
  ['/espace/compte', 'Mon compte'],
];

const NAV_ADMIN = [
  ['/admin', 'Tableau de bord'],
  ['/admin/comptes', 'Comptes'],
  ['/admin/journal', "Journal d'audit"],
  ['/admin/messages', 'Messages'],
];

function navLinks(items, chemin) {
  return items.map(([href, label]) => {
    const actif = href === '/' || href === '/espace' || href === '/admin'
      ? chemin === href
      : chemin === href || chemin.startsWith(href + '/');
    return `<a href="${href}"${actif ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  }).join('');
}

/** Bandeau de navigation du site public. */
function entetePublique(chemin, user) {
  const lienEspace = user
    ? `<a class="btn btn--jaune btn--petit" href="/espace">Mon espace</a>`
    : `<a class="btn btn--principal btn--petit" href="/espace/connexion">Espace membres</a>`;
  return `<header class="entete"><div class="conteneur entete__inner">
    <a class="marque" href="/">${LOGO_SVG}
      <span><span class="marque__nom">APPS</span>
      <span class="marque__sous">Association des Parents des Pitchouns Saussannais</span></span>
    </a>
    <button class="nav-bascule" type="button" aria-expanded="false" aria-controls="nav-principale" aria-label="Ouvrir le menu">${icone('menu', { taille: 22 })}</button>
    <nav class="nav" id="nav-principale" aria-label="Navigation principale">
      ${navLinks(NAV_PUBLIQUE, chemin)}${lienEspace}
    </nav>
  </div></header>`;
}

/** Barre sombre de l'espace membres, sous l'en-tete publique. */
function barreEspace(chemin, user) {
  const admin = user.role === 'admin'
    ? `<a class="barre-espace__admin" href="/admin"${chemin.startsWith('/admin') ? ' aria-current="page"' : ''}>${icone('reglages', { taille: 16 })} Administration</a>`
    : '';
  const items = chemin.startsWith('/admin') ? NAV_ADMIN : NAV_ESPACE;
  const retour = chemin.startsWith('/admin')
    ? `<a class="barre-espace__retour" href="/espace">${icone('fleche_gauche', { taille: 16 })} Espace membres</a>`
    : '';
  return `<div class="barre-espace"><div class="conteneur barre-espace__inner">
    ${retour}${navLinks(items, chemin)}${chemin.startsWith('/admin') ? '' : admin}
    <div class="barre-espace__user">
      <span class="jeton" aria-hidden="true">${esc(initials(user))}</span>
      <span>${esc(fullName(user))}</span>
      <form method="post" action="/espace/deconnexion" class="forme-inline">
        <button class="btn btn--petit barre-espace__sortie" type="submit">
          ${icone('deconnexion', { taille: 16 })}<span>Se déconnecter</span>
        </button>
      </form>
    </div>
  </div></div>`;
}

function pied(env) {
  const annee = new Date().getFullYear();
  return `<footer class="pied"><div class="conteneur">
    <div class="pied__grille">
      <div>
        <h4>APPS</h4>
        <p class="petit" style="color:#B8B1A6;max-width:42ch">Association des Parents des Pitchouns Saussannais — parents bénévoles au service des enfants des écoles maternelle et élémentaire de Saussan.</p>
      </div>
      <div>
        <h4>Le site</h4>
        <ul class="pied__liens">
          <li><a href="/">Accueil</a></li>
          <li><a href="/association">L'association</a></li>
          <li><a href="/actualites">Actualités</a></li>
          <li><a href="/evenements">Événements</a></li>
          <li><a href="/adherer">Nous rejoindre</a></li>
          <li><a href="/espace/connexion">Espace membres</a></li>
        </ul>
      </div>
      <div>
        <h4>Nous écrire</h4>
        <ul class="pied__liens">
          <li><a href="mailto:${esc(env.CONTACT_EMAIL)}">${esc(env.CONTACT_EMAIL)}</a></li>
          <li style="color:#B8B1A6">Centre Socio-culturel<br>Place de la Fontaine<br>34570 Saussan</li>
        </ul>
      </div>
    </div>
    <div class="pied__bas">
      <span>© ${annee} APPS — Association loi 1901</span>
      <span><a href="/mentions-legales">Mentions légales</a> · <a href="/confidentialite">Confidentialité</a></span>
    </div>
  </div></footer>`;
}

const SCRIPT_MENU = `<script>
(function(){
  var b=document.querySelector('.nav-bascule'),n=document.getElementById('nav-principale');
  if(!b||!n)return;
  function fermer(){n.hidden=true;b.setAttribute('aria-expanded','false');}
  function ouvrir(){n.hidden=false;b.setAttribute('aria-expanded','true');}
  var mq=window.matchMedia('(max-width:900px)');
  function sync(){ mq.matches?fermer():(n.hidden=false); }
  sync(); mq.addEventListener('change',sync);
  b.addEventListener('click',function(){ n.hidden?ouvrir():fermer(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&mq.matches)fermer(); });
})();
document.addEventListener('submit',function(e){
  var f=e.target.closest('form[data-confirmer]');
  if(f&&!confirm(f.getAttribute('data-confirmer'))){ e.preventDefault(); return; }
  var b=e.target.querySelector('button[type=submit]');
  if(b&&!b.dataset.garder){ setTimeout(function(){ b.disabled=true; b.textContent='Un instant…'; },0); }
});
</script>`;

/**
 * Construit une page complete.
 * @param {object} o
 * @param {string} o.titre        titre de l'onglet (sans le suffixe du site)
 * @param {string} [o.titreComplet] remplace entierement le titre, suffixe compris
 * @param {string} [o.canonique]  chemin canonique de la page ; sans lui, pas de balise
 * @param {string} [o.jsonLd]     balise <script> de donnees structurees
 * @param {string} [o.description] meta description
 * @param {string} o.contenu      HTML du <main>
 * @param {'public'|'espace'|'nu'} [o.variante]
 * @param {object} [o.user]       utilisateur connecte
 * @param {string} o.chemin       chemin courant, pour l'etat actif de la navigation
 * @param {object} o.env
 * @param {string} [o.classeMain]
 */
export function page(o) {
  const { titre, titreComplet = '', description = '', contenu, variante = 'public',
          user = null, chemin = '/', env, classeMain = '', canonique = '', jsonLd = '' } = o;

  // L'espace membres et l'administration ne sont jamais indexables, meme
  // quand le site public l'est : leurs pages n'ont rien a faire dans un
  // moteur de recherche, et robots.txt ne suffit pas a les en sortir.
  const prive = chemin.startsWith('/espace') || chemin.startsWith('/admin');
  const indexable = env.ALLOW_INDEXING === 'true' && !prive;
  const titrePage = titreComplet || `${titre} · APPS Saussan`;
  const adresse = canonique && indexable ? absolu(env, canonique) : '';
  const entete = variante === 'nu' ? '' : entetePublique(chemin, user);
  const barre = variante === 'espace' && user ? barreEspace(chemin, user) : '';
  const basDePage = variante === 'nu' ? '' : pied(env);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titrePage)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
${indexable ? '' : '<meta name="robots" content="noindex, nofollow">'}
${adresse ? `<link rel="canonical" href="${esc(adresse)}">` : ''}
${adresse ? `<meta property="og:type" content="website">
<meta property="og:site_name" content="APPS Saussan">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(adresse)}">
<meta property="og:title" content="${esc(titrePage)}">${description ? `
<meta property="og:description" content="${esc(description)}">` : ''}
<meta property="og:image" content="${esc(absolu(env, '/logo-apps.svg'))}">
<meta name="twitter:card" content="summary">` : ''}
<meta name="theme-color" content="#F2A93B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/polices/nunito-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/polices/baloo2-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/polices.css">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/styles-app.css">
${jsonLd}
</head>
<body class="page">
<a class="saut-contenu" href="#contenu">Aller au contenu</a>
${entete}${barre}
<main id="contenu"${classeMain ? ` class="${classeMain}"` : ''}>${contenu}</main>
${basDePage}
${SCRIPT_MENU}
</body>
</html>`;
}

/** Bandeau de notification issu des parametres ?ok= / ?err= / ?info=. */
export function messagesFlash(url) {
  const out = [];
  const ok = url.searchParams.get('ok');
  const err = url.searchParams.get('err');
  const info = url.searchParams.get('info');
  if (ok) out.push(bandeau('succes', FLASH[ok] || ok));
  if (err) out.push(bandeau('erreur', FLASH[err] || err));
  if (info) out.push(bandeau('info', FLASH[info] || info));
  return out.join('');
}

/** Bandeau de notification. Le type choisit l'icone et le ton. */
export function bandeau(type, texte) {
  const icones = { succes: 'coche', erreur: 'alerte', info: 'info', alerte: 'alerte' };
  return `<div class="message message--${type}" role="${type === 'erreur' ? 'alert' : 'status'}">`
    + `${icone(icones[type] || 'info', { taille: 20, classe: 'message__icone' })}`
    + `<span>${esc(texte)}</span></div>`;
}

/** Messages courts referances par cle, pour ne pas les passer en clair dans l'URL. */
export const FLASH = {
  'event-cree': "L'événement a bien été créé.",
  'event-modifie': "L'événement a bien été modifié.",
  'event-supprime': "L'événement a été supprimé.",
  'event-restaure': "L'événement a été restauré.",
  'article-cree': "L'article a été enregistré comme brouillon.",
  'article-publie': "L'article est publié : il est visible sur le site.",
  'article-modifie': "L'article a bien été modifié.",
  'article-supprime': "L'article a été supprimé du site.",
  'article-restaure': "L'article a été restauré.",
  'article-annonce': "L'article est publié et les membres viennent d'en être informés par e-mail.",
  'compte-cree': 'Le compte a été créé et l’e-mail d’activation envoyé.',
  'compte-cree-sans-envoi': 'Le compte a été créé. Aucun e-mail d’activation n’a encore été envoyé.',
  'compte-cree-sans-mail': "Le compte a été créé, mais l'e-mail d'activation n'a pas pu être envoyé. Utilisez le bouton « Renvoyer l’invitation ».",
  'compte-modifie': 'Le compte a été mis à jour.',
  'compte-supprime': 'Le compte a été supprimé.',
  'invitation-envoyee': "L'e-mail d'activation a été renvoyé.",
  'reinit-envoyee': "L'e-mail de réinitialisation a été envoyé.",
  'sessions-revoquees': 'Toutes les sessions de ce compte ont été fermées.',
  'profil-modifie': 'Votre profil a été mis à jour.',
  'mdp-modifie': 'Votre mot de passe a été modifié.',
  'compte-active': 'Votre compte est activé, vous pouvez vous connecter.',
  'mdp-reinitialise': 'Votre mot de passe a été réinitialisé, vous pouvez vous connecter.',
  'deconnecte': 'Vous avez été déconnecté.',
  'message-envoye': 'Votre message a bien été envoyé, merci ! Nous vous répondrons rapidement.',
  'message-supprime': 'Le message a été supprimé.',
  'lien-invalide': "Ce lien n'est plus valable. Demandez-en un nouveau.",
  'acces-refuse': "Vous n'avez pas les droits nécessaires pour accéder à cette page.",
  'session-expiree': 'Votre session a expiré, merci de vous reconnecter.',
  'csrf': 'Le formulaire a expiré. Merci de recommencer.',
  'introuvable': 'Élément introuvable.',
};
