// En-tetes de securite et entretien de la base.

import { randomToken, nowIso } from './util.js';

/**
 * Construit la Content-Security-Policy.
 *
 * Les scripts sont autorises par nonce : un script injecte via une faille
 * d'echappement n'en porterait pas et ne s'executerait pas. C'est le filet
 * qui rattrape une erreur d'echappement que nous aurions laissee passer.
 *
 * `style-src` conserve 'unsafe-inline' : l'interface utilise des attributs
 * style ponctuels, que les nonces ne couvrent pas. Le risque est sans commune
 * mesure avec celui des scripts.
 */
export function politiqueSecurite(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    // Le formulaire d'adhesion est servi par HelloAsso dans une iframe.
    'frame-src https://www.helloasso.com https://helloasso.com',
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function nouveauNonce() {
  return randomToken(16);
}

/** Applique les en-tetes de securite a une reponse HTML. */
export function entetesSecurite(reponse, nonce, url) {
  const h = reponse.headers;
  h.set('content-security-policy', politiqueSecurite(nonce));
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('x-frame-options', 'DENY');
  h.set('permissions-policy', 'geolocation=(), camera=(), microphone=(), interest-cohort=()');
  // HSTS uniquement en HTTPS : l'envoyer en clair n'a pas de sens et gene le
  // developpement local.
  if (url.protocol === 'https:') {
    h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
  return reponse;
}

/**
 * Entretien : supprime les sessions et jetons expires.
 *
 * Sans cela les deux tables grossissent indefiniment, une session expirée
 * n'etant effacee que si son porteur la represente. Le nettoyage tourne apres
 * l'envoi de la reponse, une fois sur cinquante environ : assez pour suivre le
 * rythme d'un site associatif, assez rare pour ne rien couter a l'affichage.
 */
export async function entretien(env) {
  const maintenant = nowIso();
  try {
    const [sessions, jetons] = await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(maintenant),
      // Un jeton consomme reste une semaine : le journal d'audit y renvoie.
      env.DB.prepare("DELETE FROM tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < datetime('now', '-7 days'))")
        .bind(maintenant),
    ]);
    const n = (sessions.meta?.changes || 0) + (jetons.meta?.changes || 0);
    if (n > 0) console.log(`entretien : ${n} enregistrement(s) expiré(s) supprimé(s)`);
  } catch (err) {
    console.error('entretien : échec', err);
  }
}

/** Vrai une fois sur `sur`, pour espacer les taches d'entretien. */
export function deTempsEnTemps(sur = 50) {
  return Math.random() * sur < 1;
}
