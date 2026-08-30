// Articles « À la une » : redaction cote membres, lecture cote public.
import {
  esc, html, redirect, uuid, nowIso, field, slugifier, texteArticle,
  formatDateLong, formatDateShort, formatDateTime, fullName,
} from '../lib/util.js';
import { page, messagesFlash, bandeau } from '../lib/layout.js';
import { icone } from '../lib/icones.js';
import { logAudit, diff } from '../lib/audit.js';
import { checkCsrf } from '../lib/auth.js';
import {
  enregistrerImage, supprimerImage, urlImage, typeAccepte, tailleLisible, TAILLE_MAX,
} from '../lib/medias.js';
import { csrfInput, ligneAudit } from './espace.js';

const CHAMPS_AUDITES = ['title', 'chapo', 'body', 'status', 'is_featured', 'image_alt', 'image_id'];

/** Auteur lisible, meme si le compte a ete supprime depuis. */
function auteur(a) {
  const nom = `${a.a_prenom || ''} ${a.a_nom || ''}`.trim();
  return nom || a.a_email || 'compte supprimé';
}

// =====================================================================
//  Vues partagees
// =====================================================================

/** Carte d'article : accueil, liste publique, espace membres. */
export function carteArticle(a, { href, grande = false } = {}) {
  const lien = href || `/actualites/${a.slug}`;
  const image = a.image_id
    ? `<img class="article-carte__image" src="${esc(urlImage(a.image_id))}" alt="${esc(a.image_alt)}"
         loading="lazy" width="640" height="360">`
    : `<div class="article-carte__image article-carte__image--vide">${icone('cartable', { taille: 40 })}</div>`;

  return `<a class="article-carte${grande ? ' article-carte--grande' : ''}" href="${esc(lien)}">
    ${image}
    <div class="article-carte__corps">
      <p class="article-carte__date">${esc(formatDateShort((a.published_at || a.created_at).slice(0, 10)))}</p>
      <h3 class="article-carte__titre">${esc(a.title)}</h3>
      ${a.chapo ? `<p class="article-carte__chapo">${esc(a.chapo)}</p>` : ''}
      <span class="lien-fleche">Lire la suite ${icone('fleche_longue', { taille: 17 })}</span>
    </div>
  </a>`;
}

