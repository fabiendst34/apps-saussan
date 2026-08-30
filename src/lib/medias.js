// Stockage des images mises en avant.
//
// Implementation actuelle : le binaire vit dans D1, faute de R2 active sur le
// compte Cloudflare. Toute l'application passe par les quatre fonctions
// ci-dessous ; migrer vers R2 revient a les reecrire, sans toucher au reste.

import { uuid, nowIso } from './util.js';

/** Formats acceptes. Le WebP est produit par le redimensionnement navigateur. */
export const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];

/** Au-dela, on refuse : le navigateur est cense avoir redimensionne avant l'envoi. */
export const TAILLE_MAX = 1_200_000;   // 1,2 Mo

export function typeAccepte(type) {
  return TYPES_IMAGE.includes(String(type || '').toLowerCase());
}

export function tailleLisible(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Enregistre une image et renvoie son identifiant.
 * @returns {Promise<{id: string} | {erreur: string}>}
 */
export async function enregistrerImage(env, fichier, { largeur, hauteur, auteurId } = {}) {
  if (!fichier || typeof fichier.arrayBuffer !== 'function' || fichier.size === 0) {
    return { erreur: "Aucune image n'a été reçue." };
  }
  if (!typeAccepte(fichier.type)) {
    return { erreur: 'Format non reconnu. Utilisez une image JPEG, PNG ou WebP.' };
  }
  if (fichier.size > TAILLE_MAX) {
    return { erreur: `L'image est trop lourde (${tailleLisible(fichier.size)}). Maximum ${tailleLisible(TAILLE_MAX)}.` };
  }

  const donnees = await fichier.arrayBuffer();
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO medias (id, content_type, taille, largeur, hauteur, nom_origine, donnees, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, fichier.type, fichier.size,
    largeur || null, hauteur || null,
    String(fichier.name || '').slice(0, 150),
    donnees, nowIso(), auteurId || null
  ).run();

  return { id };
}

/**
 * Renvoie l'image prete a etre servie, ou null.
 *
 * D1 restitue les colonnes BLOB sous forme de tableau de nombres, et non
 * d'ArrayBuffer : sans cette conversion, Response n'envoie aucun octet.
 */
export async function lireImage(env, id) {
  const row = await env.DB.prepare(
    'SELECT content_type, taille, donnees FROM medias WHERE id = ?'
  ).bind(id).first();
  if (!row) return null;

  const brut = row.donnees;
  const octets = brut instanceof ArrayBuffer ? new Uint8Array(brut)
    : ArrayBuffer.isView(brut) ? new Uint8Array(brut.buffer, brut.byteOffset, brut.byteLength)
    : new Uint8Array(Array.isArray(brut) ? brut : []);

  return { contentType: row.content_type, taille: octets.byteLength, donnees: octets };
}

export async function supprimerImage(env, id) {
  if (!id) return;
  await env.DB.prepare('DELETE FROM medias WHERE id = ?').bind(id).run();
}

/** URL publique d'une image. Le contenu ne change jamais : le cache peut etre long. */
export function urlImage(id) {
  return id ? `/medias/${id}` : '';
}

/**
 * Sert une image. Les identifiants etant des UUID immuables, la reponse est
 * mise en cache un an ; une modification cree un nouvel identifiant.
 */
export async function servirImage(env, request, id) {
  const image = await lireImage(env, id);
  if (!image) return new Response('Image introuvable', { status: 404 });

  const etag = `"${id}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return new Response(image.donnees, {
    headers: {
      'content-type': image.contentType,
      'content-length': String(image.taille),
      'cache-control': 'public, max-age=31536000, immutable',
      etag,
      'x-content-type-options': 'nosniff',
    },
  });
}
