// Instances de l'association : qui siege ou, et a qui s'adresse un evenement.
//
// Trois cercles emboites. Le bureau fait partie du comite d'administration,
// qui fait lui-meme partie des membres ; l'inverse n'est pas vrai. Toute la
// hierarchie tient dans RANG : un membre voit ce qui est destine a son rang
// et a tous les rangs inferieurs.

import { esc } from './util.js';

/** Droits techniques d'un compte, independants de l'instance. */
export const ROLES = { membre: 'Membre', admin: 'Administrateur' };

/** Etat d'un compte vis-a-vis de la connexion. */
export const STATUTS = { invite: 'Invité', actif: 'Actif', suspendu: 'Suspendu' };

/** Appartenance d'un compte. */
export const INSTANCES = {
  membre: 'Membre',
  ca: "Comité d'administration",
  bureau: 'Bureau',
};

/** Destinataires possibles d'un evenement. */
export const AUDIENCES = {
  tous: 'Tous les membres',
  ca: "Comité d'administration",
  bureau: 'Bureau',
};

/** Forme courte, pour les tableaux et les etiquettes. */
export const AUDIENCES_COURT = { tous: 'Tous', ca: 'CA', bureau: 'Bureau' };

/** Idem pour les instances : « CA » suffit dans un tableau. */
export const INSTANCES_COURT = { membre: 'Membre', ca: 'CA', bureau: 'Bureau' };

const RANG = { membre: 0, tous: 0, ca: 1, bureau: 2 };

export function rang(cle) {
  return RANG[cle] ?? 0;
}

export function instanceLabel(i) {
  return INSTANCES[i] || INSTANCES.membre;
}

export function audienceLabel(a) {
  return AUDIENCES[a] || AUDIENCES.tous;
}

export function normaliserInstance(v) {
  return INSTANCES[v] ? v : 'membre';
}

export function normaliserAudience(v) {
  return AUDIENCES[v] ? v : 'tous';
}

/**
 * Audiences qu'un compte a le droit de consulter.
 * L'administrateur technique voit tout : il doit pouvoir depanner n'importe
 * quelle fiche sans avoir a se rattacher a une instance.
 */
export function audiencesVisibles(user) {
  if (user?.role === 'admin') return Object.keys(AUDIENCES);
  const r = rang(user?.instance);
  return Object.keys(AUDIENCES).filter((a) => rang(a) <= r);
}

/**
 * Fragment SQL restreignant une requete sur `events` aux evenements que le
 * compte peut voir. Un evenement publie sur le site reste visible de tous,
 * quelle que soit son audience.
 * @returns {{sql: string, params: string[]}}
 */
export function filtreAudience(user, colonne = 'audience') {
  const visibles = audiencesVisibles(user);
  if (visibles.length === Object.keys(AUDIENCES).length) return { sql: '', params: [] };
  const trous = visibles.map(() => '?').join(', ');
  return { sql: `(is_public = 1 OR ${colonne} IN (${trous}))`, params: visibles };
}

/** Le compte peut-il consulter cet evenement ? */
export function peutVoirEvenement(user, ev) {
  if (!ev) return false;
  if (ev.is_public) return true;
  return audiencesVisibles(user).includes(normaliserAudience(ev.audience));
}

/** Etiquette « pour qui » d'un evenement. Rien pour l'audience par defaut. */
export function badgeAudience(a) {
  const cle = normaliserAudience(a);
  if (cle === 'tous') return '';
  return `<span class="etiquette etiquette--${cle}">${esc(AUDIENCES_COURT[cle])}</span>`;
}