/** Les articles publies, du plus recent au plus ancien. */
export async function articlesPublies(env, { limit = 20, alaune = false } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM articles
      WHERE deleted_at IS NULL AND status = 'publie'${alaune ? ' AND is_featured = 1' : ''}
      ORDER BY published_at DESC, created_at DESC LIMIT ?`
  ).bind(limit).all();
  return results || [];
}

/**
 * Section « À la une » de la page d'accueil.
 * Les articles marques a la une passent devant ; a defaut, les plus recents.
 */
export async function sectionALaUne(env) {
  let articles = await articlesPublies(env, { limit: 3, alaune: true });
  if (articles.length === 0) articles = await articlesPublies(env, { limit: 3 });
  if (articles.length === 0) return '';

  const [premier, ...suivants] = articles;

  return `
<section class="section section--blanc">
  <div class="conteneur">
    <div class="titre-page">
      <div><h2>À la une</h2><p>Les nouvelles de l'association et des écoles.</p></div>
      <a class="lien-fleche" href="/actualites">Toutes les actualités ${icone('fleche_longue', { taille: 18 })}</a>
    </div>
    <div class="alaune${suivants.length ? '' : ' alaune--seul'}">
      ${carteArticle(premier, { grande: true })}
      ${suivants.length ? `<div class="alaune__cote">${suivants.map((a) => carteArticle(a)).join('')}</div>` : ''}
    </div>
  </div>
</section>`;
}

// =====================================================================
//  Site public
// =====================================================================

export async function actualites(env, url, user) {
  const articles = await articlesPublies(env, { limit: 40 });

  const contenu = `
<section class="section"><div class="conteneur">
  <p class="fil"><a href="/">Accueil</a> › Actualités</p>
  <div class="titre-page">
    <div><h1>Actualités</h1><p>Les nouvelles de l'association et des écoles de Saussan.</p></div>
  </div>
  ${articles.length
    ? `<div class="grille-articles">${articles.map((a) => carteArticle(a)).join('')}</div>`
    : `<div class="vide">${icone('journal', { taille: 34, classe: 'vide__icone' })}
       <h3>Aucune actualité pour le moment</h3>
       <p>Les premières nouvelles seront publiées prochainement.</p></div>`}
</div></section>`;

  return html(page({
    titre: 'Actualités',
    description: "Les actualités de l'Association des Parents des Pitchouns Saussannais.",
    contenu, user, chemin: '/actualites', env,
  }));
}

export async function articlePublic(env, url, user, slug) {
  const a = await env.DB.prepare(
    `SELECT ar.*, u.first_name AS a_prenom, u.last_name AS a_nom, u.email AS a_email
       FROM articles ar LEFT JOIN users u ON u.id = ar.created_by
      WHERE ar.slug = ? AND ar.deleted_at IS NULL AND ar.status = 'publie'`
  ).bind(slug).first();
  if (!a) return null;

  const autres = (await articlesPublies(env, { limit: 4 })).filter((x) => x.id !== a.id).slice(0, 3);
  const dateAffichee = (a.published_at || a.created_at).slice(0, 10);

  const contenu = `
<article class="section"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/">Accueil</a> › <a href="/actualites">Actualités</a></p>
  <h1 class="article__titre">${esc(a.title)}</h1>
  <p class="article__signature">
    ${icone('calendrier', { taille: 16 })}<span>Publié le ${esc(formatDateLong(dateAffichee, { majuscule: false }))}</span>
    <span class="article__auteur">par ${esc(auteur(a))}</span>
  </p>
  ${a.chapo ? `<p class="chapo">${esc(a.chapo)}</p>` : ''}
</div>

${a.image_id ? `<div class="conteneur"><figure class="article__figure">
  <img src="${esc(urlImage(a.image_id))}" alt="${esc(a.image_alt)}" width="1200" height="675">
  ${a.image_alt ? `<figcaption>${esc(a.image_alt)}</figcaption>` : ''}
</figure></div>` : ''}

<div class="conteneur conteneur--etroit">
  <div class="article__corps">${texteArticle(a.body)}</div>

  <p style="margin-top:2.5rem"><a class="lien-fleche" href="/actualites">
    ${icone('fleche_gauche', { taille: 17 })} Toutes les actualités</a></p>
</div>

${autres.length ? `<div class="conteneur" style="margin-top:3.5rem">
  <h2 style="margin-bottom:1.5rem">À lire aussi</h2>
  <div class="grille-articles">${autres.map((x) => carteArticle(x)).join('')}</div>
</div>` : ''}
</article>`;

  return html(page({
    titre: a.title,
    description: a.chapo || `${a.title} — actualités de l'APPS Saussan.`,
    contenu, user, chemin: '/actualites', env,
  }));
}

// =====================================================================
//  Espace membres : liste
// =====================================================================

