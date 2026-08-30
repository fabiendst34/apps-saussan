// =====================================================================
//  Site de l'APPS — point d'entree du Worker.
//  Routage explicite : chaque URL est declaree, tout le reste tombe en 404.
// =====================================================================
import { html, redirect, json } from './lib/util.js';
import { currentUser } from './lib/auth.js';
import { page } from './lib/layout.js';
import * as pub from './routes/public.js';
import * as auth from './routes/auth.js';
import * as espace from './routes/espace.js';
import * as admin from './routes/admin.js';
import * as articles from './routes/articles.js';
import { servirImage } from './lib/medias.js';

/**
 * Protection CSRF de premier niveau : tout POST doit provenir du site lui-meme.
 * Complete les jetons CSRF par session utilises dans l'espace membres.
 */
function origineValide(request, url) {
  const origine = request.headers.get('origin');
  if (!origine) {
    // Certains clients omettent Origin ; on se rabat sur Referer.
    const referer = request.headers.get('referer');
    if (!referer) return true;
    try { return new URL(referer).host === url.host; } catch { return false; }
  }
  try { return new URL(origine).host === url.host; } catch { return false; }
}

/** Extrait un identifiant depuis un chemin du type /prefixe/:id/suffixe. */
function segments(pathname) {
  return pathname.split('/').filter(Boolean);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const chemin = url.pathname.replace(/\/+$/, '') || '/';
    // HEAD est traite comme GET : la plateforme se charge de retirer le corps.
    const methode = request.method === 'HEAD' ? 'GET' : request.method;
    const seg = segments(chemin);

    try {
      if (methode !== 'GET' && methode !== 'POST') {
        return new Response('Méthode non autorisée', { status: 405, headers: { allow: 'GET, POST, HEAD' } });
      }
      if (methode === 'POST' && !origineValide(request, url)) {
        return new Response('Requête refusée : origine invalide.', { status: 403 });
      }

      const contexte = await currentUser(env, request);
      const user = contexte?.user || null;
      const session = contexte?.session || null;

      // --- Garde-fous d'acces -------------------------------------
      const exigeConnexion = () => redirect(`/espace/connexion?err=session-expiree&suite=${encodeURIComponent(chemin)}`);
      const exigeAdmin = () => redirect('/espace?err=acces-refuse');

      const zonePrivee = chemin === '/espace' || chemin.startsWith('/espace/');
      const zoneAdmin = chemin === '/admin' || chemin.startsWith('/admin/');
      const publiquesDeLEspace = [
        '/espace/connexion', '/espace/activation', '/espace/mot-de-passe-oublie', '/espace/reinitialisation',
      ];

      if (zonePrivee && !publiquesDeLEspace.includes(chemin) && !user) return exigeConnexion();
      if (zoneAdmin && !user) return exigeConnexion();
      if (zoneAdmin && user.role !== 'admin') return exigeAdmin();

      // --- Site public --------------------------------------------
      if (methode === 'GET') {
        switch (chemin) {
          case '/':                  return pub.accueil(env, url, user);
          case '/association':       return pub.association(env, url, user);
          case '/evenements':        return pub.evenements(env, url, user);
          case '/actualites':        return articles.actualites(env, url, user);
          case '/adherer':           return pub.adherer(env, url, user);
          case '/contact':           return pub.contact(env, url, user);
          case '/mentions-legales':  return pub.mentionsLegales(env, url, user);
          case '/confidentialite':   return pub.confidentialite(env, url, user);
        }
      }
      if (methode === 'POST' && chemin === '/contact') return pub.contactPost(env, request, url, user);

      // /actualites/:slug
      if (seg[0] === 'actualites' && seg[1] && !seg[2] && methode === 'GET') {
        const reponse = await articles.articlePublic(env, url, user, seg[1]);
        return reponse || pub.page404(env, url, user);
      }

      // Images des articles, servies depuis le stockage de medias.
      if (seg[0] === 'medias' && seg[1] && !seg[2] && methode === 'GET') {
        return servirImage(env, request, seg[1]);
      }

      // --- Authentification ---------------------------------------
      if (chemin === '/espace/connexion') {
        if (user && methode === 'GET') return redirect('/espace');
        return methode === 'POST' ? auth.connexionPost(env, request, url) : auth.connexionPage(env, url);
      }
      if (chemin === '/espace/deconnexion' && methode === 'POST') return auth.deconnexionPost(env, request, url, user);
      if (chemin === '/espace/activation') {
        return methode === 'POST' ? auth.activationPost(env, request, url) : auth.activationPage(env, url);
      }
      if (chemin === '/espace/mot-de-passe-oublie') {
        return methode === 'POST' ? auth.oubliPost(env, request, url) : auth.oubliPage(env, url);
      }
      if (chemin === '/espace/reinitialisation') {
        return methode === 'POST' ? auth.reinitPost(env, request, url) : auth.reinitPage(env, url);
      }

      // --- Espace membres -----------------------------------------
      if (chemin === '/espace' && methode === 'GET') return espace.calendrier(env, url, user, session);
      if (chemin === '/espace/evenements' && methode === 'GET') return espace.listeEvenements(env, url, user);
      if (chemin === '/espace/journal' && methode === 'GET') return espace.monJournal(env, url, user);

      if (chemin === '/espace/evenements/nouveau') {
        return methode === 'POST'
          ? espace.creerEvenementPost(env, request, url, user, session)
          : espace.formulaireEvenement(env, url, user, session);
      }

      // /espace/evenements/:id[/modifier|/supprimer|/restaurer]
      if (seg[0] === 'espace' && seg[1] === 'evenements' && seg[2]) {
        const id = seg[2];
        const suite = seg[3] || '';

        if (!suite && methode === 'GET') {
          const reponse = await espace.detailEvenement(env, url, user, session, id);
          return reponse || pub.page404(env, url, user);
        }
        if (suite === 'modifier') {
          if (methode === 'POST') return espace.modifierEvenementPost(env, request, url, user, session, id);
          const ev = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').bind(id).first();
          return ev ? espace.formulaireEvenement(env, url, user, session, ev) : pub.page404(env, url, user);
        }
        if (suite === 'supprimer' && methode === 'POST') return espace.supprimerEvenementPost(env, request, url, user, session, id);
        if (suite === 'restaurer' && methode === 'POST') return espace.restaurerEvenementPost(env, request, url, user, session, id);
      }

      if (chemin === '/espace/articles' && methode === 'GET') return articles.listeArticles(env, url, user);

      if (chemin === '/espace/articles/nouveau') {
        return methode === 'POST'
          ? articles.creerArticlePost(env, request, url, user, session)
          : articles.formulaireArticle(env, url, user, session);
      }

      // /espace/articles/:id[/modifier|/supprimer|/restaurer]
      if (seg[0] === 'espace' && seg[1] === 'articles' && seg[2]) {
        const id = seg[2];
        const suite = seg[3] || '';

        if (!suite && methode === 'GET') {
          const reponse = await articles.detailArticle(env, url, user, session, id);
          return reponse || pub.page404(env, url, user);
        }
        if (suite === 'modifier') {
          if (methode === 'POST') return articles.modifierArticlePost(env, request, url, user, session, id);
          const a = await env.DB.prepare('SELECT * FROM articles WHERE id = ? AND deleted_at IS NULL').bind(id).first();
          return a ? articles.formulaireArticle(env, url, user, session, a) : pub.page404(env, url, user);
        }
        if (suite === 'supprimer' && methode === 'POST') return articles.supprimerArticlePost(env, request, url, user, session, id);
        if (suite === 'restaurer' && methode === 'POST') return articles.restaurerArticlePost(env, request, url, user, session, id);
      }

      if (chemin === '/espace/compte' && methode === 'GET') return espace.monCompte(env, url, user, session);
      if (chemin === '/espace/compte/profil' && methode === 'POST') return espace.profilPost(env, request, url, user, session);
      if (chemin === '/espace/compte/mot-de-passe' && methode === 'POST') return espace.motDePassePost(env, request, url, user, session);

      // --- Administration -----------------------------------------
      if (chemin === '/admin' && methode === 'GET') return admin.tableauDeBord(env, url, user);
      if (chemin === '/admin/comptes' && methode === 'GET') return admin.listeComptes(env, url, user);
      if (chemin === '/admin/journal' && methode === 'GET') return admin.journalAudit(env, url, user);
      if (chemin === '/admin/messages' && methode === 'GET') return admin.listeMessages(env, url, user, session);

      if (chemin === '/admin/comptes/nouveau') {
        return methode === 'POST'
          ? admin.creerComptePost(env, request, url, user, session)
          : admin.formulaireCompte(env, url, user, session);
      }

      // /admin/comptes/:id[/modifier|/supprimer|/invitation|/reinitialisation|/sessions]
      if (seg[0] === 'admin' && seg[1] === 'comptes' && seg[2]) {
        const id = seg[2];
        const suite = seg[3] || '';

        if (!suite) {
          if (methode === 'POST') return admin.modifierComptePost(env, request, url, user, session, id);
          const reponse = await admin.ficheCompte(env, url, user, session, id);
          return reponse || pub.page404(env, url, user);
        }
        if (suite === 'modifier' && methode === 'GET') {
          const cible = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
          return cible ? admin.formulaireCompte(env, url, user, session, cible) : pub.page404(env, url, user);
        }
        if (methode === 'POST') {
          if (suite === 'supprimer')       return admin.supprimerComptePost(env, request, url, user, session, id);
          if (suite === 'invitation')      return admin.invitationPost(env, request, url, user, session, id);
          if (suite === 'reinitialisation') return admin.reinitialisationPost(env, request, url, user, session, id);
          if (suite === 'sessions')        return admin.sessionsPost(env, request, url, user, session, id);
        }
      }

      if (seg[0] === 'admin' && seg[1] === 'messages' && seg[2] && seg[3] === 'supprimer' && methode === 'POST') {
        return admin.supprimerMessagePost(env, request, url, user, session, seg[2]);
      }

      // --- Sonde de sante -----------------------------------------
      if (chemin === '/sante') {
        const t = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
        return json({ ok: true, comptes: t?.n ?? 0, date: new Date().toISOString() });
      }

      return pub.page404(env, url, user);
    } catch (erreur) {
      console.error('Erreur non interceptée', chemin, erreur);
      const contenu = `
<section class="section"><div class="conteneur conteneur--etroit centre" style="padding:3rem 0">
  <h1>Une erreur est survenue</h1>
  <p class="muet">Le site a rencontré un problème inattendu. L'incident a été enregistré&nbsp;; merci de réessayer dans un instant.</p>
  <div class="rang" style="justify-content:center;margin-top:1.5rem">
    <a class="btn btn--principal" href="/">Retour à l'accueil</a>
  </div>
</div></section>`;
      return html(page({ titre: 'Erreur', contenu, chemin, env, user: null }), { status: 500 });
    }
  },
};
