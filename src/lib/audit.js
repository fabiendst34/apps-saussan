// Journal d'audit : toute action sensible laisse une trace immuable.
import { nowIso, clientIp, userAgent } from './util.js';

/** Libelles lisibles affiches dans l'interface d'administration. */
export const ACTION_LABELS = {
  'auth.connexion': 'Connexion',
  'auth.deconnexion': 'Déconnexion',
  'auth.echec': 'Échec de connexion',
  'auth.blocage': 'Connexion bloquée (trop de tentatives)',
  'auth.activation': 'Activation du compte',
  'auth.mdp_oublie': 'Demande de réinitialisation',
  'auth.mdp_reinitialise': 'Mot de passe réinitialisé',
  'compte.mdp_modifie': 'Mot de passe modifié',
  'compte.profil_modifie': 'Profil modifié',
  'event.create': 'Événement créé',
  'event.update': 'Événement modifié',
  'event.delete': 'Événement supprimé',
  'event.restore': 'Événement restauré',
  'article.create': 'Article écrit',
  'article.update': 'Article modifié',
  'article.delete': 'Article supprimé',
  'article.restore': 'Article restauré',
  'article.annonce': 'Article annoncé aux membres',
  'user.create': 'Compte créé',
  'user.update': 'Compte modifié',
  'user.delete': 'Compte supprimé',
  'user.activation_envoyee': "E-mail d'activation envoyé",
  'user.reinit_envoyee': 'E-mail de réinitialisation envoyé',
  'user.sessions_revoquees': 'Sessions révoquées',
  'message.recu': 'Message de contact reçu',
  'message.delete': 'Message supprimé',
};

/** Categorie visuelle d'une action, pour la pastille de couleur du journal. */
export function actionTone(action) {
  if (action === 'auth.echec' || action === 'auth.blocage' || action.endsWith('.delete')) return 'danger';
  if (action.endsWith('.create')) return 'success';
  if (action.endsWith('.update') || action.includes('modifie')) return 'warn';
  return 'neutral';
}

/**
 * Enregistre une entree d'audit. Ne doit jamais faire echouer l'action metier :
 * une erreur d'ecriture du journal est signalee dans les logs, pas a l'utilisateur.
 */
export async function logAudit(env, request, entry) {
  const {
    actor = null,
    action,
    entityType = '',
    entityId = '',
    entityLabel = '',
    changes = null,
    actorEmail = null,
  } = entry;

  try {
    await env.DB.prepare(
      `INSERT INTO audit_log
         (created_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_label, changes, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      nowIso(),
      actor?.id ?? null,
      actorEmail || actor?.email || 'système',
      actor ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim() : '',
      action,
      entityType,
      String(entityId ?? ''),
      String(entityLabel ?? '').slice(0, 200),
      changes ? JSON.stringify(changes) : '',
      request ? clientIp(request) : '',
      request ? userAgent(request) : ''
    ).run();
  } catch (err) {
    console.error('audit: écriture impossible', action, err);
  }
}

/**
 * Compare deux etats d'un enregistrement et renvoie { champ: [avant, apres] }
 * pour les seuls champs surveilles qui ont reellement change.
 */
export function diff(before, after, fields) {
  const changes = {};
  for (const f of fields) {
    const a = before?.[f] ?? null;
    const b = after?.[f] ?? null;
    if (String(a ?? '') !== String(b ?? '')) changes[f] = [a, b];
  }
  return Object.keys(changes).length ? changes : null;
}

/** Noms lisibles des champs, pour l'affichage des differences. */
export const FIELD_LABELS = {
  title: 'Titre', description: 'Description', location: 'Lieu', category: 'Catégorie',
  start_date: 'Date de début', start_time: 'Heure de début', end_date: 'Date de fin',
  end_time: 'Heure de fin', all_day: 'Journée entière', is_public: 'Visible publiquement',
  audience: 'Destinataires', leaders: 'Équipe de leaders', instance: 'Instance',
  email: 'E-mail', first_name: 'Prénom', last_name: 'Nom', role: 'Rôle',
  status: 'Statut', phone: 'Téléphone', password_hash: 'Mot de passe', title_fn: 'Fonction',
  chapo: 'Résumé', body: 'Texte', image_id: 'Image', image_alt: "Description de l'image",
  is_featured: 'À la une', slug: 'Adresse',
};