export async function listeArticles(env, url, user) {
  const filtre = url.searchParams.get('f') || 'tous';
  let where = 'ar.deleted_at IS NULL';
  if (filtre === 'brouillons') where += " AND ar.status = 'brouillon'";
  if (filtre === 'publies') where += " AND ar.status = 'publie'";
  if (filtre === 'supprimes') where = 'ar.deleted_at IS NOT NULL';

  const { results } = await env.DB.prepare(
    `SELECT ar.*, u.first_name AS a_prenom, u.last_name AS a_nom, u.email AS a_email
       FROM articles ar LEFT JOIN users u ON u.id = ar.created_by
      WHERE ${where}
      ORDER BY COALESCE(ar.published_at, ar.updated_at) DESC LIMIT 200`
  ).all();

  const onglet = (cle, label) =>
    `<a class="btn btn--petit ${filtre === cle ? 'btn--principal' : 'btn--fantome'}" href="/espace/articles?f=${cle}">${label}</a>`;

  const lignes = (results || []).map((a) => `
    <tr>
      <td>
        <div class="rang" style="gap:.75rem;flex-wrap:nowrap">
          ${a.image_id
            ? `<img class="vignette" src="${esc(urlImage(a.image_id))}" alt="" width="56" height="42" loading="lazy">`
            : `<span class="vignette vignette--vide">${icone('cartable', { taille: 18 })}</span>`}
          <div>
            <a href="/espace/articles/${esc(a.id)}" style="font-weight:800;color:var(--noir);text-decoration:none">${esc(a.title)}</a>
            ${a.chapo ? `<div class="petit muet">${esc(a.chapo.slice(0, 90))}${a.chapo.length > 90 ? '…' : ''}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="serre">${a.status === 'publie'
        ? '<span class="etiquette etiquette--vert">Publié</span>'
        : '<span class="etiquette etiquette--gris">Brouillon</span>'}
        ${a.is_featured ? '<span class="etiquette" style="margin-left:.25rem">À la une</span>' : ''}
        ${a.deleted_at ? '<span class="etiquette etiquette--rouge" style="margin-left:.25rem">Supprimé</span>' : ''}</td>
      <td class="serre petit muet">${esc(formatDateShort((a.published_at || a.created_at).slice(0, 10)))}</td>
      <td class="serre petit muet">${esc(auteur(a))}</td>
      <td class="serre">
        <div class="actions-ligne">
          <a class="btn btn--petit btn--fantome" href="/espace/articles/${esc(a.id)}">Voir</a>
          ${a.deleted_at ? '' : `<a class="btn btn--petit btn--fantome" href="/espace/articles/${esc(a.id)}/modifier">Modifier</a>`}
        </div>
      </td>
    </tr>`).join('');

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--large">
  ${messagesFlash(url)}
  <div class="titre-page">
    <div><h1>Articles</h1><p>Les nouvelles publiées sur le site de l'association.</p></div>
    <a class="btn btn--principal" href="/espace/articles/nouveau">${icone('plus', { taille: 18 })}Nouvel article</a>
  </div>
  <div class="rang" style="margin-bottom:1.25rem">
    ${onglet('tous', 'Tous')}${onglet('publies', 'Publiés')}${onglet('brouillons', 'Brouillons')}${onglet('supprimes', 'Corbeille')}
  </div>
  ${lignes ? `<div class="tableau-enveloppe"><table>
      <thead><tr><th>Article</th><th>État</th><th>Date</th><th>Auteur</th><th></th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`
    : `<div class="vide">${icone('journal', { taille: 34, classe: 'vide__icone' })}<h3>Aucun article</h3>
       <p>${filtre === 'supprimes' ? 'La corbeille est vide.' : 'Écrivez la première nouvelle de l’association.'}</p></div>`}
</div></section>`;

  return html(page({ titre: 'Articles', contenu, user, chemin: '/espace/articles', env, variante: 'espace' }));
}

// =====================================================================
//  Espace membres : detail
// =====================================================================

export async function detailArticle(env, url, user, session, id) {
  const a = await env.DB.prepare(
    `SELECT ar.*, c.first_name AS a_prenom, c.last_name AS a_nom, c.email AS a_email,
            m.first_name AS m_prenom, m.last_name AS m_nom, m.email AS m_email
       FROM articles ar
       LEFT JOIN users c ON c.id = ar.created_by
       LEFT JOIN users m ON m.id = ar.updated_by
      WHERE ar.id = ?`
  ).bind(id).first();
  if (!a) return null;

  const { results: journal } = await env.DB.prepare(
    `SELECT * FROM audit_log WHERE entity_type = 'article' AND entity_id = ? ORDER BY created_at DESC LIMIT 30`
  ).bind(id).all();

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  ${messagesFlash(url)}
  <p class="fil"><a href="/espace">Calendrier</a> › <a href="/espace/articles">Articles</a> › ${esc(a.title)}</p>

  ${a.deleted_at ? bandeau('erreur', `Cet article a été supprimé le ${formatDateTime(a.deleted_at)}. Il n'apparaît plus sur le site.`) : ''}
  ${!a.deleted_at && a.status === 'brouillon'
    ? bandeau('info', "Cet article est un brouillon : il n'est visible que dans cet espace.") : ''}

  <div class="rang" style="margin-bottom:1rem">
    ${a.status === 'publie' ? '<span class="etiquette etiquette--vert">Publié</span>' : '<span class="etiquette etiquette--gris">Brouillon</span>'}
    ${a.is_featured ? '<span class="etiquette">À la une</span>' : ''}
  </div>

  <h1>${esc(a.title)}</h1>
  ${a.chapo ? `<p class="chapo">${esc(a.chapo)}</p>` : ''}

  ${a.image_id ? `<figure class="article__figure" style="margin:1.5rem 0">
    <img src="${esc(urlImage(a.image_id))}" alt="${esc(a.image_alt)}" width="1200" height="675">
    ${a.image_alt ? `<figcaption>${esc(a.image_alt)}</figcaption>` : ''}
  </figure>` : ''}

  <div class="article__corps">${texteArticle(a.body)}</div>

  <hr>
  <div class="rang" style="margin-bottom:1.5rem">
    ${a.deleted_at ? `
      <form method="post" action="/espace/articles/${esc(a.id)}/restaurer" class="forme-inline">
        ${csrfInput(session)}<button class="btn btn--jaune" type="submit">Restaurer l'article</button>
      </form>`
    : `
      <a class="btn btn--principal" href="/espace/articles/${esc(a.id)}/modifier">Modifier</a>
      ${a.status === 'publie'
        ? `<a class="btn btn--fantome" href="/actualites/${esc(a.slug)}">Voir sur le site</a>` : ''}
      <form method="post" action="/espace/articles/${esc(a.id)}/supprimer" class="forme-inline"
            data-confirmer="Supprimer cet article ? Il disparaîtra du site.">
        ${csrfInput(session)}<button class="btn btn--danger" type="submit">Supprimer</button>
      </form>`}
    <a class="btn btn--fantome pousse" href="/espace/articles">${icone('fleche_gauche', { taille: 16 })}Tous les articles</a>
  </div>

  <div class="carte" style="margin-bottom:1.5rem">
    <h2 style="font-size:1.15rem">Informations</h2>
    <ul class="detail-liste">
      <li><span class="cle">Adresse</span><span>${a.status === 'publie'
        ? `<a href="/actualites/${esc(a.slug)}">/actualites/${esc(a.slug)}</a>`
        : `<span class="muet">/actualites/${esc(a.slug)} — après publication</span>`}</span></li>
      <li><span class="cle">Écrit par</span><span>${esc(auteur(a))} · ${esc(formatDateTime(a.created_at))}</span></li>
      <li><span class="cle">Modifié</span><span>${a.updated_at !== a.created_at
        ? `${esc(`${a.m_prenom || ''} ${a.m_nom || ''}`.trim() || a.m_email || '—')} · ${esc(formatDateTime(a.updated_at))}`
        : '<span class="muet">jamais modifié</span>'}</span></li>
      <li><span class="cle">Publié le</span><span>${a.published_at ? esc(formatDateTime(a.published_at)) : '<span class="muet">pas encore</span>'}</span></li>
    </ul>
  </div>

  <div class="carte">
    <h2 style="font-size:1.15rem">Historique</h2>
    <p class="petit muet">Chaque écriture, modification et suppression est tracée.</p>
    ${journal?.length ? `<div style="margin-top:1rem">${journal.map(ligneAudit).join('')}</div>` : '<p class="muet">Aucune entrée.</p>'}
  </div>
</div></section>`;

  return html(page({ titre: a.title, contenu, user, chemin: '/espace/articles', env, variante: 'espace' }));
}

// =====================================================================
//  Espace membres : formulaire
// =====================================================================

export function formulaireArticle(env, url, user, session, a = null, erreur = null) {
  const edition = !!a?.id;
  const v = (k, def = '') => esc(a?.[k] ?? def);
  const action = edition ? `/espace/articles/${a.id}/modifier` : '/espace/articles/nouveau';

  const contenu = `
<section class="section" style="padding-top:2rem"><div class="conteneur conteneur--etroit">
  <p class="fil"><a href="/espace/articles">Articles</a> › ${edition ? 'Modifier' : 'Nouvel article'}</p>
  <h1>${edition ? "Modifier l'article" : 'Nouvel article'}</h1>
  <p class="muet">${edition
    ? 'Les modifications sont enregistrées dans l’historique avec votre nom.'
    : 'Rédigez, enregistrez en brouillon, publiez quand vous êtes prêt.'}</p>

  <div class="carte" style="margin-top:1.5rem">
    ${erreur ? bandeau('erreur', erreur) : ''}
    <form method="post" action="${action}" enctype="multipart/form-data">
      ${csrfInput(session)}

      <div class="champ">
        <label class="champ__label" for="title">Titre <span class="champ__requis">*</span></label>
        <input type="text" id="title" name="title" required maxlength="140" value="${v('title')}" autofocus
               placeholder="Ex. : Le marché de Noël a rapporté 1 200 €">
      </div>

      <div class="champ">
        <label class="champ__label" for="chapo">Résumé</label>
        <textarea id="chapo" name="chapo" maxlength="300" rows="2"
                  placeholder="Une ou deux phrases qui donnent envie de lire la suite.">${v('chapo')}</textarea>
        <p class="champ__aide">Affiché sur la page d'accueil et dans la liste des actualités.</p>
      </div>

      <fieldset>
        <legend>Image mise en avant</legend>
        ${a?.image_id ? `
        <div class="apercu-image">
          <img src="${esc(urlImage(a.image_id))}" alt="${esc(a.image_alt)}" width="320" height="180">
          <label class="case" style="margin-top:.75rem">
            <input type="checkbox" name="retirer_image" value="1">
            <span>Retirer cette image</span>
          </label>
        </div>` : ''}
        <div class="champ">
          <label class="champ__label" for="image">${a?.image_id ? 'Remplacer par une autre image' : 'Choisir une image'}</label>
          <input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp">
          <p class="champ__aide" id="aide-image">JPEG, PNG ou WebP. L'image est automatiquement réduite dans votre navigateur avant l'envoi&nbsp;: inutile de la préparer.</p>
        </div>
        <div class="champ">
          <label class="champ__label" for="image_alt">Description de l'image</label>
          <input type="text" id="image_alt" name="image_alt" maxlength="180" value="${v('image_alt')}"
                 placeholder="Ex. : Les enfants devant les stands du marché de Noël">
          <p class="champ__aide">Lue par les personnes qui n'accèdent pas à l'image (lecteurs d'écran, connexion lente).</p>
        </div>
      </fieldset>

      <div class="champ">
        <label class="champ__label" for="body">Texte de l'article</label>
        <textarea id="body" name="body" maxlength="20000" rows="16"
                  placeholder="Racontez…">${v('body')}</textarea>
        <p class="champ__aide">
          Mise en forme&nbsp;: <code>## Sous-titre</code> · <code>- liste à puces</code> ·
          <code>**gras**</code> · <code>*italique*</code>. Une ligne vide sépare deux paragraphes,
          les adresses web deviennent des liens.
        </p>
      </div>

      <fieldset>
        <legend>Publication</legend>
        <div class="champ">
          <label class="case">
            <input type="checkbox" name="publie" value="1"${(a?.status ?? 'brouillon') === 'publie' ? ' checked' : ''}>
            <span><strong>Publier sur le site</strong><br>
            <span class="petit muet">Sans cette case, l'article reste un brouillon visible uniquement ici.</span></span>
          </label>
        </div>
        <div class="champ" style="margin-bottom:0">
          <label class="case">
            <input type="checkbox" name="is_featured" value="1"${a?.is_featured ? ' checked' : ''}>
            <span><strong>Mettre à la une</strong><br>
            <span class="petit muet">Remonte l'article dans la section « À la une » de la page d'accueil.</span></span>
          </label>
        </div>
      </fieldset>

      <div class="rang" style="margin-top:1.5rem">
        <button class="btn btn--principal" type="submit">${edition ? 'Enregistrer' : 'Créer l’article'}</button>
        <a class="btn btn--fantome" href="${edition ? `/espace/articles/${a.id}` : '/espace/articles'}">Annuler</a>
      </div>
    </form>
  </div>
</div></section>
<script>
// Reduction de l'image dans le navigateur : la base de donnees ne recoit que
// des fichiers de quelques centaines de kilo-octets, et l'envoi reste rapide
// depuis un telephone.
(function () {
  var champ = document.getElementById('image');
  var aide = document.getElementById('aide-image');
  if (!champ || !window.FileReader || !window.DataTransfer) return;
  var MAX = 1600, QUALITE = 0.82;

  champ.addEventListener('change', function () {
    var fichier = champ.files && champ.files[0];
    if (!fichier || !/^image\\//.test(fichier.type)) return;
    var messageInitial = aide.textContent;
    aide.textContent = 'Préparation de l’image…';

    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(img.src);
      var ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      if (ratio === 1 && fichier.size < 400000) { aide.textContent = messageInitial; return; }

      var c = document.createElement('canvas');
      c.width = Math.round(img.width * ratio);
      c.height = Math.round(img.height * ratio);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);

      c.toBlob(function (blob) {
        if (!blob || blob.size >= fichier.size) { aide.textContent = messageInitial; return; }
        var nom = fichier.name.replace(/\\.[^.]+$/, '') + '.jpg';
        var dt = new DataTransfer();
        dt.items.add(new File([blob], nom, { type: 'image/jpeg' }));
        champ.files = dt.files;
        aide.textContent = 'Image réduite à ' + c.width + '×' + c.height +
          ' (' + Math.round(blob.size / 1024) + ' Ko) — prête à être envoyée.';
      }, 'image/jpeg', QUALITE);
    };
    img.onerror = function () { aide.textContent = messageInitial; };
    img.src = URL.createObjectURL(fichier);
  });
})();
</script>`;

  return html(page({
    titre: edition ? 'Modifier un article' : 'Nouvel article',
    contenu, user, chemin: '/espace/articles', env, variante: 'espace',
  }));
}

// =====================================================================
//  Espace membres : ecriture
// =====================================================================

/** Genere un slug unique a partir du titre. */
async function slugUnique(env, titre, idExclu = null) {
  const base = slugifier(titre);
  for (let n = 0; n < 50; n++) {
    const candidat = n === 0 ? base : `${base}-${n + 1}`;
    const existe = await env.DB.prepare(
      'SELECT id FROM articles WHERE slug = ? AND id IS NOT ?'
    ).bind(candidat, idExclu).first();
    if (!existe) return candidat;
  }
  return `${base}-${Date.now()}`;
}

function lireArticle(form) {
  const data = {
    title: field(form, 'title', 140),
    chapo: field(form, 'chapo', 300),
    body: field(form, 'body', 20000),
    image_alt: field(form, 'image_alt', 180),
    status: form.get('publie') === '1' ? 'publie' : 'brouillon',
    is_featured: form.get('is_featured') === '1' ? 1 : 0,
  };
  if (!data.title) return { erreur: "Le titre de l'article est obligatoire." };
  return { data };
}

/** Traite le fichier envoye. Renvoie { imageId } ou { erreur }, imageId pouvant valoir null. */
async function traiterImage(env, form, user, imageActuelle) {
  const retirer = form.get('retirer_image') === '1';
  const fichier = form.get('image');
  const aUnFichier = fichier && typeof fichier.arrayBuffer === 'function' && fichier.size > 0;

  if (!aUnFichier) {
    if (retirer && imageActuelle) {
      await supprimerImage(env, imageActuelle);
      return { imageId: null };
    }
    return { imageId: imageActuelle ?? null };
  }

  if (!typeAccepte(fichier.type)) {
    return { erreur: 'Format d’image non reconnu. Utilisez un fichier JPEG, PNG ou WebP.' };
  }
  if (fichier.size > TAILLE_MAX) {
    return { erreur: `L'image est trop lourde (${tailleLisible(fichier.size)}). Maximum ${tailleLisible(TAILLE_MAX)}.` };
  }

  const resultat = await enregistrerImage(env, fichier, { auteurId: user.id });
  if (resultat.erreur) return { erreur: resultat.erreur };

  // L'ancienne image ne sert plus a personne d'autre : on libere la place.
  if (imageActuelle) await supprimerImage(env, imageActuelle);
  return { imageId: resultat.id };
}

export async function creerArticlePost(env, request, url, user, session) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect('/espace/articles/nouveau?err=csrf');

  const { data, erreur } = lireArticle(form);
  if (erreur) return formulaireArticle(env, url, user, session, Object.fromEntries(form), erreur);

  const image = await traiterImage(env, form, user, null);
  if (image.erreur) return formulaireArticle(env, url, user, session, Object.fromEntries(form), image.erreur);

  const id = uuid();
  const slug = await slugUnique(env, data.title);
  const maintenant = nowIso();

  await env.DB.prepare(
    `INSERT INTO articles (id, slug, title, chapo, body, image_id, image_alt, status, is_featured,
                           published_at, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, slug, data.title, data.chapo, data.body, image.imageId, data.image_alt,
    data.status, data.is_featured, data.status === 'publie' ? maintenant : null,
    user.id, maintenant, user.id, maintenant).run();

  await logAudit(env, request, {
    actor: user, action: 'article.create', entityType: 'article', entityId: id,
    entityLabel: data.title, changes: diff({}, { ...data, image_id: image.imageId }, CHAMPS_AUDITES),
  });

  return redirect(`/espace/articles/${id}?ok=${data.status === 'publie' ? 'article-publie' : 'article-cree'}`);
}

export async function modifierArticlePost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/articles/${id}/modifier?err=csrf`);

  const avant = await env.DB.prepare('SELECT * FROM articles WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!avant) return redirect('/espace/articles?err=introuvable');

  const { data, erreur } = lireArticle(form);
  if (erreur) return formulaireArticle(env, url, user, session, { ...avant, ...Object.fromEntries(form) }, erreur);

  const image = await traiterImage(env, form, user, avant.image_id);
  if (image.erreur) return formulaireArticle(env, url, user, session, { ...avant, ...Object.fromEntries(form) }, image.erreur);

  // La date de publication est celle de la premiere mise en ligne.
  const published = data.status === 'publie' ? (avant.published_at || nowIso()) : null;

  await env.DB.prepare(
    `UPDATE articles SET title = ?, chapo = ?, body = ?, image_id = ?, image_alt = ?,
            status = ?, is_featured = ?, published_at = ?, updated_by = ?, updated_at = ?
      WHERE id = ?`
  ).bind(data.title, data.chapo, data.body, image.imageId, data.image_alt,
    data.status, data.is_featured, published, user.id, nowIso(), id).run();

  const changements = diff(avant, { ...data, image_id: image.imageId }, CHAMPS_AUDITES);
  if (changements) {
    await logAudit(env, request, {
      actor: user, action: 'article.update', entityType: 'article', entityId: id,
      entityLabel: data.title, changes: changements,
    });
  }

  return redirect(`/espace/articles/${id}?ok=article-modifie`);
}

export async function supprimerArticlePost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/articles/${id}?err=csrf`);

  const a = await env.DB.prepare('SELECT * FROM articles WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!a) return redirect('/espace/articles?err=introuvable');

  await env.DB.prepare('UPDATE articles SET deleted_at = ?, deleted_by = ? WHERE id = ?')
    .bind(nowIso(), user.id, id).run();

  await logAudit(env, request, {
    actor: user, action: 'article.delete', entityType: 'article', entityId: id,
    entityLabel: a.title, changes: { title: [a.title, null], status: [a.status, null] },
  });

  return redirect('/espace/articles?ok=article-supprime');
}

export async function restaurerArticlePost(env, request, url, user, session, id) {
  const form = await request.formData();
  if (!checkCsrf(session, form)) return redirect(`/espace/articles/${id}?err=csrf`);

  const a = await env.DB.prepare('SELECT * FROM articles WHERE id = ? AND deleted_at IS NOT NULL').bind(id).first();
  if (!a) return redirect('/espace/articles?err=introuvable');

  await env.DB.prepare('UPDATE articles SET deleted_at = NULL, deleted_by = NULL, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind(user.id, nowIso(), id).run();

  await logAudit(env, request, {
    actor: user, action: 'article.restore', entityType: 'article', entityId: id, entityLabel: a.title,
  });

  return redirect(`/espace/articles/${id}?ok=article-restaure`);
}
